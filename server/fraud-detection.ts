import OpenAI from 'openai';
import type { InsertFraudDetection } from '../shared/schema';

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || '',
});

export interface FraudDetectionResult {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number; // 0-100
  flags: string[];
  reasoning: string;
}

const FRAUD_DETECTION_PROMPTS = {
  job_post: `You are a fraud detection AI analyzing job postings for potential scams, spam, or inappropriate content.

Analyze the following job posting for red flags:

INDICATORS TO CHECK:
1. **Scam Indicators**:
   - Requests for payment, personal bank details, ID documents upfront
   - "Work from home" schemes with guaranteed high income
   - Vague job descriptions with unrealistic promises
   - Requests to contact via WhatsApp/Telegram instead of professional channels
   - Multi-level marketing (MLM) or pyramid scheme language
   
2. **Spam Indicators**:
   - Promotional content disguised as jobs
   - Links to external websites for unrelated products/services
   - Repetitive or copy-pasted content
   
3. **Data Harvesting**:
   - Excessive personal information requests
   - Suspicious application processes
   - Requests for sensitive documents without legitimate reason
   
4. **Fake Companies**:
   - Well-known company name but suspicious contact details
   - Mismatched company information
   - No verifiable company website or presence

Job Posting Content:
{content}

Respond in JSON format:
{
  "riskLevel": "low" | "medium" | "high" | "critical",
  "riskScore": 0-100,
  "flags": ["spam", "scam", "inappropriate", "fake_company", "data_harvesting"],
  "reasoning": "Detailed explanation of why this content was flagged"
}`,

  cv_upload: `You are a fraud detection AI analyzing CV/resume uploads for inappropriate or spam content.

Analyze the following CV content for red flags:

INDICATORS TO CHECK:
1. **Inappropriate Content**:
   - Offensive language or discriminatory content
   - Irrelevant personal information
   - Spam or promotional material
   
2. **Fake Credentials**:
   - Suspicious education credentials from non-existent institutions
   - Clearly fabricated work history
   - Unrealistic claims or qualifications
   
3. **Data Quality**:
   - Gibberish or randomly generated text
   - Excessive personal contact information harvesting attempts
   - Duplicate or copy-pasted content from other sources

CV Content:
{content}

Respond in JSON format:
{
  "riskLevel": "low" | "medium" | "high" | "critical",
  "riskScore": 0-100,
  "flags": ["spam", "inappropriate", "fake_credentials", "gibberish"],
  "reasoning": "Detailed explanation of why this content was flagged"
}`,

  candidate_profile: `You are a fraud detection AI analyzing candidate profile creation for potential spam or inappropriate content.

Analyze the following candidate profile for red flags:

INDICATORS TO CHECK:
1. **Spam Indicators**:
   - Promotional content in profile fields
   - Links to unrelated products/services
   - Commercial solicitation
   
2. **Inappropriate Content**:
   - Offensive or discriminatory language
   - Irrelevant personal information
   
3. **Fake Profiles**:
   - Clearly fabricated information
   - Inconsistent or suspicious details
   - Bot-like patterns

Profile Data:
{content}

Respond in JSON format:
{
  "riskLevel": "low" | "medium" | "high" | "critical",
  "riskScore": 0-100,
  "flags": ["spam", "inappropriate", "fake_profile", "bot"],
  "reasoning": "Detailed explanation of why this content was flagged"
}`,

  recruiter_profile: `You are a fraud detection AI analyzing recruiter profile creation for potential scams or fake recruiters.

Analyze the following recruiter profile for red flags:

INDICATORS TO CHECK:
1. **Fake Recruiter**:
   - Suspicious company claims
   - Unverifiable credentials
   - Inconsistent industry/sector information
   
2. **Scam Indicators**:
   - Requests for payment from job seekers
   - Promises of guaranteed placements
   - Unprofessional communication patterns
   
3. **Data Harvesting**:
   - Excessive data collection intent
   - Suspicious verification documents

Profile Data:
{content}

Respond in JSON format:
{
  "riskLevel": "low" | "medium" | "high" | "critical",
  "riskScore": 0-100,
  "flags": ["fake_recruiter", "scam", "data_harvesting", "unverified"],
  "reasoning": "Detailed explanation of why this content was flagged"
}`,

  organization: `You are a fraud detection AI analyzing organization/company registration for potential scams or fake businesses.

Analyze the following organization data for red flags:

INDICATORS TO CHECK:
1. **Fake Company**:
   - Well-known brand name with suspicious details
   - Unverifiable business information
   - Mismatched industry/website/contact details
   
2. **Scam Indicators**:
   - Known scam company patterns
   - Suspicious business model claims
   - Requests for upfront payments
   
3. **Data Quality**:
   - Incomplete or inconsistent information
   - Generic or template-like content
   - Suspicious contact information

Organization Data:
{content}

Respond in JSON format:
{
  "riskLevel": "low" | "medium" | "high" | "critical",
  "riskScore": 0-100,
  "flags": ["fake_company", "scam", "unverifiable", "suspicious"],
  "reasoning": "Detailed explanation of why this content was flagged"
}`,
};

export async function detectFraud(
  contentType: 'job_post' | 'cv_upload' | 'candidate_profile' | 'recruiter_profile' | 'organization',
  content: any,
  userId?: string
): Promise<FraudDetectionResult> {
  const prompt = FRAUD_DETECTION_PROMPTS[contentType];
  
  if (!prompt) {
    throw new Error(`Unknown content type: ${contentType}`);
  }

  // Convert content to string for analysis
  const contentStr = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
  
  const finalPrompt = prompt.replace('{content}', contentStr);

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert fraud detection system for a South African recruiting platform. Analyze content and respond only with valid JSON.',
        },
        {
          role: 'user',
          content: finalPrompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3, // Lower temperature for more consistent results
    });

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error('No response from OpenAI');
    }

    const result = JSON.parse(responseText) as FraudDetectionResult;
    
    // Validate response structure
    if (!result.riskLevel || !result.riskScore || !result.flags || !result.reasoning) {
      throw new Error('Invalid response structure from OpenAI');
    }

    return result;
  } catch (error) {
    console.error('Fraud detection AI error:', error);
    // Fallback to safe defaults if AI fails
    return {
      riskLevel: 'low',
      riskScore: 0,
      flags: [],
      reasoning: 'Auto-approved: AI detection unavailable',
    };
  }
}

export function shouldAutoApprove(result: FraudDetectionResult): boolean {
  // Auto-approve low risk content (score < 30)
  return result.riskLevel === 'low' && result.riskScore < 30;
}

export function shouldAutoReject(result: FraudDetectionResult): boolean {
  // Auto-reject critical content (score >= 90)
  return result.riskLevel === 'critical' && result.riskScore >= 90;
}
