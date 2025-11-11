import { Worker, Job } from "bullmq";
import { connection, isQueueAvailable } from "./queue";
import OpenAI from "openai";
import { detectFraud, shouldAutoApprove } from "./fraud-detection";
import { pool } from "./db-pool";

// Only start workers if Redis is available
if (!isQueueAvailable() || !connection) {
  console.log("[Workers] Redis not configured, background workers disabled");
  throw new Error("Redis not configured");
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

console.log("[Workers] Starting background workers...");

// Screening Worker
const screeningWorker = new Worker(
  "screening",
  async (job: Job) => {
    const { roleId, candidateId } = job.data;
    console.log(`[ScreeningWorker] Processing role ${roleId} for candidate ${candidateId}`);

    try {
      // Fetch role and candidate data
      const roleResult = await pool.query(
        `SELECT * FROM roles WHERE id = $1`,
        [roleId]
      );
      const candidateResult = await pool.query(
        `SELECT * FROM ats_candidates WHERE id = $1`,
        [candidateId]
      );

      if (!roleResult.rows[0] || !candidateResult.rows[0]) {
        throw new Error("Role or candidate not found");
      }

      const role = roleResult.rows[0];
      const candidate = candidateResult.rows[0];

      // Get candidate experiences, education, etc.
      const expResult = await pool.query(
        `SELECT * FROM ats_experiences WHERE candidate_id = $1 ORDER BY start_date DESC`,
        [candidateId]
      );
      const eduResult = await pool.query(
        `SELECT * FROM ats_education WHERE candidate_id = $1 ORDER BY start_date DESC`,
        [candidateId]
      );
      const skillsResult = await pool.query(
        `SELECT s.name FROM ats_candidate_skills cs 
         JOIN ats_skills s ON cs.skill_id = s.id 
         WHERE cs.candidate_id = $1`,
        [candidateId]
      );

      const experiences = expResult.rows;
      const education = eduResult.rows;
      const skills = skillsResult.rows.map(r => r.name);

      // Try AI evaluation first
      let evaluation;
      try {
        const prompt = `
Role: ${role.title}
Location: ${role.location || 'Not specified'}
Job Type: ${role.job_type || 'Not specified'}
Salary Range: ${role.salary_min && role.salary_max ? `${role.salary_min} - ${role.salary_max}` : 'Not specified'}
Must-Have Skills: ${(role.must_have_skills || []).join(', ')}
Nice-to-Have Skills: ${(role.nice_to_have_skills || []).join(', ')}
Knockout Criteria: ${(role.knockout_criteria || []).join('; ')}

Candidate: ${candidate.name}
Headline: ${candidate.headline || 'Not provided'}
Location: ${candidate.location || 'Not specified'}
Skills: ${skills.join(', ')}
Experiences: ${experiences.map(e => `${e.title} at ${e.company} (${e.start_date} - ${e.end_date || 'Present'})`).join('; ')}
Education: ${education.map(e => `${e.degree} in ${e.field_of_study} from ${e.institution}`).join('; ')}

Evaluate this candidate for the role.`;

        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt }
          ],
          response_format: { type: "json_object" },
          temperature: 0.3,
        });

        evaluation = JSON.parse(completion.choices[0].message.content || "{}");
      } catch (aiError) {
        console.log(`[ScreeningWorker] AI evaluation failed, using fallback:`, aiError);
        evaluation = fallbackEvaluation(role, candidate, skills, experiences, education);
      }

      // Calculate weighted total
      const weights = role.scoring_weights || {
        skills: 30,
        experience: 25,
        achievements: 15,
        education: 10,
        location_auth: 10,
        salary_availability: 10
      };

      const weightedTotal = Object.keys(weights).reduce((sum, key) => {
        return sum + (evaluation.score_breakdown[key] || 0) * (weights[key] / 100);
      }, 0);

      // Upsert screening result
      await pool.query(
        `INSERT INTO screenings 
        (role_id, candidate_id, score_total, score_skills, score_experience, score_achievements, 
         score_education, score_location_auth, score_salary_availability, score_weighted_total,
         must_haves_satisfied, missing_must_haves, is_knockout, knockout_reasons, 
         evaluation_reasons, red_flags, yellow_flags)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT (role_id, candidate_id) 
        DO UPDATE SET
          score_total = EXCLUDED.score_total,
          score_skills = EXCLUDED.score_skills,
          score_experience = EXCLUDED.score_experience,
          score_achievements = EXCLUDED.score_achievements,
          score_education = EXCLUDED.score_education,
          score_location_auth = EXCLUDED.score_location_auth,
          score_salary_availability = EXCLUDED.score_salary_availability,
          score_weighted_total = EXCLUDED.score_weighted_total,
          must_haves_satisfied = EXCLUDED.must_haves_satisfied,
          missing_must_haves = EXCLUDED.missing_must_haves,
          is_knockout = EXCLUDED.is_knockout,
          knockout_reasons = EXCLUDED.knockout_reasons,
          evaluation_reasons = EXCLUDED.evaluation_reasons,
          red_flags = EXCLUDED.red_flags,
          yellow_flags = EXCLUDED.yellow_flags,
          evaluated_at = CURRENT_TIMESTAMP`,
        [
          roleId,
          candidateId,
          evaluation.score_total || 0,
          evaluation.score_breakdown?.skills || 0,
          evaluation.score_breakdown?.experience || 0,
          evaluation.score_breakdown?.achievements || 0,
          evaluation.score_breakdown?.education || 0,
          evaluation.score_breakdown?.location_auth || 0,
          evaluation.score_breakdown?.salary_availability || 0,
          weightedTotal,
          evaluation.must_haves_satisfied || [],
          evaluation.missing_must_haves || [],
          evaluation.knockout?.is_ko || false,
          evaluation.knockout?.reasons || [],
          evaluation.reasons || [],
          evaluation.flags?.red || [],
          evaluation.flags?.yellow || []
        ]
      );

      console.log(`[ScreeningWorker] Completed screening: ${weightedTotal.toFixed(1)} score`);
      return { success: true, score: weightedTotal };
    } catch (error: any) {
      console.error(`[ScreeningWorker] Failed:`, error);
      throw error;
    }
  },
  {
    connection: connection!,
    concurrency: 5,
  }
);

