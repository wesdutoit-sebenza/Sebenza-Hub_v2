import OpenAI from "openai";
import { isAIConfigured } from "./ai-cv-ingestion";

// Lazy initialization of OpenAI client
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    if (!isAIConfigured()) {
      throw new Error("OpenAI is not configured. Please set up AI integration.");
    }
    openaiClient = new OpenAI({
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

const TEST_BLUEPRINT_SYSTEM_PROMPT = `ROLE
You are a Competency Test Blueprint Agent for Sebenza Hub, a South African recruiting platform. Your job: generate legally compliant, scientifically valid pre-hire assessments aligned to ISO 10667 process quality standards.

CONTEXT
- Target: South African job market with POPIA compliance, Employment Equity Act, and HPCSA considerations
- Use: Pre-hire screening to predict job performance
- Science: Prioritize work samples and Situational Judgment Tests (SJTs) for validity
- Compliance: POPIA-compliant notices, no clinical psychological tests (use work-style indicators only)

GOALS
1) Generate a complete test blueprint from job title, description, and key responsibilities
2) Include South African-relevant scenarios (VAT, POPIA, EEA, load-shedding, local customer service norms)
3) Balance skills assessment (work samples, SJTs), aptitude (numerical, verbal, logical), and work-style (non-diagnostic)
4) Set appropriate difficulty curves, time limits, weights, and cut scores
5) Configure anti-cheating measures and POPIA notices

RULES
- Work-style items are ADVISORY ONLY, not diagnostic. Use Big Five-style preferences, not clinical labels.
- All scenarios must be South African context (Rands, SA laws, SA business norms)
- For customer service: include load-shedding, returns without receipts, multilingual customers
- For finance: include VAT (15%), UIF, PAYE, basic tax calculations
- For logistics: include SHEQ compliance, OHS Act references, stock management
- For all: include POPIA literacy questions where relevant
- Use diverse question formats: MCQ, multi-select, SJT (rank/best-worst), Likert, true/false
- Set realistic time limits: ~1-2 min per item for skills, ~45 sec for aptitude, ~30 sec for work-style

OUTPUT SCHEMA
Return a JSON object with this exact structure:

{
  "meta": {
    "job_title": string,
    "job_family": string,           // e.g., "Logistics", "Customer Service", "Finance"
    "industry": string,              // e.g., "FMCG", "Retail", "Manufacturing"
    "seniority": string,             // "entry", "mid", "senior", "executive"
    "languages": string[],           // ["en-ZA"] by default
    "duration_min": number           // Total test duration in minutes
  },
  "weights": {
    "skills": number,                // 0.0-1.0, typically 0.4-0.6
    "aptitude": number,              // 0.0-1.0, typically 0.2-0.35
    "work_style": number             // 0.0-1.0, typically 0.15-0.25
  },
  "cut_scores": {
    "overall": number,               // 0-100, typical pass threshold
    "sections": {
      "skills": number,              // Minimum skills section score
      "aptitude": number             // Optional aptitude minimum
    }
  },
  "anti_cheat": {
    "shuffle": boolean,              // Randomize question/option order
    "fullscreen_monitor": boolean,   // Track fullscreen exits
    "webcam": string,                // "off", "consent_optional", "required"
    "ip_logging": boolean            // Log IP address
  },
  "sections": [
    {
      "type": "skills" | "aptitude" | "work_style",
      "title": string,
      "description": string,
      "time_minutes": number,
      "weight": number,              // Percentage 0-100
      "order_index": number,
      "items": [
        {
          "format": string,          // "mcq", "multi_select", "sjt_rank", "sjt_best_worst", "likert", "true_false", "short_answer"
          "stem": string,            // Question text
          "options": string[],       // Answer choices (for MCQ/multi-select/SJT)
          "correct_answer": any,     // Correct answer key
          "competencies": string[],  // e.g., ["Customer Empathy", "POPIA Literacy", "Numeracy"]
          "difficulty": "E" | "M" | "H",
          "time_seconds": number,    // Optional per-item timer
          "max_points": number,
          "order_index": number,
          "rubric": object | null    // For open-ended questions
        }
      ]
    }
  ],
  "candidate_notice": {
    "privacy": string,               // POPIA compliance notice
    "accommodations": boolean,       // Accessibility support available
    "purpose": string                // Why this test is being administered
  },
  "rationale": string                // Brief explanation of test design choices
}

FORMATTING
- Return ONLY the JSON object (no markdown, no prose)
- Ensure all JSON is valid and properly escaped
- Generate 8-15 items per section (skills/aptitude), 10-15 for work-style
- Make questions specific to the role with realistic South African scenarios`;

export interface TestItemBlueprint {
  format: 'mcq' | 'multi_select' | 'sjt_rank' | 'sjt_best_worst' | 'likert' | 'true_false' | 'short_answer' | 'essay' | 'file_upload' | 'video' | 'code' | 'data_task';
  stem: string;
  options?: string[];
  correct_answer: any;
  competencies: string[];
  difficulty: 'E' | 'M' | 'H';
  time_seconds?: number;
  max_points: number;
  order_index: number;
  rubric?: any;
}

export interface TestSectionBlueprint {
  type: 'skills' | 'aptitude' | 'work_style';
  title: string;
  description: string;
  time_minutes: number;
  weight: number;
  order_index: number;
  items: TestItemBlueprint[];
}

export interface TestBlueprint {
  meta: {
    job_title: string;
    job_family: string;
    industry: string;
    seniority: string;
    languages: string[];
    duration_min: number;
  };
  weights: {
    skills: number;
    aptitude: number;
    work_style: number;
  };
  cut_scores: {
    overall: number;
    sections: {
      skills: number;
      aptitude?: number;
    };
  };
  anti_cheat: {
    shuffle: boolean;
    fullscreen_monitor: boolean;
    webcam: 'off' | 'consent_optional' | 'required';
    ip_logging: boolean;
  };
  sections: TestSectionBlueprint[];
  candidate_notice: {
    privacy: string;
    accommodations: boolean;
    purpose: string;
  };
  rationale: string;
}

export interface GenerateTestInput {
  jobTitle: string;
  jobDescription?: string;
  keyResponsibilities?: string;
  companyValues?: string;
  industry?: string;
  seniority?: 'entry' | 'mid' | 'senior' | 'executive';
  languages?: string[];
  weights?: {
    skills: number;
    aptitude: number;
    workStyle: number;
  };
  questionCounts?: {
    skills: number;
    aptitude: number;
    workStyle: number;
  };
  timeAllocations?: {
    skills: number;
    aptitude: number;
    workStyle: number;
  };
}

/**
 * Generate a complete competency test blueprint using AI
 */
export async function generateTestBlueprint(input: GenerateTestInput): Promise<TestBlueprint> {
  const openai = getOpenAIClient();

  // Calculate normalized weights (percentages to decimals)
  const weights = input.weights ? {
    skills: input.weights.skills / 100,
    aptitude: input.weights.aptitude / 100,
    work_style: input.weights.workStyle / 100,
  } : { skills: 0.5, aptitude: 0.3, work_style: 0.2 };

  // Build the user prompt with all available context
  const userPrompt = `Generate a competency test blueprint for the following role:

JOB TITLE: ${input.jobTitle}

${input.jobDescription ? `JOB DESCRIPTION:\n${input.jobDescription}\n` : ''}
${input.keyResponsibilities ? `KEY RESPONSIBILITIES:\n${input.keyResponsibilities}\n` : ''}
${input.companyValues ? `COMPANY VALUES:\n${input.companyValues}\n` : ''}
${input.industry ? `INDUSTRY: ${input.industry}\n` : ''}
${input.seniority ? `SENIORITY: ${input.seniority}\n` : ''}
${input.languages ? `LANGUAGES: ${input.languages.join(', ')}\n` : ''}

${input.weights ? `SECTION WEIGHTS (must match exactly):
- Skills: ${weights.skills} (${input.weights.skills}%)
- Aptitude: ${weights.aptitude} (${input.weights.aptitude}%)
- Work-Style: ${weights.work_style} (${input.weights.workStyle}%)
` : ''}

${input.questionCounts ? `QUESTION COUNTS (generate exactly this many):
- Skills: ${input.questionCounts.skills} questions
- Aptitude: ${input.questionCounts.aptitude} questions
- Work-Style: ${input.questionCounts.workStyle} questions
` : ''}

${input.timeAllocations ? `TIME ALLOCATIONS (set section time limits):
- Skills: ${input.timeAllocations.skills} minutes
- Aptitude: ${input.timeAllocations.aptitude} minutes
- Work-Style: ${input.timeAllocations.workStyle} minutes
Total test duration: ${input.timeAllocations.skills + input.timeAllocations.aptitude + input.timeAllocations.workStyle} minutes
` : ''}

Generate a comprehensive, South African-compliant competency test with realistic scenarios and questions.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: TEST_BLUEPRINT_SYSTEM_PROMPT },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 8000,
      response_format: { type: "json_object" }
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No content returned from AI");
    }

    const blueprint = JSON.parse(content) as TestBlueprint;
    
    // Validate the blueprint has required fields
    if (!blueprint.meta || !blueprint.sections || !Array.isArray(blueprint.sections)) {
      throw new Error("Invalid blueprint structure returned from AI");
    }

    return blueprint;
  } catch (error) {
    console.error("[AI Test Generation] Error:", error);
    throw new Error(`Failed to generate test blueprint: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate and sanitize a test blueprint
 */
export function validateBlueprint(blueprint: TestBlueprint): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check meta
  if (!blueprint.meta?.job_title) errors.push("Missing job_title in meta");
  if (!blueprint.meta?.duration_min || blueprint.meta.duration_min < 5) errors.push("Invalid duration_min");

  // Check weights sum to ~1.0
  const weightSum = (blueprint.weights?.skills || 0) + (blueprint.weights?.aptitude || 0) + (blueprint.weights?.work_style || 0);
  if (Math.abs(weightSum - 1.0) > 0.01) {
    errors.push(`Weights must sum to 1.0 (got ${weightSum})`);
  }

  // Check sections
  if (!blueprint.sections || blueprint.sections.length === 0) {
    errors.push("No sections defined");
  } else {
    blueprint.sections.forEach((section, idx) => {
      if (!section.type || !['skills', 'aptitude', 'work_style'].includes(section.type)) {
        errors.push(`Section ${idx}: invalid type`);
      }
      if (!section.items || section.items.length === 0) {
        errors.push(`Section ${idx} (${section.type}): no items`);
      }
    });
  }

  // Check cut scores
  if (!blueprint.cut_scores?.overall || blueprint.cut_scores.overall < 0 || blueprint.cut_scores.overall > 100) {
    errors.push("Invalid overall cut score");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
