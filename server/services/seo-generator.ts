import OpenAI from "openai";
import { db } from "../db";
import { jobs } from "../../shared/schema";
import { eq, sql } from "drizzle-orm";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Character limits for SEO fields
const MAX_LENGTHS = {
  titleTag: 60,
  metaDescription: 155,
  ogTitle: 70,
  ogDescription: 200,
  twitterTitle: 70,
  twitterDescription: 200,
  imageAlt: 110,
};

// Regex patterns for validation
const EMOJI_REGEX = /\p{Extended_Pictographic}/gu;
const MULTISPACE = /\s{2,}/g;
const PII_REGEX = /(\+?\d{2,}[\s-]?)?\d{3}[\s-]?\d{3,}|@|https?:\/\//gi;

// Basic profanity list (extend as needed)
const PROFANITY_LIST = ["damn", "hell"];

/**
 * Convert string to kebab-case for URL slugs
 */
export function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Clamp string to maximum length with ellipsis
 */
function clampString(s: string, maxLength: number): string {
  if (!s) return s;
  if (s.length <= maxLength) return s;
  return s.slice(0, maxLength - 1).trimEnd() + "…";
}

/**
 * Sanitize string: remove emojis, extra spaces, normalize quotes
 */
function sanitizeString(s: string): string {
  if (!s) return s;
  let cleaned = s
    .replace(EMOJI_REGEX, "")
    .replace(MULTISPACE, " ")
    .trim();
  
  // Normalize quotes that can break HTML/meta tags
  cleaned = cleaned
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'");
  
  return cleaned;
}

/**
 * Check if string contains PII (phone numbers, emails, URLs)
 */
function containsPII(s: string): boolean {
  return PII_REGEX.test(s || "");
}

/**
 * Check if string contains profanity
 */
function containsProfanity(s: string): boolean {
  const lower = (s || "").toLowerCase();
  return PROFANITY_LIST.some(word => lower.includes(word));
}

/**
 * Remove PII from string
 */
function removePII(s: string): string {
  return s.replace(PII_REGEX, "").trim();
}

/**
 * Remove profanity from string
 */
function removeProfanity(s: string): string {
  const regex = new RegExp(`\\b(${PROFANITY_LIST.join("|")})\\b`, "gi");
  return s.replace(regex, "").replace(/\s{2,}/g, " ").trim();
}

/**
 * Ensure slug is unique in database by appending numbers if needed
 */
export async function ensureUniqueSlug(baseSlug: string, excludeJobId?: string): Promise<string> {
  let slug = baseSlug;
  let counter = 0;
  
  while (true) {
    const existing = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(sql`${jobs.seo}->>'slug' = ${slug}`)
      .limit(1);
    
    // If no match found, or the only match is the job we're updating, slug is unique
    if (existing.length === 0 || (excludeJobId && existing[0].id === excludeJobId)) {
      return slug;
    }
    
    counter += 1;
    slug = `${baseSlug}-${counter}`;
  }
}

/**
 * Generate or fix JSON-LD structured data for JobPosting
 */
export function generateJsonLd(job: any): string {
  try {
    const now = new Date().toISOString();
    
    const salary = job.compensation?.min || job.compensation?.max ? {
      "@type": "MonetaryAmount",
      currency: job.compensation?.currency || "ZAR",
      value: {
        "@type": "QuantitativeValue",
        minValue: job.compensation?.min,
        maxValue: job.compensation?.max,
        unitText: job.compensation?.payType || "YEAR"
      }
    } : undefined;
    
    const location = job.core?.location ? {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: job.core.location.city || job.location,
        addressRegion: job.core.location.province,
        postalCode: job.core.location.postalCode,
        addressCountry: "ZA"
      }
    } : {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: job.location || "South Africa",
        addressCountry: "ZA"
      }
    };
    
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "JobPosting",
      title: job.title,
      description: job.core?.summary || job.description || "Job opportunity",
      datePosted: job.createdAt || now,
      validThrough: job.application?.closingDate || job.admin?.closingDate,
      employmentType: job.employmentType || job.core?.workArrangement || "FULL_TIME",
      hiringOrganization: {
        "@type": "Organization",
        name: job.company || job.companyDetails?.name || "Sebenza Hub",
        sameAs: job.companyDetails?.careersUrl || job.branding?.careersUrl
      },
      jobLocation: location,
      baseSalary: salary,
      applicantLocationRequirements: {
        "@type": "Country",
        name: "South Africa"
      },
      jobBenefits: job.benefits?.benefits?.join(", "),
      qualifications: job.core?.qualifications?.join(", "),
      skills: job.core?.requiredSkills?.map((s: any) => s.skill).join(", "),
      url: `https://sebenzahub.co.za/jobs/${job.id}`
    };
    
    return JSON.stringify(jsonLd);
  } catch (error) {
    console.error("[SEO] Error generating JSON-LD:", error);
    // Return minimal valid JSON-LD
    return JSON.stringify({
      "@context": "https://schema.org",
      "@type": "JobPosting",
      title: job.title || "Job Opportunity",
      description: job.core?.summary || job.description || "Job opportunity in South Africa",
      datePosted: new Date().toISOString(),
      url: `https://sebenzahub.co.za/jobs/${job.id}`
    });
  }
}

/**
 * Clean and validate SEO payload
 */
