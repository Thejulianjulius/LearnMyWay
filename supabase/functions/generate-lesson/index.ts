// Supabase Edge Function: generate-lesson
// High-Concurrency Server-side Groq Gateway for LearnMyWay
// Includes Multi-Model Load Balancing, Multi-Key Rotation, In-Flight Coalescing,
// LRU Lesson Caching, and Fair Per-IP Rate Limiting.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

export const MODEL_POOL = [
  "llama-3.3-70b-versatile",
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "llama-3.1-8b-instant",
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── Shared Edge Instance State ────────────────────────────────────────────────
const lessonCache = new Map<string, { content: string; model: string; expiresAt: number }>();
const inFlightRequests = new Map<string, Promise<{ content: string; model: string }>>();
const modelCooldownUntil = new Map<string, number>();
const ipRateWindows = new Map<string, { count: number; resetAt: number }>();
let roundRobinCounter = 0;

const CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours
const MAX_CACHE_ENTRIES = 500;
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_IP_PER_MIN = 25;

interface StudentContext {
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

  const contextSection =
    contextItems.length > 0 ? `\nSTUDENT PROFILE:\n${contextItems.join("\n")}\n` : "";

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

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = ipRateWindows.get(ip);
  if (!record || now > record.resetAt) {
    ipRateWindows.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (record.count >= MAX_REQUESTS_PER_IP_PER_MIN) {
    return false;
  }
  record.count += 1;
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed. Use POST." }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const clientIp =
    (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";

  if (!checkRateLimit(clientIp)) {
    return new Response(
      JSON.stringify({
        error: "You are generating lessons very quickly! Please wait 15–30 seconds and try again.",
      }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const rawKeys = Deno.env.get("GROQ_API_KEYS") || Deno.env.get("GROQ_API_KEY") || "";
  const apiKeys = rawKeys
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  if (apiKeys.length === 0) {
    return new Response(
      JSON.stringify({
        error:
          "Server configuration missing: GROQ_API_KEY secret is not configured in Supabase Edge Functions.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON in request body." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const {
    topic,
    interest,
    educationLevel = "High School",
    academicSubject,
    studentName,
    mode = "lesson",
    messages = [],
  } = body;

  const systemPrompt = buildMasterSystemPrompt({
    studentName: studentName ? String(studentName).slice(0, 50) : undefined,
    educationLevel: String(educationLevel).slice(0, 50),
    interest: interest ? String(interest).slice(0, 50) : undefined,
    topic: topic ? String(topic).slice(0, 200) : undefined,
    academicSubject: academicSubject ? String(academicSubject).slice(0, 100) : undefined,
  });

  async function executePool(
    groqMessages: Array<{ role: string; content: string }>,
    maxTokens: number
  ): Promise<{ content: string; model: string }> {
    const now = Date.now();
    const startIdx = roundRobinCounter++;
    const orderedModels: string[] = [];

    for (let i = 0; i < MODEL_POOL.length; i++) {
      const m = MODEL_POOL[(startIdx + i) % MODEL_POOL.length];
      if ((modelCooldownUntil.get(m) || 0) <= now) {
        orderedModels.push(m);
      }
    }
    for (const m of MODEL_POOL) {
      if (!orderedModels.includes(m)) orderedModels.push(m);
    }

    let lastStatus = 502;
    let lastErrMessage = "Groq API error";

    for (let idx = 0; idx < orderedModels.length; idx++) {
      const modelName = orderedModels[idx];
      const apiKey = apiKeys[(startIdx + idx) % apiKeys.length];
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 16000);

      try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: modelName,
            messages: groqMessages,
            temperature: 0.7,
            max_tokens: maxTokens,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          const rawContent = data.choices?.[0]?.message?.content || "";
          const content = rawContent.replace(/\*\*/g, "").replace(/^###?\s+/gm, "").trim();
          if (content) {
            return { content, model: modelName };
          }
        }

        lastStatus = response.status;
        try {
          const errJson = await response.json();
          lastErrMessage = errJson?.error?.message || lastErrMessage;
        } catch {}

        if (response.status === 429) {
          modelCooldownUntil.set(modelName, Date.now() + 25_000);
          continue;
        }
        if (response.status === 400 || response.status === 404) {
          modelCooldownUntil.set(modelName, Date.now() + 600_000);
          continue;
        }
      } catch (e) {
        clearTimeout(timeoutId);
        lastErrMessage = e instanceof Error ? e.message : "Network timeout";
      }
    }

    const error = new Error(
      lastStatus === 429
        ? "High student traffic right now — please wait a few seconds and try again."
        : `AI service error (${lastStatus}): ${lastErrMessage}`
    ) as Error & { status?: number };
    error.status = lastStatus;
    throw error;
  }

  try {
    if (mode === "lesson") {
      if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
        return new Response(JSON.stringify({ error: "A valid 'topic' string is required." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!interest || typeof interest !== "string" || interest.trim().length === 0) {
        return new Response(JSON.stringify({ error: "A valid 'interest' string is required." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const cacheKey = [
        topic.trim().toLowerCase(),
        interest.trim().toLowerCase(),
        String(educationLevel).trim().toLowerCase(),
        String(academicSubject || "").trim().toLowerCase(),
      ].join("|");

      const cached = lessonCache.get(cacheKey);
      if (cached && Date.now() < cached.expiresAt) {
        return new Response(
          JSON.stringify({ content: cached.content, model: cached.model, mode, cached: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (inFlightRequests.has(cacheKey)) {
        const shared = await inFlightRequests.get(cacheKey)!;
        return new Response(
          JSON.stringify({ ...shared, mode, coalesced: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const groqMessages = [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Teach me about "${topic.trim()}" through a short, engaging story tailored to ${interest.trim()}. Do not use any asterisks (**) or section headers.`,
        },
      ];

      const promise = executePool(groqMessages, 550);
      inFlightRequests.set(cacheKey, promise);

      try {
        const result = await promise;
        if (lessonCache.size >= MAX_CACHE_ENTRIES) {
          const oldest = lessonCache.keys().next().value;
          if (oldest) lessonCache.delete(oldest);
        }
        lessonCache.set(cacheKey, {
          ...result,
          expiresAt: Date.now() + CACHE_TTL_MS,
        });
        return new Response(JSON.stringify({ ...result, mode }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } finally {
        inFlightRequests.delete(cacheKey);
      }
    } else {
      const sanitizedHistory = (messages || []).slice(-6).map((m: any) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content || "").slice(0, 1200),
      }));
      const groqMessages = [{ role: "system", content: systemPrompt }, ...sanitizedHistory];
      const result = await executePool(groqMessages, 300);
      return new Response(JSON.stringify({ ...result, mode }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status === 429 ? 429 : 502;
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unable to connect to AI provider.",
      }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
