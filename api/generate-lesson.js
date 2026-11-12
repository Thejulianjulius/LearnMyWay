// Vercel Serverless Function: /api/generate-lesson
// High-Concurrency AI Gateway with Multi-Model Load Balancing, Key Rotation,
// In-Flight Request Coalescing, LRU Lesson Caching, and Fair Per-IP Rate Limiting.

const MODEL_POOL = [
  "llama-3.3-70b-versatile",
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "llama-3.1-8b-instant",
];

// ── Shared In-Memory State (persists across warm serverless invocations) ─────
const lessonCache = new Map(); // key -> { content, model, expiresAt }
const inFlightRequests = new Map(); // key -> Promise<{ content, model }>
const modelCooldownUntil = new Map(); // model -> timestamp
const ipRateWindows = new Map(); // ip -> { count, resetAt }
let roundRobinCounter = 0;

const CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours
const MAX_CACHE_ENTRIES = 500;
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS_PER_IP_PER_MIN = 25;

function getApiKeys() {
  const raw = process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || "";
  return raw
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

function checkRateLimit(ip) {
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

function makeCacheKey({ topic, interest, educationLevel, academicSubject }) {
  return [
    String(topic || "").trim().toLowerCase(),
    String(interest || "").trim().toLowerCase(),
    String(educationLevel || "high school").trim().toLowerCase(),
    String(academicSubject || "").trim().toLowerCase(),
  ].join("|");
}

function getCachedLesson(key) {
  const item = lessonCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    lessonCache.delete(key);
    return null;
  }
  return item;
}

function setCachedLesson(key, value) {
  if (lessonCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = lessonCache.keys().next().value;
    if (oldestKey) lessonCache.delete(oldestKey);
  }
  lessonCache.set(key, {
    ...value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

function buildMasterSystemPrompt({ studentName, educationLevel, interest, topic, academicSubject }) {
  const contextItems = [];
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

async function executeGroqWithPool(groqMessages, maxTokens, apiKeys) {
  const now = Date.now();
  const startIdx = roundRobinCounter++;

  // Order models: healthy models first (starting from round-robin index for load distribution), then cooling-down models
  const orderedModels = [];
  for (let i = 0; i < MODEL_POOL.length; i++) {
    const m = MODEL_POOL[(startIdx + i) % MODEL_POOL.length];
    const cooldown = modelCooldownUntil.get(m) || 0;
    if (cooldown <= now) orderedModels.push(m);
  }
  for (const m of MODEL_POOL) {
    if (!orderedModels.includes(m)) orderedModels.push(m);
  }

  let lastStatus = 502;
  let lastErrorMsg = "AI service temporarily busy.";

  for (let mIdx = 0; mIdx < orderedModels.length; mIdx++) {
    const modelName = orderedModels[mIdx];
    const apiKey = apiKeys[(startIdx + mIdx) % apiKeys.length];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 16000);

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

      clearTimeout(timeout);

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
        const errData = await response.json();
        lastErrorMsg = errData?.error?.message || lastErrorMsg;
      } catch {}

      if (response.status === 429) {
        // Put this model on a 25-second cooldown and immediately fail over to the next model
        modelCooldownUntil.set(modelName, Date.now() + 25_000);
        continue;
      }

      if (response.status === 400 || response.status === 404) {
        // Model unavailable on this account, cool down for 10 minutes and try next
        modelCooldownUntil.set(modelName, Date.now() + 600_000);
        continue;
      }
    } catch (err) {
      clearTimeout(timeout);
      lastErrorMsg = err instanceof Error ? err.message : "Network timeout";
    }
  }

  const err = new Error(
    lastStatus === 429
      ? "High student traffic right now — please wait a few seconds and try again."
      : lastErrorMsg
  );
  err.status = lastStatus;
  throw err;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const clientIp =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    "unknown";

  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({
      error: "You are generating lessons very quickly! Please wait 15–30 seconds before trying again.",
    });
  }

  const apiKeys = getApiKeys();
  if (apiKeys.length === 0) {
    return res.status(500).json({
      error:
        "GROQ_API_KEY is not configured. Set GROQ_API_KEY in your Vercel or Supabase environment variables.",
    });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const {
      topic,
      interest,
      educationLevel = "High School",
      academicSubject,
      studentName,
      mode = "lesson",
      messages = [],
    } = body;

    if (mode === "lesson") {
      if (!topic || !interest) {
        return res.status(400).json({ error: "Both 'topic' and 'interest' are required." });
      }

      const cacheKey = makeCacheKey({ topic, interest, educationLevel, academicSubject });
      const cached = getCachedLesson(cacheKey);
      if (cached) {
        return res.status(200).json({
          content: cached.content,
          model: cached.model,
          mode,
          cached: true,
        });
      }

      // Coalesce identical concurrent requests so 50 simultaneous students trigger only 1 AI call
      if (inFlightRequests.has(cacheKey)) {
        const sharedResult = await inFlightRequests.get(cacheKey);
        return res.status(200).json({ ...sharedResult, mode, coalesced: true });
      }

      const systemPrompt = buildMasterSystemPrompt({
        topic,
        interest,
        educationLevel,
        academicSubject,
        studentName,
      });

      const groqMessages = [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Teach me about "${String(topic).trim()}" through a short, engaging story tailored to ${String(interest).trim()}. Do not use any asterisks (**) or section headers.`,
        },
      ];

      const promise = executeGroqWithPool(groqMessages, 550, apiKeys);
      inFlightRequests.set(cacheKey, promise);

      try {
        const result = await promise;
        setCachedLesson(cacheKey, result);
        return res.status(200).json({ ...result, mode });
      } finally {
        inFlightRequests.delete(cacheKey);
      }
    } else {
      const systemPrompt = buildMasterSystemPrompt({
        topic,
        interest,
        educationLevel,
        academicSubject,
        studentName,
      });

      const sanitizedHistory = (messages || []).slice(-6).map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content || "").slice(0, 1200),
      }));

      const groqMessages = [{ role: "system", content: systemPrompt }, ...sanitizedHistory];
      const result = await executeGroqWithPool(groqMessages, 300, apiKeys);
      return res.status(200).json({ ...result, mode });
    }
  } catch (err) {
    const status = err?.status === 429 ? 429 : 502;
    return res.status(status).json({
      error: err instanceof Error ? err.message : "Failed to generate lesson response.",
    });
  }
}
