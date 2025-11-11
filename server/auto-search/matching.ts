/**
 * Auto Search Matching Pipeline
 * 
 * Core matching logic for the AI-powered job recommendation system.
 * Combines vector similarity, hard filters, and heuristic scoring.
 */

import { db } from "../db";
import { jobs, jobEmbeddings, candidateProfiles, candidateEmbeddings } from "@shared/schema";
import { eq, and, or, sql, inArray } from "drizzle-orm";
import {
  jaccard,
  haversineKm,
  salaryAlignment,
  seniorityAlignment,
  typeArrangementMatch,
  recencyScore,
  heuristicScore,
  cosineSimilarity,
  type HeuristicFeatures
} from "./utils";
import { generateEmbedding, getCandidateEmbedding, indexCandidateProfile } from "../embeddings";

/**
 * Candidate search preferences
 */
export interface SearchPreferences {
  userId: string;
  jobTitles?: string[];
  location?: {
    city?: string;
    province?: string;
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
    enforceRadius?: boolean;
  };
  employmentTypes?: string[];
  workArrangements?: string[];
  seniorityTarget?: string;
  salary?: {
    min?: number;
    max?: number;
    enforce?: boolean;
  };
  topK?: number;
}

/**
 * Matched job with scores and details
 */
export interface JobMatch {
  jobId: string;
  job: any; // Full job data
  scores: {
    heuristic: number;
    vecSimilarity: number;
    skillsJaccard: number;
    titleSimilarity: number;
    distanceKm?: number;
    salaryAlignment: number;
    seniorityAlignment: number;
    typeArrangement: number;
    recency: number;
  };
}

/**
 * Main matching pipeline
 * Retrieves and scores jobs for a candidate based on their preferences
 * 
 * @param preferences - Candidate search preferences
 * @returns Promise<JobMatch[]> - Top matching jobs with scores
 */
