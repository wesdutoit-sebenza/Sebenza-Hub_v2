import OpenAI from "openai";

// Check if OpenAI integration is properly configured
export function isAIConfigured(): boolean {
  return !!(process.env.AI_INTEGRATIONS_OPENAI_BASE_URL && process.env.AI_INTEGRATIONS_OPENAI_API_KEY);
}

// This is using Replit's AI Integrations service, which provides OpenAI-compatible API access without requiring your own OpenAI API key.
// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!isAIConfigured()) {
    throw new Error("OpenAI integration not configured. Please set up the javascript_openai_ai_integrations connector.");
  }
  
  if (!openai) {
    openai = new OpenAI({
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
    });
  }
  
  return openai;
}

interface ParsedCandidate {
  full_name: string;
  contact: {
    email?: string;
    phone?: string;
    city?: string;
    country?: string;
  };
  headline?: string;
  skills: string[];
  experience: Array<{
    title: string;
    company: string;
    industry?: string;
    location?: string;
    start_date?: string;
    end_date?: string;
    bullets: string[];
  }>;
  education: Array<{
    institution: string;
    qualification: string;
    grad_date?: string;
  }>;
  certifications: Array<{
    name: string;
    issuer?: string;
    year?: string;
  }>;
  achievements: Array<{
    metric: string;
    value: string;
    note: string;
  }>;
  links?: {
    linkedin?: string;
    portfolio?: string;
    github?: string;
  };
  work_authorization?: string;
  salary_expectation?: string;
  availability?: string;
}

interface ScoringWeights {
  skills: number;
  experience: number;
  achievements: number;
  education: number;
  location_auth: number;
  salary_availability: number;
}

interface ScreeningCriteria {
  job_title: string;
  job_description: string;
  seniority?: string;
  employment_type?: string;
  location?: {
    city?: string;
    country?: string;
    work_type?: string;
  };
  must_have_skills: string[];
  nice_to_have_skills: string[];
  salary_range?: {
    min?: number;
    max?: number;
    currency?: string;
  };
  knockouts: string[];
  weights: ScoringWeights;
}

interface CandidateEvaluation {
  full_name: string;
  score_total: number;
  score_breakdown: {
    skills: number;
    experience: number;
    achievements: number;
    education: number;
    location_auth: number;
    salary_availability: number;
  };
  must_haves_satisfied: string[];
  missing_must_haves: string[];
  knockout: {
    is_ko: boolean;
    reasons: string[];
  };
  reasons: string[];
  flags: {
    red: string[];
    yellow: string[];
  };
}

export async function parseCVWithAI(cvText: string): Promise<ParsedCandidate> {
  if (!cvText || cvText.trim().length === 0) {
    throw new Error("CV text is empty");
  }

  const prompt = `You are a CV parsing AI. Extract structured data from the following CV/resume text.

IMPORTANT INSTRUCTIONS:
1. Extract all information accurately from the text
2. Normalize skills (e.g., "Power BI" and "Business Intelligence" are related)
3. Parse dates into MMM YYYY format where possible
4. Extract quantified achievements (revenue, percentages, metrics)
5. Return valid JSON matching the schema below

CV TEXT:
${cvText}

Return JSON matching this schema:
{
  "full_name": "",
  "contact": {"email": "", "phone": "", "city": "", "country": ""},
  "headline": "",
  "skills": [],
  "experience": [{"title": "", "company": "", "industry": "", "location": "", "start_date": "", "end_date": "", "bullets": []}],
  "education": [{"institution": "", "qualification": "", "grad_date": ""}],
  "certifications": [{"name": "", "issuer": "", "year": ""}],
  "achievements": [{"metric": "", "value": "", "note": ""}],
  "links": {"linkedin": "", "portfolio": "", "github": ""},
  "work_authorization": "",
  "salary_expectation": "",
  "availability": ""
}`;

  try {
    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are a precise CV parsing AI. Extract structured candidate data from resumes. Return only valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 8192,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    return JSON.parse(content);
  } catch (error: any) {
    console.error("CV parsing error:", error);
    throw new Error(`Failed to parse CV: ${error.message}`);
  }
}

export async function evaluateCandidateWithAI(
  candidate: ParsedCandidate,
  criteria: ScreeningCriteria
): Promise<CandidateEvaluation> {
  const prompt = `You are a Candidate Screening AI. Evaluate this candidate against the job requirements and return a scored evaluation.

SCORING WEIGHTS:
- Skills match: ${criteria.weights.skills}%
- Experience relevance: ${criteria.weights.experience}%
- Achievements/impact: ${criteria.weights.achievements}%
- Education/certifications: ${criteria.weights.education}%
- Location & authorization: ${criteria.weights.location_auth}%
- Salary & availability: ${criteria.weights.salary_availability}%

JOB REQUIREMENTS:
Title: ${criteria.job_title}
Description: ${criteria.job_description}
Seniority: ${criteria.seniority || 'Not specified'}
Must-have skills: ${criteria.must_have_skills.join(', ')}
Nice-to-have skills: ${criteria.nice_to_have_skills.join(', ')}
Knockouts: ${criteria.knockouts.join(', ')}

CANDIDATE DATA:
${JSON.stringify(candidate, null, 2)}

INSTRUCTIONS:
1. Score 0-100 based on the weights above
2. Apply knockout rules (if violated, score = 0)
3. Provide 3-6 concise reasoning bullets citing CV evidence
4. Identify must-haves satisfied/missing
5. Flag red/yellow concerns
6. Be fair, inclusive, and evidence-based

Return JSON matching this schema:
{
  "full_name": "",
  "score_total": 0,
  "score_breakdown": {"skills": 0, "experience": 0, "achievements": 0, "education": 0, "location_auth": 0, "salary_availability": 0},
  "must_haves_satisfied": [],
  "missing_must_haves": [],
  "knockout": {"is_ko": false, "reasons": []},
  "reasons": [],
  "flags": {"red": [], "yellow": []}
}`;

  try {
    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are a fair, precise candidate evaluation AI. Score candidates 0-100 based on job fit. Provide transparent reasoning."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 8192,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    return JSON.parse(content);
  } catch (error: any) {
    console.error("Candidate evaluation error:", error);
    throw new Error(`Failed to evaluate candidate: ${error.message}`);
  }
}
