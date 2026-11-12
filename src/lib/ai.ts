import { supabase } from "@/lib/supabase";
import type { StudentContext } from "@/lib/prompt";

export interface GenerateLessonParams extends StudentContext {
  topic: string;
  interest: string;
}

export interface FollowUpParams extends StudentContext {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface AIResponse {
  content: string;
  model: string;
  cached?: boolean;
}

// ── Client-side Memory Cache & In-Flight Request Deduplication ───────────────
const clientLessonCache = new Map<string, AIResponse>();
const clientInFlight = new Map<string, Promise<AIResponse>>();

function makeLessonCacheKey(params: GenerateLessonParams): string {
  return [
    params.topic.trim().toLowerCase(),
    params.interest.trim().toLowerCase(),
    (params.educationLevel || "High School").trim().toLowerCase(),
    (params.academicSubject || "").trim().toLowerCase(),
  ].join("|");
}

/**
 * Generates an intelligent, personalized storytelling lesson via high-concurrency
 * server-side gateways with multi-layer caching, in-flight deduplication, and
 * automatic failover between Supabase Edge Functions and Vercel/Local API routes.
 */
export async function generateLessonAI(params: GenerateLessonParams): Promise<AIResponse> {
  const { topic, interest, educationLevel, studentName, academicSubject } = params;

  if (!topic || topic.trim().length === 0) {
    throw new Error("Please enter a valid school topic.");
  }
  if (!interest || interest.trim().length === 0) {
    throw new Error("Please select an interest.");
  }

  const cacheKey = makeLessonCacheKey(params);

  // 1. Check fast client-side memory cache
  const memCached = clientLessonCache.get(cacheKey);
  if (memCached) {
    return { ...memCached, cached: true };
  }

  // 2. Coalesce concurrent identical clicks on the client
  if (clientInFlight.has(cacheKey)) {
    return clientInFlight.get(cacheKey)!;
  }

  const requestPromise = (async (): Promise<AIResponse> => {
    const payload = {
      mode: "lesson",
      topic: topic.trim(),
      interest: interest.trim(),
      educationLevel: educationLevel || "High School",
      studentName: studentName?.trim() || undefined,
      academicSubject: academicSubject?.trim() || undefined,
    };

    let lastError = "";

    // 3. Primary Gateway: Local / Vercel Serverless API (/api/generate-lesson)
    try {
      const apiRes = await fetch("/api/generate-lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const apiData = await apiRes.json().catch(() => ({}));

      if (apiRes.ok && apiData?.content && typeof apiData.content === "string") {
        const result: AIResponse = {
          content: apiData.content,
          model: apiData.model || "llama-3.3-70b-versatile",
          cached: Boolean(apiData.cached),
        };
        clientLessonCache.set(cacheKey, result);
        return result;
      }

      if (apiData?.error) {
        lastError = apiData.error;
      }
    } catch (apiErr: unknown) {
      lastError = apiErr instanceof Error ? apiErr.message : "";
    }

    // 4. Secondary Gateway Failover: Supabase Edge Function
    try {
      const { data, error } = await supabase.functions.invoke("generate-lesson", {
        body: payload,
      });

      if (!error && data && typeof data.content === "string") {
        const result: AIResponse = {
          content: data.content,
          model: data.model || "llama-3.3-70b-versatile",
          cached: Boolean(data.cached),
        };
        clientLessonCache.set(cacheKey, result);
        return result;
      }

      if (error?.message) {
        lastError = lastError || error.message;
      }
    } catch (edgeErr: unknown) {
      if (!lastError && edgeErr instanceof Error) {
        lastError = edgeErr.message;
      }
    }

    throw new Error(
      lastError ||
        "Unable to contact the AI lesson service. Please try again in a few seconds."
    );
  })();

  clientInFlight.set(cacheKey, requestPromise);
  try {
    return await requestPromise;
  } finally {
    clientInFlight.delete(cacheKey);
  }
}

/**
 * Sends a follow-up question to the LearnMyWay AI tutor while preserving lesson context.
 */
export async function askFollowUpQuestionAI(params: FollowUpParams): Promise<AIResponse> {
  const { messages, topic, interest, educationLevel, studentName } = params;

  if (!messages || messages.length === 0) {
    throw new Error("No messages provided for follow-up.");
  }

  const payload = {
    mode: "followup",
    topic,
    interest,
    educationLevel,
    studentName,
    messages,
  };

  let lastError = "";

  // 1. Primary Gateway: Local / Vercel Serverless API (/api/generate-lesson)
  try {
    const localRes = await fetch("/api/generate-lesson", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const localData = await localRes.json().catch(() => ({}));

    if (localRes.ok && localData?.content) {
      return {
        content: localData.content,
        model: localData.model || "llama-3.3-70b-versatile",
      };
    }

    if (localData?.error) {
      lastError = localData.error;
    }
  } catch (localErr: unknown) {
    lastError = localErr instanceof Error ? localErr.message : "";
  }

  // 2. Secondary Gateway Failover: Supabase Edge Function
  try {
    const { data, error } = await supabase.functions.invoke("generate-lesson", {
      body: payload,
    });

    if (!error && data && typeof data.content === "string") {
      return {
        content: data.content,
        model: data.model || "llama-3.3-70b-versatile",
      };
    }

    if (error?.message) {
      lastError = lastError || error.message;
    }
  } catch (edgeErr: unknown) {
    if (!lastError && edgeErr instanceof Error) {
      lastError = edgeErr.message;
    }
  }

  throw new Error(lastError || "Unable to contact AI tutor service.");
}
