/**
 * LLM Re-Ranker
 * 
 * Uses GPT-4o to re-rank job matches and generate human-readable explanations.
 * Takes top heuristic matches and produces final scores with reasons and risks.
 */

import OpenAI from "openai";
import type { JobMatch } from "./matching";

let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }
    openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY 
    });
  }
  return openai;
}

/**
 * Re-ranked job result with LLM insights
 */
export interface RerankedJob {
  jobId: string;
  job: any;
  scores: {
    heuristic: number;
    llm: number;
    final: number;
    breakdown: {
      vecSimilarity: number;
      skillsJaccard: number;
      titleSimilarity: number;
      distanceKm?: number;
      salaryAlignment: number;
      seniorityAlignment: number;
      typeArrangement: number;
      recency: number;
    };
  };
  explanation: string;
  risks?: string;
  highlightedSkills: string[];
}

/**
 * LLM re-ranker response schema
 */
interface LLMRerankResult {
  job_id: string;
  llm_score: number;
  explanation: string;
  risks?: string;
  highlighted_skills: string[];
}

/**
 * Re-rank jobs using LLM
 * Takes top matches and generates explanations + refined scores
 * 
 * @param matches - Top job matches from heuristic scoring
 * @param candidateProfile - Candidate profile data
 * @param preferences - Search preferences
 * @param topK - Number of results to return (default 10)
 * @returns Promise<RerankedJob[]> - Re-ranked jobs with explanations
 */
export async function rerankMatches(
  matches: JobMatch[],
  candidateProfile: any,
  preferences: any,
  topK: number = 10
): Promise<RerankedJob[]> {
  console.log(`[Reranker] Re-ranking ${matches.length} jobs`);

  if (matches.length === 0) {
    return [];
  }

  // Take top 50 for LLM re-ranking (to manage token costs)
  const topMatches = matches.slice(0, Math.min(50, matches.length));

  // Build candidate profile summary
  const candidateSummary = {
    jobTitles: preferences.jobTitles || [candidateProfile.jobTitle],
    skills: candidateProfile.skills || [],
    experienceLevel: preferences.seniorityTarget || candidateProfile.experienceLevel,
    location: {
      city: preferences.locationCity || candidateProfile.city,
      province: preferences.locationProvince || candidateProfile.province,
      radiusKm: preferences.radiusKm || 50
    },
    employmentTypes: preferences.employmentTypes || [],
    workArrangements: preferences.workArrangements || [],
    salary: {
      min: preferences.salaryMin,
      max: preferences.salaryMax
    }
  };

  // Build job snippets for LLM
  const jobSnippets = topMatches.map(match => {
    const core = (match.job.core as any) || {};
    const roleDetails = (match.job.roleDetails as any) || {};
    const compensation = (match.job.compensation as any) || {};

    return {
      job_id: match.jobId,
      title: match.job.title,
      company: match.job.company,
      location: match.job.location,
      seniority: core.seniority,
      employment_type: match.job.employmentType,
      work_arrangement: core.workArrangement,
      skills_required: roleDetails.requiredSkills || [],
      skills_nice: roleDetails.niceToHaveSkills || [],
      salary_min: match.job.salaryMin || compensation.min,
      salary_max: match.job.salaryMax || compensation.max,
      distance_km: match.scores.distanceKm,
      vec_sim: match.scores.vecSimilarity,
      skills_jaccard: match.scores.skillsJaccard,
      title_sim: match.scores.titleSimilarity,
      recency: match.scores.recency,
      heuristic_score: match.scores.heuristic
    };
  });

  // Call LLM for re-ranking
  try {
    const llmResults = await callLLMReranker(candidateSummary, jobSnippets);

    // Combine heuristic and LLM scores
    const rerankedJobs: RerankedJob[] = [];

    for (const match of topMatches) {
      const llmResult = llmResults.find(r => r.job_id === match.jobId);
      
      if (!llmResult) {
        // If LLM didn't rank this job, use heuristic score only
        rerankedJobs.push({
          jobId: match.jobId,
          job: match.job,
          scores: {
            heuristic: match.scores.heuristic,
            llm: match.scores.heuristic, // Fallback to heuristic
            final: match.scores.heuristic,
            breakdown: {
              vecSimilarity: match.scores.vecSimilarity,
              skillsJaccard: match.scores.skillsJaccard,
              titleSimilarity: match.scores.titleSimilarity,
              distanceKm: match.scores.distanceKm,
              salaryAlignment: match.scores.salaryAlignment,
              seniorityAlignment: match.scores.seniorityAlignment,
              typeArrangement: match.scores.typeArrangement,
              recency: match.scores.recency
            }
          },
          explanation: "Good match based on skills and experience",
          highlightedSkills: []
        });
        continue;
      }

      // Calculate final score: 70% heuristic + 30% LLM
      const finalScore = Math.round(
        0.7 * match.scores.heuristic + 0.3 * llmResult.llm_score
      );

      rerankedJobs.push({
        jobId: match.jobId,
        job: match.job,
        scores: {
          heuristic: match.scores.heuristic,
          llm: llmResult.llm_score,
          final: finalScore,
          breakdown: {
            vecSimilarity: match.scores.vecSimilarity,
            skillsJaccard: match.scores.skillsJaccard,
            titleSimilarity: match.scores.titleSimilarity,
            distanceKm: match.scores.distanceKm,
            salaryAlignment: match.scores.salaryAlignment,
            seniorityAlignment: match.scores.seniorityAlignment,
            typeArrangement: match.scores.typeArrangement,
            recency: match.scores.recency
          }
        },
        explanation: llmResult.explanation,
        risks: llmResult.risks,
        highlightedSkills: llmResult.highlighted_skills
      });
    }

    // Sort by final score and return top K
    rerankedJobs.sort((a, b) => b.scores.final - a.scores.final);
    
    console.log(`[Reranker] Returning top ${topK} re-ranked jobs`);
    
    return rerankedJobs.slice(0, topK);

  } catch (error) {
    console.error("[Reranker] Error calling LLM:", error);
    
    // Fallback: return original matches sorted by heuristic score
    return topMatches.slice(0, topK).map(match => ({
      jobId: match.jobId,
      job: match.job,
      scores: {
        heuristic: match.scores.heuristic,
        llm: match.scores.heuristic,
        final: match.scores.heuristic,
        breakdown: {
          vecSimilarity: match.scores.vecSimilarity,
          skillsJaccard: match.scores.skillsJaccard,
          titleSimilarity: match.scores.titleSimilarity,
          distanceKm: match.scores.distanceKm,
          salaryAlignment: match.scores.salaryAlignment,
          seniorityAlignment: match.scores.seniorityAlignment,
          typeArrangement: match.scores.typeArrangement,
          recency: match.scores.recency
        }
      },
      explanation: "Matched based on skills, experience, and preferences",
      highlightedSkills: []
    }));
  }
}

