import OpenAI from "openai";
import { db } from "./db";
import { 
  resumes, 
  candidates, 
  experiences,
  education,
  projects,
  skills,
  candidateSkills,
  candidateEmbeddings,
  candidateProfiles,
  jobs,
  jobEmbeddings
} from "@shared/schema";
import { eq } from "drizzle-orm";

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
 * Generate and store embedding for a candidate using OpenAI's embedding model
 * @param candidateId - UUID of the candidate to index
 * @returns Promise<boolean> - Returns true if successful, false otherwise
 */
export async function indexCandidate(candidateId: string): Promise<boolean> {
  try {
    console.log(`[Embeddings] Generating embedding for candidate: ${candidateId}`);

    // Fetch candidate data
    const candidateData = await db.query.candidates.findFirst({
      where: eq(candidates.id, candidateId),
    });

    if (!candidateData) {
      console.error(`[Embeddings] Candidate not found: ${candidateId}`);
      return false;
    }

    // Fetch related experiences
    const experiencesData = await db.query.experiences.findMany({
      where: eq(experiences.candidateId, candidateId),
    });

    // Fetch related skills
    const candidateSkillsData = await db.query.candidateSkills.findMany({
      where: eq(candidateSkills.candidateId, candidateId),
      with: {
        skill: true,
      },
    });

    // Fetch education
    const educationData = await db.query.education.findMany({
      where: eq(education.candidateId, candidateId),
    });

    // Fetch projects
    const projectsData = await db.query.projects.findMany({
      where: eq(projects.candidateId, candidateId),
    });

    // Build text representation of candidate for embedding
    const textParts: string[] = [];

    // Add headline/title
    if (candidateData.headline) {
      textParts.push(candidateData.headline);
    }

    // Add summary
    if (candidateData.summary) {
      textParts.push(candidateData.summary);
    }

    // Add location context
    const locationParts = [];
    if (candidateData.city) locationParts.push(candidateData.city);
    if (candidateData.country) locationParts.push(candidateData.country);
    if (locationParts.length > 0) {
      textParts.push(`Location: ${locationParts.join(", ")}`);
    }

    // Add skills
    const skillsList = candidateSkillsData
      .map((cs: any) => cs.skill?.name)
      .filter(Boolean)
      .join(", ");
    
    if (skillsList) {
      textParts.push(`Skills: ${skillsList}`);
    }

    // Add experience roles
    const experiencesList = experiencesData
      .map((exp) => {
        const parts = [exp.title];
        if (exp.company) parts.push(`at ${exp.company}`);
        // Add bullet points if available
        if (exp.bullets && exp.bullets.length > 0) {
          parts.push(exp.bullets.join(" "));
        }
        return parts.join(" ");
      })
      .filter(Boolean)
      .join("; ");

    if (experiencesList) {
      textParts.push(`Experience: ${experiencesList}`);
    }

    // Add education
    const educationList = educationData
      .map((edu) => {
        const parts = [];
        if (edu.qualification) parts.push(edu.qualification);
        if (edu.institution) parts.push(`from ${edu.institution}`);
        if (edu.location) parts.push(`in ${edu.location}`);
        return parts.join(" ");
      })
      .filter(Boolean)
      .join("; ");

    if (educationList) {
      textParts.push(`Education: ${educationList}`);
    }

    // Add projects
    const projectsList = projectsData
      .map((proj) => {
        const parts = [];
        if (proj.name) parts.push(proj.name);
        if (proj.what) parts.push(proj.what);
        if (proj.impact) parts.push(proj.impact);
        return parts.join(" - ");
      })
      .filter(Boolean)
      .join("; ");

    if (projectsList) {
      textParts.push(`Projects: ${projectsList}`);
    }

    // Combine all text
    const text = textParts.join("\n");

    if (!text.trim()) {
      console.warn(`[Embeddings] No text content for candidate ${candidateId}, skipping embedding`);
      return false;
    }

    console.log(`[Embeddings] Generating embedding for ${text.length} characters of text`);

    // Generate embedding using OpenAI
    const embeddingResponse = await getOpenAIClient().embeddings.create({
      model: "text-embedding-3-small",
      input: text
    });

    const embedding = embeddingResponse.data[0].embedding;

    // Store embedding as JSON string (for compatibility with text column)
    const embeddingJson = JSON.stringify(embedding);

    // Insert or update embedding
    await db
      .insert(candidateEmbeddings)
      .values({
        candidateId,
        embedding: embeddingJson
      })
      .onConflictDoUpdate({
        target: candidateEmbeddings.candidateId,
        set: {
          embedding: embeddingJson
        }
      });

    console.log(`[Embeddings] Successfully generated and stored embedding for candidate: ${candidateId}`);
    return true;

  } catch (error) {
    console.error(`[Embeddings] Error indexing candidate ${candidateId}:`, error);
    return false;
  }
}

