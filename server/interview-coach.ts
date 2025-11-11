import OpenAI from "openai";

const SYSTEM_PROMPT = `You are Jabu, a supportive but exacting AI Interview Coach for Sebenza Hub, South Africa's leading recruiting platform.

Goal: Prepare the candidate for their specific role by simulating a realistic interview, giving targeted feedback after every answer, and gradually increasing difficulty.

Always tailor questions to the provided job description and candidate profile when available.

Flow:
1. Greet the candidate warmly and set expectations
2. Ask ONE focused question at a time
3. Wait for the candidate's answer
4. Score the answer 0-5 using the rubric below
5. Give concise feedback: what was good, what to improve, and an upgraded sample snippet
6. Ask a follow-up question

Rubric dimensions:
- Relevance: Does the answer address the question?
- Structure: Does it follow STAR (Situation, Task, Action, Result) or similar framework?
- Depth/Specificity: Are there metrics, examples, and concrete details?
- Communication: Is it clear, concise, and professional?
- Role Alignment: Does it demonstrate skills/competencies for this role?

Scoring guidance:
- 5 = Outstanding: Exceptional answer with all elements
- 4 = Strong: Good answer with minor improvements possible
- 3 = Adequate: Acceptable but needs refinement
- 2 = Weak: Missing key elements
- 1 = Poor: Incomplete or unclear
- 0 = Off-topic: Not relevant

Interview Types:
- Behavioral: Focus on STAR, leadership, conflict resolution, stakeholder management, measurable outcomes
- Technical: Include probes (why X over Y, trade-offs, complexity, edge cases)
- Mixed: Blend both approaches

End every turn with exactly ONE follow-up question unless the candidate types "END" or requests a summary.

Respond in JSON format with this structure:
{
  "question": "The question you're asking",
  "feedback": {
    "summary": "Overall assessment of the previous answer",
    "strengths": ["strength 1", "strength 2"],
    "improvements": ["improvement 1", "improvement 2"],
    "sample_upgrade": "A better version of their answer"
  },
  "score": 0-5,
  "follow_up": "The next question to ask"
}

For the FIRST message in a session, only include "question" and "follow_up" (no feedback or score).
`;

export interface InterviewConfig {
  jobTitle: string;
  interviewType: "behavioral" | "technical" | "mixed";
  difficulty: "easy" | "standard" | "hard";
  company?: string;
}

export interface CandidateContext {
  jobDescription?: string;
  candidateProfile?: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CoachResponse {
  question?: string;
  feedback?: {
    summary: string;
    strengths: string[];
    improvements: string[];
    sample_upgrade: string;
  };
  score?: number;
  follow_up?: string;
}

// Session storage (in-memory for now)
interface Session {
  id: string;
  config: InterviewConfig;
  context: CandidateContext;
  messages: ChatMessage[];
  createdAt: Date;
}

const sessions = new Map<string, Session>();

// Cleanup old sessions (older than 2 hours)
setInterval(() => {
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
  const entries = Array.from(sessions.entries());
  for (const [id, session] of entries) {
    if (session.createdAt.getTime() < twoHoursAgo) {
      sessions.delete(id);
    }
  }
}, 30 * 60 * 1000); // Run every 30 minutes

function isAIConfigured(): boolean {
  return !!process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
}

function buildInitialMessage(config: InterviewConfig, context: CandidateContext): string {
  let message = `Company: ${config.company || "the organization"}\n`;
  message += `Role: ${config.jobTitle}\n`;
  message += `Interview Type: ${config.interviewType}\n`;
  message += `Difficulty: ${config.difficulty}\n\n`;

  if (context.jobDescription) {
    message += `Job Description:\n${context.jobDescription.substring(0, 3000)}\n\n`;
  }

  if (context.candidateProfile) {
    message += `Candidate Profile:\n${context.candidateProfile.substring(0, 3000)}\n\n`;
  }

  message += "Please greet the candidate and ask your first interview question.";
  
  return message;
}

export async function startInterviewSession(
  config: InterviewConfig,
  context: CandidateContext
): Promise<{ sessionId: string; response: CoachResponse }> {
  if (!isAIConfigured()) {
    throw new Error("OpenAI integration is not configured. Please set up the OpenAI integration.");
  }

  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  const initialMessage = buildInitialMessage(config, context);
  
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: initialMessage },
  ];

  const openai = new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || undefined,
  });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages as any,
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 800,
    });

    const responseContent = completion.choices[0].message.content || "{}";
    const response: CoachResponse = JSON.parse(responseContent);

    messages.push({
      role: "assistant",
      content: responseContent,
    });

    sessions.set(sessionId, {
      id: sessionId,
      config,
      context,
      messages,
      createdAt: new Date(),
    });

    return { sessionId, response };
  } catch (error: any) {
    console.error("[Interview Coach] Error starting session:", error);
    throw new Error(`Failed to start interview session: ${error.message}`);
  }
}

export async function sendMessage(
  sessionId: string,
  userMessage: string
): Promise<CoachResponse> {
  const session = sessions.get(sessionId);
  
  if (!session) {
    throw new Error("Session not found or expired");
  }

  if (!isAIConfigured()) {
    throw new Error("OpenAI integration is not configured");
  }

  // Add user message to history
  session.messages.push({
    role: "user",
    content: userMessage,
  });

  const openai = new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || undefined,
  });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: session.messages as any,
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 800,
    });

    const responseContent = completion.choices[0].message.content || "{}";
    const response: CoachResponse = JSON.parse(responseContent);

    // Add assistant response to history
    session.messages.push({
      role: "assistant",
      content: responseContent,
    });

    return response;
  } catch (error: any) {
    console.error("[Interview Coach] Error sending message:", error);
    throw new Error(`Failed to process message: ${error.message}`);
  }
}

export function getSessionTranscript(sessionId: string): ChatMessage[] {
  const session = sessions.get(sessionId);
  
  if (!session) {
    throw new Error("Session not found or expired");
  }

  return session.messages.filter(msg => msg.role !== "system");
}

export function endSession(sessionId: string): void {
  sessions.delete(sessionId);
}