// Fraud Detection Worker - PAUSED (will be enabled later)
// const fraudWorker = new Worker(
//   "fraud-detection",
//   async (job: Job) => {
//     const { contentType, contentId, content, userId } = job.data;

//     console.log(`[FraudWorker] Processing ${contentType} fraud detection for contentId ${contentId}`);

//     try {
//       const result = await detectFraud(contentType, content, userId);
      
//       // Only auto-approve if fraud detection actually ran successfully
//       let status = 'pending';
//       if (result.reasoning !== 'Auto-approved: AI detection unavailable' && shouldAutoApprove(result)) {
//         status = 'auto_approved';
//       }

//       try {
//         await pool.query(
//           `INSERT INTO fraud_detections 
//           (content_type, content_id, user_id, risk_level, risk_score, flags, ai_reasoning, content_snapshot, status)
//           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
//           ON CONFLICT (content_id, content_type) 
//           DO UPDATE SET 
//             risk_level = EXCLUDED.risk_level,
//             risk_score = EXCLUDED.risk_score,
//             flags = EXCLUDED.flags,
//             ai_reasoning = EXCLUDED.ai_reasoning,
//             status = EXCLUDED.status`,
//           [
//             contentType,
//             contentId,
//             userId || null,
//             result.riskLevel,
//             result.riskScore,
//             result.flags,
//             result.reasoning,
//             JSON.stringify(content),
//             status
//           ]
//         );
        