/**
 * Generate and store embedding for an individual candidate profile
 * Used for Auto Job Search feature
 * @param candidateProfileId - UUID of the candidate profile to index
 * @returns Promise<boolean> - Returns true if successful, false otherwise
 */
export async function indexCandidateProfile(candidateProfileId: string): Promise<boolean> {
  try {
    console.log(`[Embeddings] Generating embedding for candidate profile: ${candidateProfileId}`);

    // Fetch candidate profile data
    const profile = await db.query.candidateProfiles.findFirst({
      where: eq(candidateProfiles.id, candidateProfileId),
    });

    if (!profile) {
      console.error(`[Embeddings] Candidate profile not found: ${candidateProfileId}`);
      return false;
    }

    // Fetch resume data
    const resume = await db.query.resumes.findFirst({
      where: eq(resumes.candidateId, candidateProfileId),
    });

    // Build text representation for embedding
    const textParts: string[] = [];

    // Add full name and job title
    if (profile.fullName) {
      textParts.push(profile.fullName);
    }
    if (profile.jobTitle) {
      textParts.push(`Job Title: ${profile.jobTitle}`);
    }

    // Add experience level
    if (profile.experienceLevel) {
      textParts.push(`Experience Level: ${profile.experienceLevel}`);
    }

    // Add location
    const locationParts = [];
    if (profile.city) locationParts.push(profile.city);
    if (profile.province) locationParts.push(profile.province);
    if (profile.country) locationParts.push(profile.country);
    if (locationParts.length > 0) {
      textParts.push(`Location: ${locationParts.join(", ")}`);
    }

    // Add skills
    if (profile.skills && profile.skills.length > 0) {
      textParts.push(`Skills: ${profile.skills.join(", ")}`);
    }

    // Add resume content if available
    if (resume?.rawText) {
      textParts.push(`Resume: ${resume.rawText}`);
    }

    // Combine all parts
    const text = textParts.join("\n");

    if (!text.trim()) {
      console.error(`[Embeddings] No content available for candidate profile: ${candidateProfileId}`);
      return false;
    }

    // Generate embedding using OpenAI
    const embeddingResponse = await getOpenAIClient().embeddings.create({
      model: "text-embedding-3-small",
      input: text
    });

    const embedding = embeddingResponse.data[0].embedding;

    // Store embedding as JSON string
    const embeddingJson = JSON.stringify(embedding);

    // Insert or update embedding
    await db
      .insert(candidateEmbeddings)
      .values({
        candidateId: candidateProfileId,
        embedding: embeddingJson
      })
      .onConflictDoUpdate({
        target: candidateEmbeddings.candidateId,
        set: {
          embedding: embeddingJson
        }
      });

    console.log(`[Embeddings] Successfully generated and stored embedding for candidate profile: ${candidateProfileId}`);
    return true;

  } catch (error) {
    console.error(`[Embeddings] Error indexing candidate profile ${candidateProfileId}:`, error);
    return false;
  }
}

/**
 * Check if OpenAI API is configured for embeddings
 */
export function isEmbeddingsConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

/**
 * Batch index multiple candidates
 * @param candidateIds - Array of candidate UUIDs to index
 * @returns Promise<{ successful: number, failed: number }>
 */
export async function batchIndexCandidates(
  candidateIds: string[]
): Promise<{ successful: number; failed: number }> {
  console.log(`[Embeddings] Batch indexing ${candidateIds.length} candidates`);
  
  let successful = 0;
  let failed = 0;

  for (const candidateId of candidateIds) {
    const result = await indexCandidate(candidateId);
    if (result) {
      successful++;
    } else {
      failed++;
    }
  }

  console.log(`[Embeddings] Batch complete: ${successful} successful, ${failed} failed`);
  return { successful, failed };
}

/**
 * Generate embedding from raw text using OpenAI
 * Generic helper function for embedding generation
 * 
 * @param text - Text content to embed
 * @returns Promise<number[]> - Embedding vector
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || !text.trim()) {
    throw new Error("Cannot generate embedding for empty text");
  }

  const embeddingResponse = await getOpenAIClient().embeddings.create({
    model: "text-embedding-3-small",
    input: text
  });

  return embeddingResponse.data[0].embedding;
}

/**
 * Generate and store embedding for a job posting
 * Combines title, description, responsibilities, and skills
 * 
 * @param jobId - UUID of the job to index
 * @returns Promise<boolean> - Returns true if successful, false otherwise
 */