export async function matchJobs(preferences: SearchPreferences): Promise<JobMatch[]> {
  console.log(`[Matching] Starting job match for user ${preferences.userId}`);

  // 1. Get candidate profile and embedding
  const candidateProfile = await db.query.candidateProfiles.findFirst({
    where: eq(candidateProfiles.userId, preferences.userId),
  });

  if (!candidateProfile) {
    throw new Error(`Candidate profile not found for user ${preferences.userId}`);
  }

  // Get candidate embedding, generate if missing
  let candidateEmbedding = await getCandidateEmbedding(candidateProfile.id);
  
  if (!candidateEmbedding) {
    console.warn(`[Matching] No embedding found for candidate profile ${candidateProfile.id}, generating now...`);
    
    // Generate embedding for this candidate profile
    const success = await indexCandidateProfile(candidateProfile.id);
    
    if (!success) {
      throw new Error(`Failed to generate embedding for candidate profile ${candidateProfile.id}. Cannot proceed with job matching.`);
    }
    
    // Retrieve the newly generated embedding
    candidateEmbedding = await getCandidateEmbedding(candidateProfile.id);
    
    if (!candidateEmbedding) {
      throw new Error(`Embedding generation succeeded but retrieval failed for candidate ${candidateProfile.id}`);
    }
    
    console.log(`[Matching] Successfully generated embedding for candidate ${candidateProfile.id}`);
  }

  // 2. Build query embedding from preferences + candidate profile
  const queryText = buildQueryText(candidateProfile, preferences);
  const queryEmbedding = await generateEmbedding(queryText);

  // 3. Fetch all job embeddings and jobs
  const allJobEmbeddings = await db.select().from(jobEmbeddings);
  
  console.log(`[Matching] Found ${allJobEmbeddings.length} job embeddings`);

  // 4. Calculate vector similarities and apply hard filters
  const jobSimilarities: Array<{ jobId: string; similarity: number }> = [];

  for (const jobEmb of allJobEmbeddings) {
    const jobEmbVector = JSON.parse(jobEmb.embedding);
    const similarity = cosineSimilarity(queryEmbedding, jobEmbVector);
    jobSimilarities.push({ jobId: jobEmb.jobId, similarity });
  }

  // Sort by similarity and take top 200
  jobSimilarities.sort((a, b) => b.similarity - a.similarity);
  const topJobIds = jobSimilarities.slice(0, 200).map(j => j.jobId);

  console.log(`[Matching] Top 200 jobs by vector similarity`);

  // 5. Fetch job details with filters
  const whereConditions: any[] = [
    inArray(jobs.id, topJobIds)
  ];

  // Hard filters based on preferences
  if (preferences.employmentTypes && preferences.employmentTypes.length > 0) {
    whereConditions.push(
      or(...preferences.employmentTypes.map(type => 
        eq(jobs.employmentType, type)
      ))
    );
  }

  // Note: Work arrangement is in core JSONB, we'll filter in-memory for now
  // Note: Location radius filtering will be done in-memory with haversine

  const matchedJobs = await db.select().from(jobs).where(and(...whereConditions));

  console.log(`[Matching] Found ${matchedJobs.length} jobs after hard filters`);

  // 6. Calculate heuristic scores for each job
  const jobMatches: JobMatch[] = [];

  for (const job of matchedJobs) {
    const simEntry = jobSimilarities.find(j => j.jobId === job.id);
    if (!simEntry) continue;

    // Extract job fields
    const core = (job.core as any) || {};
    const roleDetails = (job.roleDetails as any) || {};
    const compensation = (job.compensation as any) || {};

    // Calculate distance if location is provided
    let distanceKm: number | undefined;
    if (preferences.location?.latitude && preferences.location?.longitude) {
      // Try to get job location from various sources
      // For now, we'll skip distance calculation if job doesn't have coordinates
      // In production, you'd geocode job.location to get coordinates
      distanceKm = undefined;
    }

    // Apply radius filter if enforced
    if (preferences.location?.enforceRadius && distanceKm !== undefined) {
      const maxRadius = preferences.location.radiusKm || 50;
      if (distanceKm > maxRadius) {
        continue; // Skip this job
      }
    }

    // Calculate skills overlap
    const jobSkills = [
      ...(roleDetails.requiredSkills || []),
      ...(roleDetails.niceToHaveSkills || [])
    ];
    const candidateSkills = candidateProfile.skills || [];
    const skillsJac = jaccard(candidateSkills, jobSkills);

    // Calculate title similarity (simplified - just check if any preference title matches)
    const titleSim = preferences.jobTitles && preferences.jobTitles.length > 0
      ? preferences.jobTitles.some(t => 
          job.title.toLowerCase().includes(t.toLowerCase())
        ) ? 0.8 : 0.3
      : 0.5;

    // Calculate salary alignment
    const jobSalaryMin = job.salaryMin || compensation.min;
    const jobSalaryMax = job.salaryMax || compensation.max;
    const salaryAlign = salaryAlignment(
      jobSalaryMin,
      jobSalaryMax,
      preferences.salary?.min,
      preferences.salary?.max
    );

    // Apply salary filter if enforced
    if (preferences.salary?.enforce && salaryAlign < 0.5) {
      continue; // Skip this job
    }

    // Calculate seniority alignment
    const jobSeniority = core.seniority || candidateProfile.experienceLevel;
    const seniorityAlign = seniorityAlignment(
      jobSeniority,
      preferences.seniorityTarget || candidateProfile.experienceLevel
    );

    // Calculate type/arrangement match
    const typeArrange = typeArrangementMatch(
      job.employmentType,
      core.workArrangement,
      preferences.employmentTypes,
      preferences.workArrangements
    );

    // Calculate recency score
    const recency = recencyScore(new Date(job.createdAt));

    // Build heuristic features
    const features: HeuristicFeatures = {
      vecSim: simEntry.similarity,
      skillsJac,
      titleSim,
      distKm: distanceKm,
      salaryAlign,
      seniorityAlign,
      typeArrange,
      recency
    };

    // Calculate final heuristic score
    const heurScore = heuristicScore(features);

    jobMatches.push({
      jobId: job.id,
      job,
      scores: {
        heuristic: heurScore,
        vecSimilarity: simEntry.similarity,
        skillsJaccard: skillsJac,
        titleSimilarity: titleSim,
        distanceKm,
        salaryAlignment: salaryAlign,
        seniorityAlignment: seniorityAlign,
        typeArrangement: typeArrange,
        recency
      }
    });
  }

  // 7. Sort by heuristic score and return top K
  jobMatches.sort((a, b) => b.scores.heuristic - a.scores.heuristic);
  const topK = preferences.topK || 20;
  
  console.log(`[Matching] Returning top ${topK} matches`);
  
  return jobMatches.slice(0, topK);
}

/**
 * Build query text from candidate profile and preferences
 * This creates a rich text representation for embedding generation
 */
function buildQueryText(candidateProfile: any, preferences: SearchPreferences): string {
  const parts: string[] = [];

  // Add job title preferences
  if (preferences.jobTitles && preferences.jobTitles.length > 0) {
    parts.push(`Looking for: ${preferences.jobTitles.join(", ")}`);
  } else if (candidateProfile.jobTitle) {
    parts.push(`Current role: ${candidateProfile.jobTitle}`);
  }

  // Add candidate skills
  if (candidateProfile.skills && candidateProfile.skills.length > 0) {
    parts.push(`Skills: ${candidateProfile.skills.join(", ")}`);
  }

  // Add experience level
  if (preferences.seniorityTarget) {
    parts.push(`Seniority level: ${preferences.seniorityTarget}`);
  } else if (candidateProfile.experienceLevel) {
    parts.push(`Experience level: ${candidateProfile.experienceLevel}`);
  }

  // Add location preferences
  if (preferences.location?.city) {
    parts.push(`Preferred location: ${preferences.location.city}`);
  } else if (candidateProfile.city) {
    parts.push(`Located in: ${candidateProfile.city}`);
  }

  // Add employment type preferences
  if (preferences.employmentTypes && preferences.employmentTypes.length > 0) {
    parts.push(`Employment type: ${preferences.employmentTypes.join(", ")}`);
  }

  // Add work arrangement preferences
  if (preferences.workArrangements && preferences.workArrangements.length > 0) {
    parts.push(`Work arrangement: ${preferences.workArrangements.join(", ")}`);
  }

  return parts.join("\n");
}