//         console.log(`[FraudWorker] Completed ${contentType} detection: ${result.riskLevel} risk (score: ${result.riskScore}), status: ${status}`);
//       } catch (dbError: any) {
//         console.error(`[FraudWorker] Database error (non-fatal):`, dbError.message);
//         console.warn(`[FraudWorker] ALERT: Fraud detection result not saved for ${contentType} ${contentId}`);
//         // Don't fail the job - fraud detection is supplementary, but log for ops
//       }
      
//       return { success: true, result };
//     } catch (error: any) {
//       console.error(`[FraudWorker] ALERT: Fraud detection failed for ${contentType} ${contentId}:`, error.message);
//       // Return success so job creation doesn't fail, but don't create a fraud detection record
//       // This leaves content without fraud screening until issue is resolved
//       return { success: true, result: null };
//     }
//   },
//   {
//     connection: connection!,
//     concurrency: 3,
//   }
// );

// Event handlers
screeningWorker.on("completed", (job) => {
  console.log(`[ScreeningWorker] Job ${job.id} completed`);
});

screeningWorker.on("failed", (job, err) => {
  console.error(`[ScreeningWorker] Job ${job?.id} failed:`, err.message);
});

// fraudWorker.on("completed", (job) => {
//   console.log(`[FraudWorker] Job ${job.id} completed`);
// });

// fraudWorker.on("failed", (job, err) => {
//   console.error(`[FraudWorker] Job ${job?.id} failed:`, err.message);
// });

console.log("[Workers] Screening worker started successfully (fraud detection paused)");

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("[Workers] SIGTERM received, shutting down...");
  await screeningWorker.close();
  // await fraudWorker.close(); // Paused
  await connection?.quit();
});

process.on("SIGINT", async () => {
  console.log("[Workers] SIGINT received, shutting down...");
  await screeningWorker.close();
  // await fraudWorker.close(); // Paused
  await connection?.quit();
});

// Fallback evaluation function
function fallbackEvaluation(role: any, candidate: any, skills: string[], experiences: any[], education: any[]) {
  const mustHaves = role.must_have_skills || [];
  const mustHavesSatisfied = mustHaves.filter((skill: string) => 
    skills.some(s => s.toLowerCase().includes(skill.toLowerCase()))
  );
  const missingMustHaves = mustHaves.filter((skill: string) => 
    !skills.some(s => s.toLowerCase().includes(skill.toLowerCase()))
  );

  const skillScore = mustHaves.length > 0 ? (mustHavesSatisfied.length / mustHaves.length) * 100 : 50;
  const experienceYears = estimateYears(experiences);
  const experienceScore = Math.min(100, experienceYears * 10);
  const educationScore = education.length > 0 ? 70 : 40;

  const totalScore = (skillScore * 0.4) + (experienceScore * 0.4) + (educationScore * 0.2);

  return {
    score_total: Math.round(totalScore),
    score_breakdown: {
      skills: Math.round(skillScore),
      experience: Math.round(experienceScore),
      achievements: 50,
      education: Math.round(educationScore),
      location_auth: 50,
      salary_availability: 50
    },
    must_haves_satisfied: mustHavesSatisfied,
    missing_must_haves: missingMustHaves,
    knockout: {
      is_ko: missingMustHaves.length > mustHaves.length / 2,
      reasons: missingMustHaves.length > mustHaves.length / 2 
        ? [`Missing critical skills: ${missingMustHaves.join(', ')}`]
        : []
    },
    reasons: [`Fallback evaluation based on skills match and experience`],
    flags: {
      red: [],
      yellow: missingMustHaves.length > 0 ? [`Missing some must-have skills`] : []
    }
  };
}

function estimateYears(exps: any[]) {
  if (!exps.length) return 0;
  const dated = exps.filter((e: any) => e.start_date || e.end_date);
  if (!dated.length) return Math.min(10, exps.length * 1.5);
  return Math.min(20, dated.length * 1.8);
}
