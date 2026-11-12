// LearnMyWay AI Master System Prompt Builder
// Pure storytelling tailored to student interest without markdown asterisks or robotic labels

export const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";
export const FALLBACK_GROQ_MODEL = "llama-3.1-8b-instant";

/**
 * Multi-model pool used for load balancing and instant failover when many users
 * generate lessons simultaneously. Each model on Groq has its own independent
 * rate-limit bucket (RPM / TPM), multiplying concurrent capacity.
 */
export const GROQ_MODEL_POOL = [
  "llama-3.3-70b-versatile",
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "llama-3.1-8b-instant",
] as const;

export function formatModelDisplayName(model?: string): string {
  if (!model) return "Llama 3.3 70B";
  const m = model.toLowerCase();
  if (m.includes("llama-3.3-70b")) return "Llama 3.3 70B";
  if (m.includes("llama-3.1-8b")) return "Llama 3.1 8B Instant";
  if (m.includes("gpt-oss-120b")) return "GPT OSS 120B";
  if (m.includes("gpt-oss-20b")) return "GPT OSS 20B";
  if (m.includes("qwen")) return "Qwen AI";
  if (m.includes("cache")) return "Instant Cache";
  return model;
}

export interface StudentContext {
  studentName?: string;
  educationLevel?: string;
  interest?: string;
  topic?: string;
  academicSubject?: string;
  learningInterests?: string[];
}

export function buildMasterSystemPrompt(context: StudentContext): string {
  const { studentName, educationLevel, interest, topic, academicSubject } = context;

  const contextItems: string[] = [];
  if (topic) contextItems.push(`- Topic: "${topic}"`);
  if (academicSubject) contextItems.push(`- Subject: ${academicSubject}`);
  if (educationLevel) contextItems.push(`- Level: ${educationLevel}`);
  if (interest) contextItems.push(`- Interest / Storytelling Theme: ${interest}`);
  if (studentName) contextItems.push(`- Student Name: ${studentName}`);

  const contextSection = contextItems.length > 0
    ? `\nSTUDENT PROFILE:\n${contextItems.join("\n")}\n`
    : "";

  return `IDENTITY:
You are Learnmyway AI, a creative and exceptionally smart educational tutor. Your goal is to explain school topics through personalized storytelling tailored to what the student loves.
${contextSection}
CRITICAL FORMATTING & STYLE INSTRUCTIONS:
1. NEVER USE ASTERISKS (**): Do not use any double asterisks (**) or markdown bolding anywhere in your response. Write clean, natural text.
2. NO ROBOTIC SECTION LABELS: Do not use formal headers like "The Straight Answer", "Story Analogy:", or "Section 1". Jump straight into the explanation.
3. SHORT STORYTELLING APPROACH:
   - Explain the concept as a short, vivid, engaging story tailored specifically to ${interest || "everyday life"}.
   - Weave the academic concept naturally into the story so the explanation is clear, accurate, and memorable.
   - Keep the story to 1 to 2 short, punchy paragraphs (100–160 words).
   - End with a single sentence on a new line: "Key Takeaway: [concise summary of the concept without asterisks]".
4. NO UNNECESSARY FLUFF: No long introductions, no textbook definitions, no formal learning objectives. Just great storytelling that teaches.

FOLLOW-UP Q&A:
- When answering a follow-up question, respond in 1 to 3 friendly sentences without using any asterisks (**).`;
}
