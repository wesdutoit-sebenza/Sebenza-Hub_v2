import { Worker, Job } from "bullmq";
import { connection, isQueueAvailable, screeningQueue, fraudDetectionQueue } from "./queue";
import OpenAI from "openai";
import { detectFraud, shouldAutoApprove, shouldAutoReject } from "./fraud-detection";
import { pool } from "./db-pool";

// Worker only starts if Redis is available
if (!isQueueAvailable() || !connection) {
  console.log("[Worker] Queue not available, worker not started");
  process.exit(0);
}
// This is using Replit's AI Integrations service, which provides OpenAI-compatible API access without requiring your own OpenAI API key.
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

const SYSTEM_PROMPT = process.env.SCREENING_SYSTEM_PROMPT || `You are an expert technical recruiter and talent evaluator.

Given a job role specification and a candidate profile, evaluate how well the candidate matches the role.

You must return a JSON object with this exact structure:
{
  "score_total": <number 0-100>,
  "score_breakdown": {
    "skills": <number 0-100>,
    "experience": <number 0-100>,
    "achievements": <number 0-100>,
    "education": <number 0-100>,
    "location_auth": <number 0-100>,
    "salary_availability": <number 0-100>
  },
  "must_haves_satisfied": [<array of satisfied must-have skills>],
  "missing_must_haves": [<array of missing must-have skills>],
  "knockout": {
    "is_ko": <boolean>,
    "reasons": [<array of knockout reasons if any>]
  },
  "reasons": [<array of brief evaluation points>],
  "flags": {
    "red": [<array of critical concerns>],
    "yellow": [<array of minor concerns>]
  }
}

Evaluate based on:
- Skills match (must-haves vs nice-to-haves)
- Experience relevance and depth
- Quantifiable achievements
- Education alignment
- Location and work authorization
- Salary and availability alignment`;

console.log("[Worker] Starting screening worker...");

