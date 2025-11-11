import OpenAI from "openai";
import type { Candidate, Experience, Education, Certification, Project, Award } from "@shared/schema";

// Runtime check for AI configuration
export function isAIConfigured(): boolean {
  const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  return !!(baseUrl && apiKey);
}

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

const CV_INGESTION_PROMPT = `ROLE
You are a CV Ingestion Agent. Your job: parse each submitted CV (PDF/Doc/TXT) into a normalized JSON profile and return it in the OUTPUT_SCHEMA. Be precise, ATS-friendly, and NEVER fabricate details.

GOALS
1) Extract clean, normalized structured data from raw CV text.
2) Standardise dates to "MMM YYYY" (accept year-only), detect current roles.
3) Normalise skills (dedupe, synonyms), keep South African context where relevant.
4) Surface achievements with metrics (R amounts, %, time saved) when explicitly present.
5) Detect location, work authorisation, availability ONLY if explicitly stated.

RULES
- If a field is not present, set it to null or [] (don't guess).
- Keep bullet points concise, action-verb led.
- Don't include PII beyond name, email, phone, and links provided by the CV.
- Do not evaluate suitability; just parse.

OUTPUT_SCHEMA (return exactly this shape)
{
  "source_meta": {
    "filename": "",
    "filesize_bytes": 0,
    "parsed_ok": true,
    "parse_notes": ""
  },
  "candidate": {
    "full_name": "",
    "headline": "",
    "contact": { "email": "", "phone": "", "city": "", "country": "" },
    "links": { "linkedin": "", "portfolio": "", "github": "", "other": "" },
    "summary": "",
    "skills": {
      "technical": [],
      "tools": [],
      "soft": []
    },
    "experience": [
      {
        "title": "",
        "company": "",
        "industry": "",
        "location": "",
        "start_date": "",
        "end_date": "",        // "Present" if ongoing
        "is_current": false,
        "bullets": []
      }
    ],
    "education": [
      { "institution": "", "qualification": "", "location": "", "grad_date": "" }
    ],
    "certifications": [
      { "name": "", "issuer": "", "year": "" }
    ],
    "projects": [
      { "name": "", "what": "", "impact": "", "link": "" }
    ],
    "awards": [
      { "name": "", "by": "", "year": "", "note": "" }
    ],
    "work_authorization": "",
    "availability": "",
    "salary_expectation": "",
    "notes": ""
  }
}

FORMATTING
- Return only the JSON object (no prose) in your final answer.`;

export interface CVIngestionResult {
  source_meta: {
    filename: string;
    filesize_bytes: number;
    parsed_ok: boolean;
    parse_notes: string;
  };
  candidate: {
    full_name: string;
    headline: string;
    contact: {
      email: string;
      phone: string;
      city: string;
      country: string;
    };
    links: {
      linkedin: string;
      portfolio: string;
      github: string;
      other: string;
    };
    summary: string;
    skills: {
      technical: string[];
      tools: string[];
      soft: string[];
    };
    experience: Array<{
      title: string;
      company: string;
      industry: string;
      location: string;
      start_date: string;
      end_date: string;
      is_current: boolean;
      bullets: string[];
    }>;
    education: Array<{
      institution: string;
      qualification: string;
      location: string;
      grad_date: string;
    }>;
    certifications: Array<{
      name: string;
      issuer: string;
      year: string;
    }>;
    projects: Array<{
      name: string;
      what: string;
      impact: string;
      link: string;
    }>;
    awards: Array<{
      name: string;
      by: string;
      year: string;
      note: string;
    }>;
    work_authorization: string;
    availability: string;
    salary_expectation: string;
    notes: string;
  };
}

// Simple token estimator: ~4 characters per token (conservative estimate)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Truncate text to fit within token limit
function truncateToTokenLimit(text: string, maxTokens: number): string {
  const estimatedTokens = estimateTokens(text);
  
  if (estimatedTokens <= maxTokens) {
    return text;
  }
  
  // Calculate how many characters we can keep
  const maxChars = maxTokens * 4; // 4 chars per token
  const truncated = text.substring(0, maxChars);
  
  console.log(`[CV Ingestion] Truncated CV from ${text.length} to ${truncated.length} chars (est. ${estimateTokens(truncated)} tokens)`);
  
  return truncated + "\n\n[... CV truncated due to length ...]";
}

export async function parseCVWithAI(
  rawText: string,
  filename: string,
  filesizeBytes: number
): Promise<CVIngestionResult> {
  try {
    const client = getOpenAIClient();

    // GPT-4o has 128k token context window
    // System prompt is ~800 tokens, we need room for response (~8k tokens)
    // So we limit input to ~110k tokens to be safe
    const MAX_INPUT_TOKENS = 110000;
    const truncatedText = truncateToTokenLimit(rawText, MAX_INPUT_TOKENS);
    
    console.log(`[CV Ingestion] Processing CV: ${filename} (${filesizeBytes} bytes, ${truncatedText.length} chars, est. ${estimateTokens(truncatedText)} tokens)`);

    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: CV_INGESTION_PROMPT,
        },
        {
          role: "user",
          content: `Parse this CV and return the structured JSON:\n\n${truncatedText}`,
        },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error("No response from AI");
    }

    // Log first 500 chars of AI response for debugging
    console.log(`[CV Ingestion] AI Response (first 500 chars): ${responseText.substring(0, 500)}`);

    const parsed = JSON.parse(responseText) as CVIngestionResult;

    // Log what the AI extracted for debugging
    console.log(`[CV Ingestion] AI extracted name: "${parsed.candidate?.full_name || '(empty)'}"`);
    console.log(`[CV Ingestion] AI extracted email: "${parsed.candidate?.contact?.email || '(empty)'}"`);
    console.log(`[CV Ingestion] AI extracted phone: "${parsed.candidate?.contact?.phone || '(empty)'}"`);

    // Ensure source_meta is populated
    parsed.source_meta = {
      filename,
      filesize_bytes: filesizeBytes,
      parsed_ok: true,
      parse_notes: parsed.source_meta?.parse_notes || "",
    };

    return parsed;
  } catch (error: any) {
    console.error("CV parsing error:", error);
    throw new Error(`Failed to parse CV: ${error.message}`);
  }
}