/**
 * Call OpenAI GPT-4o for re-ranking
 * Returns structured JSON with scores and explanations
 */
async function callLLMReranker(
  candidate: any,
  jobs: any[]
): Promise<LLMRerankResult[]> {
  const systemPrompt = `You are an expert technical recruiter for the South African job market. Re-rank job matches for a candidate.

Rules:
- Consider title match, must-have skills, transferable skills, seniority, location and radius rules, salary fit, employment type, work arrangement, and posting recency
- Do not invent facts. Use only the provided fields
- Output JSON only per the schema. No prose
- Prefer roles within the candidate's radius unless remote is allowed by both
- Short explanations: <= 320 chars. Include 2-4 skills from the overlap
- Risks: <= 200 chars. Mention gaps or concerns
- highlighted_skills: Array of 2-5 key matching skills from the candidate's skillset`;

  const userPrompt = `Candidate Profile:
${JSON.stringify(candidate, null, 2)}

Jobs to Rank (top ${jobs.length}):
${JSON.stringify(jobs, null, 2)}

Output JSON schema:
{
  "results": [
    {
      "job_id": "uuid",
      "llm_score": 0-100,
      "explanation": "string (<= 320 chars)",
      "risks": "string (<= 200 chars)",
      "highlighted_skills": ["skill1", "skill2", ...]
    }
  ]
}`;

  const response = await getOpenAIClient().chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    response_format: { type: "json_object" },
    temperature: 0.3, // Lower temperature for more consistent scoring
  });

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error("No response from LLM");
  }

  const parsed = JSON.parse(content);
  return parsed.results || [];
}