export function cleanAndValidateSEO(rawSEO: any): any {
  const cleaned: any = { ...rawSEO };
  
  // Clean and clamp text fields
  const textFields = [
    'titleTag', 'metaDescription', 'ogTitle', 'ogDescription',
    'twitterTitle', 'twitterDescription', 'imageAlt'
  ];
  
  textFields.forEach(field => {
    if (cleaned[field]) {
      let value = sanitizeString(cleaned[field]);
      
      // Remove PII and profanity
      if (containsPII(value)) {
        value = removePII(value);
      }
      if (containsProfanity(value)) {
        value = removeProfanity(value);
      }
      
      // Clamp to max length
      const maxLength = MAX_LENGTHS[field as keyof typeof MAX_LENGTHS];
      if (maxLength) {
        value = clampString(value, maxLength);
      }
      
      cleaned[field] = value;
    }
  });
  
  // Clean keywords array
  if (Array.isArray(cleaned.keywords)) {
    cleaned.keywords = Array.from(
      new Set(
        cleaned.keywords
          .map((k: string) => sanitizeString(k).toLowerCase())
          .filter(Boolean)
      )
    );
  } else {
    cleaned.keywords = [];
  }
  
  // Clean hashtags array
  if (Array.isArray(cleaned.hashtags)) {
    cleaned.hashtags = Array.from(
      new Set(
        cleaned.hashtags.map((h: string) => {
          const sanitized = sanitizeString(h);
          return sanitized.startsWith('#') ? sanitized : `#${sanitized}`;
        })
      )
    );
  } else {
    cleaned.hashtags = [];
  }
  
  // Default internal links
  if (!Array.isArray(cleaned.internalLinks) || cleaned.internalLinks.length === 0) {
    cleaned.internalLinks = [
      { label: "More jobs in South Africa", href: "/jobs" }
    ];
  }
  
  // Default FAQ if empty
  if (!Array.isArray(cleaned.faq)) {
    cleaned.faq = [];
  }
  
  return cleaned;
}

/**
 * Generate comprehensive SEO tags using OpenAI
 */
export async function generateJobSEO(job: any): Promise<any> {
  const jobData = {
    title: job.title,
    location: job.core?.location?.city || job.location,
    province: job.core?.location?.province,
    seniority: job.core?.seniority,
    summary: job.core?.summary || job.description,
    company: job.company || job.companyDetails?.name,
    industry: job.industry || job.companyDetails?.industry,
    employmentType: job.employmentType || job.core?.workArrangement,
    salary: job.compensation,
    skills: job.core?.requiredSkills?.map((s: any) => s.skill).join(", "),
    qualifications: job.core?.qualifications?.join(", "),
  };
  
  const systemPrompt = `You are an SEO specialist for Sebenza Hub, a South African recruiting platform. Generate comprehensive SEO metadata for job postings.

CRITICAL RULES:
- ALL content must be in South African English (organisation, centre, etc.)
- Use "ZAR" for currency, mention "South Africa" for location context
- Title tags ≤60 chars, meta descriptions ≤155 chars
- OG/Twitter titles ≤70 chars, descriptions ≤200 chars
- Image alt text ≤110 chars
- Generate 5-10 relevant keywords
- Generate 3-5 hashtags (include #JobsInSA, #Hiring)
- Create 2-3 FAQ items relevant to the role
- Slug must be kebab-case: job-title-location
- Be specific, avoid generic phrases like "exciting opportunity"
- Focus on role benefits, location, seniority level
- NO emojis, NO phone numbers, NO emails, NO URLs in any field

Return ONLY a JSON object with these exact keys:
{
  "slug": "kebab-case-url-slug",
  "titleTag": "max 60 chars",
  "metaDescription": "max 155 chars",
  "ogTitle": "max 70 chars",
  "ogDescription": "max 200 chars",
  "twitterTitle": "max 70 chars",
  "twitterDescription": "max 200 chars",
  "imageAlt": "max 110 chars",
  "keywords": ["keyword1", "keyword2", ...],
  "hashtags": ["#Hashtag1", "#Hashtag2", ...],
  "faq": [{"q": "question?", "a": "answer"}]
}`;
  
  const userPrompt = `Generate SEO for this job:\n\n${JSON.stringify(jobData, null, 2)}\n\nReturn only JSON, no other text.`;
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.4,
    });
    
    const generated = JSON.parse(response.choices[0].message.content || "{}");
    
    // Clean and validate the generated SEO
    const cleaned = cleanAndValidateSEO(generated);
    
    // Ensure slug is unique
    if (cleaned.slug) {
      cleaned.slug = toKebabCase(cleaned.slug);
      cleaned.slug = await ensureUniqueSlug(cleaned.slug, job.id);
    } else {
      const baseSlug = toKebabCase(`${job.title} ${job.core?.location?.city || job.location || ""}`);
      cleaned.slug = await ensureUniqueSlug(baseSlug, job.id);
    }
    
    // Generate JSON-LD
    cleaned.jsonld = generateJsonLd(job);
    
    // Increment version
    cleaned.version = (job.seo?.version || 0) + 1;
    
    return cleaned;
  } catch (error) {
    console.error("[SEO] Error generating SEO:", error);
    throw new Error("Failed to generate SEO metadata");
  }
}