const worker = new Worker(
  "screening",
  async (job: Job) => {
    // Handle "seed-role-screenings" job type
    if (job.name === "seed-role-screenings") {
      const { roleId } = job.data;

      console.log(`[Worker] Seeding screenings for role ${roleId}`);

      // Fetch role details
      const { rows: roleRows } = await pool.query("SELECT * FROM roles WHERE id=$1", [roleId]);
      if (!roleRows.length) {
        console.warn(`[Worker] Role ${roleId} not found`);
        return;
      }
      const role = roleRows[0];

      // Compute embedding for role search string
      const searchText = [
        role.job_title,
        role.job_description,
        (role.must_have_skills || []).join(", "),
        role.location_city || "",
        role.work_type || ""
      ].join("\n");

      let emb: number[] | null = null;
      try {
        const e = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: searchText
        });
        emb = e.data[0].embedding as any;
      } catch (error) {
        console.warn(`[Worker] Failed to generate embedding for role ${roleId}:`, error);
      }

      let candidates;
      if (emb) {
        // Use semantic search
        candidates = (await pool.query(
          `SELECT c.id
           FROM candidate_embeddings ce
           JOIN candidates c ON c.id = ce.candidate_id
           ORDER BY ce.embedding <=> $1
           LIMIT 300`,
          [JSON.stringify(emb)]
        )).rows;
      } else {
        // Fallback to latest candidates
        candidates = (await pool.query(
          `SELECT id FROM candidates ORDER BY created_at DESC LIMIT 300`
        )).rows;
      }

      console.log(`[Worker] Enqueuing ${candidates.length} candidates for role ${roleId}`);

      // Enqueue individual screening jobs
      for (const c of candidates) {
        await screeningQueue!.add("screen", { roleId, candidateId: c.id });
      }
      return;
    }

    // Handle "screen" job type
    if (job.name === "screen") {
      const { roleId, candidateId } = job.data;

      console.log(`[Worker] Processing screening: Role ${roleId} x Candidate ${candidateId}`);

      try {
        // Fetch role & candidate profile with all related data in one query
        const { rows: rRows } = await pool.query("SELECT * FROM roles WHERE id=$1", [roleId]);
        const { rows: cRows } = await pool.query(`
          SELECT c.*, 
            COALESCE((
              SELECT json_agg(e) FROM (
                SELECT title, company, industry, location, start_date, end_date, is_current, bullets
                FROM experiences WHERE candidate_id = c.id
              ) e
            ), '[]'::json) AS experience,
            COALESCE((
              SELECT json_agg(ed) FROM (
                SELECT institution, qualification, location, grad_date
                FROM education WHERE candidate_id = c.id
              ) ed
            ), '[]'::json) AS education,
            COALESCE((
              SELECT json_agg(cert) FROM (
                SELECT name, issuer, year FROM certifications WHERE candidate_id = c.id
              ) cert
            ), '[]'::json) AS certifications,
            COALESCE((
              SELECT json_agg(p) FROM (
                SELECT name, what, impact, link FROM projects WHERE candidate_id = c.id
              ) p
            ), '[]'::json) AS projects,
            COALESCE((
              SELECT json_agg(a) FROM (
                SELECT name, by_whom AS "by", year, note FROM awards WHERE candidate_id = c.id
              ) a
            ), '[]'::json) AS awards,
            COALESCE((
              SELECT json_object_agg(kind, skills_array)
              FROM (
                SELECT kind, array_agg(s.name) AS skills_array
                FROM candidate_skills cs
                JOIN skills s ON s.id = cs.skill_id
                WHERE cs.candidate_id = c.id
                GROUP BY kind
              ) skills_by_kind
            ), '{"technical":[],"tools":[],"soft":[]}'::json) AS skills_json
          FROM candidates c
          WHERE c.id=$1
        `, [candidateId]);

        if (!rRows.length || !cRows.length) {
          console.warn(`[Worker] Role or candidate not found: ${roleId}, ${candidateId}`);
          return;
        }

        const role = rRows[0];
        const cand = cRows[0];

        // Build the user message for the LLM
        const userMsg = {
          role: {
            job_title: role.job_title,
            job_description: role.job_description,
            seniority: role.seniority,
            employment_type: role.employment_type,
            location: {
              city: role.location_city,
              country: role.location_country,
              work_type: role.work_type
            },
            must_have_skills: role.must_have_skills || [],
            nice_to_have_skills: role.nice_to_have_skills || [],
            salary_range: {
              min: role.salary_min,
              max: role.salary_max,
              currency: role.salary_currency || "ZAR"
            },
            knockouts: role.knockouts || [],
            weights: role.weights || undefined
          },
          candidate: {
            full_name: cand.full_name,
            contact: {
              email: cand.email,
              phone: cand.phone,
              city: cand.city,
              country: cand.country
            },
            headline: cand.headline,
            skills: cand.skills_json,
            experience: cand.experience,
            education: cand.education,
            certifications: cand.certifications,
            projects: cand.projects,
            awards: cand.awards,
            work_authorization: cand.work_authorization,
            availability: cand.availability,
            salary_expectation: cand.salary_expectation,
            links: cand.links
          }
        };

        // Call LLM (Screening Agent)
        let llmScore: any | null = null;
        try {
          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            temperature: 0,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              {
                role: "user",
                content: "Evaluate this single candidate against the role. Return only a JSON object matching the schema described in the system prompt."
              },
              { role: "user", content: JSON.stringify(userMsg) }
            ]
          });
          llmScore = JSON.parse(completion.choices[0].message.content!);
        } catch (error) {
          console.warn(`[Worker] LLM evaluation failed for ${candidateId}, using deterministic fallback:`, error);
          // Fall back to deterministic scorer
          llmScore = scoreDeterministic(role, cand);
        }

        // Upsert into screenings
        await pool.query(
          `INSERT INTO screenings(role_id, candidate_id, score_total, score_breakdown,
                                  must_haves_satisfied, missing_must_haves, knockout, reasons, flags)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (role_id, candidate_id)
           DO UPDATE SET score_total=EXCLUDED.score_total,
             score_breakdown=EXCLUDED.score_breakdown,
             must_haves_satisfied=EXCLUDED.must_haves_satisfied,
             missing_must_haves=EXCLUDED.missing_must_haves,
             knockout=EXCLUDED.knockout,
             reasons=EXCLUDED.reasons,
             flags=EXCLUDED.flags,
             created_at=now()`,
          [
            roleId,
            candidateId,
            llmScore.score_total ?? 0,
            JSON.stringify(llmScore.score_breakdown ?? {}),
            JSON.stringify(llmScore.must_haves_satisfied ?? []),
            JSON.stringify(llmScore.missing_must_haves ?? []),
            JSON.stringify(llmScore.knockout ?? { is_ko: false, reasons: [] }),
            JSON.stringify(llmScore.reasons ?? []),
            JSON.stringify(llmScore.flags ?? { red: [], yellow: [] })
          ]
        );

        console.log(`[Worker] Successfully screened candidate ${candidateId} for role ${roleId} (score: ${llmScore.score_total})`);

        return {
          success: true,
          roleId,
          candidateId,
          totalScore: llmScore.score_total,
        };
      } catch (error: any) {
        console.error(`[Worker] Failed to screen candidate ${candidateId} for role ${roleId}:`, error);
        throw error;
      }
    }
  },
  {
    connection,
    concurrency: 5, // Process up to 5 jobs concurrently
  }
);