export async function indexJob(jobId: string): Promise<boolean> {
  try {
    console.log(`[Embeddings] Generating embedding for job: ${jobId}`);

    // Fetch job data
    const jobData = await db.query.jobs.findFirst({
      where: eq(jobs.id, jobId),
    });

    if (!jobData) {
      console.error(`[Embeddings] Job not found: ${jobId}`);
      return false;
    }

    // Build text representation of job for embedding
    const textParts: string[] = [];

    // Add title
    if (jobData.title) {
      textParts.push(jobData.title);
    }

    // Add company
    if (jobData.company) {
      textParts.push(`Company: ${jobData.company}`);
    }

    // Add location
    if (jobData.location) {
      textParts.push(`Location: ${jobData.location}`);
    }

    // Add seniority from core JSONB
    if (jobData.core && typeof jobData.core === 'object') {
      const core = jobData.core as any;
      if (core.seniority) {
        textParts.push(`Seniority: ${core.seniority}`);
      }
      if (core.summary) {
        textParts.push(core.summary);
      }
      if (core.department) {
        textParts.push(`Department: ${core.department}`);
      }
      if (core.workArrangement) {
        textParts.push(`Work Arrangement: ${core.workArrangement}`);
      }
    }

    // Add employment type
    if (jobData.employmentType) {
      textParts.push(`Employment Type: ${jobData.employmentType}`);
    }

    // Add industry
    if (jobData.industry) {
      textParts.push(`Industry: ${jobData.industry}`);
    }

    // Add description
    if (jobData.description) {
      textParts.push(jobData.description);
    }

    // Add requirements
    if (jobData.requirements) {
      textParts.push(`Requirements: ${jobData.requirements}`);
    }

    // Add role details from JSONB
    if (jobData.roleDetails && typeof jobData.roleDetails === 'object') {
      const roleDetails = jobData.roleDetails as any;
      
      if (roleDetails.keyResponsibilities && Array.isArray(roleDetails.keyResponsibilities)) {
        textParts.push(`Responsibilities: ${roleDetails.keyResponsibilities.join("; ")}`);
      }
      
      if (roleDetails.requiredSkills && Array.isArray(roleDetails.requiredSkills)) {
        textParts.push(`Required Skills: ${roleDetails.requiredSkills.join(", ")}`);
      }
      
      if (roleDetails.niceToHaveSkills && Array.isArray(roleDetails.niceToHaveSkills)) {
        textParts.push(`Nice to Have: ${roleDetails.niceToHaveSkills.join(", ")}`);
      }

      if (roleDetails.toolsTech && Array.isArray(roleDetails.toolsTech)) {
        textParts.push(`Technologies: ${roleDetails.toolsTech.join(", ")}`);
      }
    }

    // Combine all text
    const text = textParts.join("\n");

    if (!text.trim()) {
      console.warn(`[Embeddings] No text content for job ${jobId}, skipping embedding`);
      return false;
    }

    console.log(`[Embeddings] Generating embedding for ${text.length} characters of text`);

    // Generate embedding using OpenAI
    const embedding = await generateEmbedding(text);

    // Store embedding as JSON string (for compatibility with text column)
    const embeddingJson = JSON.stringify(embedding);

    // Insert or update embedding
    await db
      .insert(jobEmbeddings)
      .values({
        jobId,
        embedding: embeddingJson
      })
      .onConflictDoUpdate({
        target: jobEmbeddings.jobId,
        set: {
          embedding: embeddingJson,
          updatedAt: new Date()
        }
      });

    console.log(`[Embeddings] Successfully generated and stored embedding for job: ${jobId}`);
    return true;

  } catch (error) {
    console.error(`[Embeddings] Error indexing job ${jobId}:`, error);
    return false;
  }
}

/**
 * Batch index multiple jobs
 * @param jobIds - Array of job UUIDs to index
 * @returns Promise<{ successful: number, failed: number }>
 */
export async function batchIndexJobs(
  jobIds: string[]
): Promise<{ successful: number; failed: number }> {
  console.log(`[Embeddings] Batch indexing ${jobIds.length} jobs`);
  
  let successful = 0;
  let failed = 0;

  for (const jobId of jobIds) {
    const result = await indexJob(jobId);
    if (result) {
      successful++;
    } else {
      failed++;
    }
  }

  console.log(`[Embeddings] Batch complete: ${successful} successful, ${failed} failed`);
  return { successful, failed };
}

/**
 * Get embedding for a candidate
 * @param candidateId - UUID of the candidate
 * @returns Promise<number[] | null> - Embedding vector or null if not found
 */
export async function getCandidateEmbedding(candidateId: string): Promise<number[] | null> {
  try {
    const result = await db.query.candidateEmbeddings.findFirst({
      where: eq(candidateEmbeddings.candidateId, candidateId),
    });

    if (!result) return null;

    return JSON.parse(result.embedding);
  } catch (error) {
    console.error(`[Embeddings] Error retrieving candidate embedding ${candidateId}:`, error);
    return null;
  }
}

/**
 * Get embedding for a job
 * @param jobId - UUID of the job
 * @returns Promise<number[] | null> - Embedding vector or null if not found
 */
export async function getJobEmbedding(jobId: string): Promise<number[] | null> {
  try {
    const result = await db.query.jobEmbeddings.findFirst({
      where: eq(jobEmbeddings.jobId, jobId),
    });

    if (!result) return null;

    return JSON.parse(result.embedding);
  } catch (error) {
    console.error(`[Embeddings] Error retrieving job embedding ${jobId}:`, error);
    return null;
  }
}