// Deterministic fallback scorer
function scoreDeterministic(role: any, cand: any) {
  const weights = role.weights || {
    skills: 35,
    experience: 25,
    achievements: 15,
    education: 10,
    location_auth: 10,
    salary_availability: 5
  };
  
  const clamp = (v: number) => Math.max(0, Math.min(100, v));

  const skills = new Set<string>([
    ...(cand.skills_json?.technical || []),
    ...(cand.skills_json?.tools || []),
    ...(cand.skills_json?.soft || [])
  ].map((s: string) => s.toLowerCase()));

  const must = (role.must_have_skills || []).map((s: string) => s.toLowerCase());
  const nice = (role.nice_to_have_skills || []).map((s: string) => s.toLowerCase());
  const haveMust = must.filter((m: string) => skills.has(m));
  const haveNice = nice.filter((n: string) => skills.has(n));
  const skillsScore = clamp(
    (haveMust.length * 100 / (must.length || 1)) * 0.8 +
    (haveNice.length * 100 / (nice.length || 1)) * 0.2
  );

  // Crude experience heuristic
  const expYears = estimateYears(cand.experience || []);
  const expScore = clamp(
    Math.min(100, (expYears / (role.seniority?.toLowerCase().includes("senior") ? 7 : 3)) * 100)
  );

  // Achievements: count numeric tokens in bullets
  const achCount = (cand.experience || [])
    .flatMap((e: any) => e.bullets || [])
    .join(" ")
    .match(/\b(\d+%?|R\d+[kmb]?)/gi)?.length || 0;
  const achScore = clamp(Math.min(100, achCount * 12));

  const eduScore = 60 + Math.min(40, (cand.education || []).length * 20);
  const locScore = (role.location_city && cand.city &&
    role.location_city.toLowerCase() === cand.city.toLowerCase()) ? 100 : 60;
  const salScore = 70; // Unknown → neutral

  const total =
    skillsScore * (weights.skills / 100) +
    expScore * (weights.experience / 100) +
    achScore * (weights.achievements / 100) +
    eduScore * (weights.education / 100) +
    locScore * (weights.location_auth / 100) +
    salScore * (weights.salary_availability / 100);

  // KO if missing any must-have
  const missing = must.filter((m: string) => !skills.has(m));
  const is_ko = missing.length > 0 && (role.knockouts || []).includes("missing_must_have");

  return {
    score_total: Math.round(total),
    score_breakdown: {
      skills: Math.round(skillsScore),
      experience: Math.round(expScore),
      achievements: Math.round(achScore),
      education: Math.round(eduScore),
      location_auth: Math.round(locScore),
      salary_availability: Math.round(salScore)
    },
    must_haves_satisfied: haveMust,
    missing_must_haves: missing,
    knockout: { is_ko, reasons: is_ko ? ["Missing required skills"] : [] },
    reasons: [
      `${haveMust.length}/${must.length} must-haves present`,
      `~${expYears} yrs relevant experience`,
      `${achCount} quantified achievements detected`
    ],
    flags: {
      red: [],
      yellow: missing.length ? ["Missing some must-haves"] : []
    }
  };
}

function estimateYears(exps: any[]) {
  // Very rough: count roles, assume ~1.5y each if no dates
  if (!exps.length) return 0;
  const dated = exps.filter((e: any) => e.start_date || e.end_date);
  if (!dated.length) return Math.min(10, exps.length * 1.5);
  // Better parsing left out for brevity
  return Math.min(20, dated.length * 1.8);
}

// Worker event handlers
worker.on("completed", (job) => {
  console.log(`[Worker] Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err.message);
});

worker.on("error", (err) => {
  console.error("[Worker] Worker error:", err);
});

console.log("[Worker] Screening worker started successfully");

// Fraud Detection Worker
const fraudWorker = new Worker(
  "fraud-detection",
  async (job: Job) => {
    const { contentType, contentId, content, userId } = job.data;

    console.log(`[FraudWorker] Processing ${contentType} fraud detection for contentId ${contentId}`);

    try {
      // Run AI fraud detection
      const result = await detectFraud(contentType, content, userId);
      
      // Determine status
      let status = 'pending';
      if (shouldAutoApprove(result)) {
        status = 'auto_approved';
      }

      // Save detection result to database
      await pool.query(
        `INSERT INTO fraud_detections 
        (content_type, content_id, user_id, risk_level, risk_score, flags, ai_reasoning, content_snapshot, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (content_id, content_type) 
        DO UPDATE SET 
          risk_level = EXCLUDED.risk_level,
          risk_score = EXCLUDED.risk_score,
          flags = EXCLUDED.flags,
          ai_reasoning = EXCLUDED.ai_reasoning,
          status = EXCLUDED.status`,
        [
          contentType,
          contentId,
          userId || null,
          result.riskLevel,
          result.riskScore,
          result.flags,
          result.reasoning,
          JSON.stringify(content),
          status
        ]
      );

      console.log(`[FraudWorker] Completed ${contentType} detection: ${result.riskLevel} risk (score: ${result.riskScore})`);
      
      return { success: true, result };
    } catch (error: any) {
      console.error(`[FraudWorker] Failed to process fraud detection:`, error);
      throw error;
    }
  },
  {
    connection: connection!,
    concurrency: 3, // Process 3 fraud checks concurrently
  }
);

fraudWorker.on("completed", (job) => {
  console.log(`[FraudWorker] Job ${job.id} completed`);
});

fraudWorker.on("failed", (job, err) => {
  console.error(`[FraudWorker] Job ${job?.id} failed:`, err.message);
});

fraudWorker.on("error", (err) => {
  console.error("[FraudWorker] Worker error:", err);
});

console.log("[FraudWorker] Fraud detection worker started successfully");

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("[Worker] SIGTERM received, shutting down gracefully...");
  await worker.close();
  await fraudWorker.close();
  await connection?.quit();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("[Worker] SIGINT received, shutting down gracefully...");
  await worker.close();
  await fraudWorker.close();
  await connection?.quit();
  process.exit(0);
});
