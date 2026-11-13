import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import { buildMasterSystemPrompt, GROQ_MODEL_POOL } from "./src/lib/prompt";

// Shared high-concurrency state for local dev middleware
const devLessonCache = new Map<string, { content: string; model: string; expiresAt: number }>();
const devInFlight = new Map<string, Promise<{ content: string; model: string }>>();
const devModelCooldown = new Map<string, number>();
const devAnalyticsEvents: Array<Record<string, unknown>> = [];
let devRoundRobin = 0;

function groqDevServerPlugin(env: Record<string, string>): Plugin {
  return {
    name: "groq-dev-server-plugin",
    configureServer(server) {
      server.middlewares.use("/api/analytics", async (req, res) => {
        res.setHeader("Content-Type", "application/json");
        if (req.method === "GET") {
          res.statusCode = 200;
          res.end(JSON.stringify({ events: devAnalyticsEvents.slice(0, 400), totalStored: devAnalyticsEvents.length }));
          return;
        }
        if (req.method === "POST") {
          const chunks: Buffer[] = [];
          req.on("data", (c: Buffer) => chunks.push(c));
          req.on("end", () => {
            try {
              const body = JSON.parse(Buffer.concat(chunks).toString());
              if (body && body.event_type) {
                devAnalyticsEvents.unshift({
                  ...body,
                  id: body.id || "evt_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7),
                  created_at: body.created_at || new Date().toISOString(),
                });
                if (devAnalyticsEvents.length > 1000) devAnalyticsEvents.length = 1000;
              }
              res.statusCode = 200;
              res.end(JSON.stringify({ ok: true }));
            } catch {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Invalid JSON" }));
            }
          });
          return;
        }
        res.statusCode = 405;
        res.end(JSON.stringify({ error: "Method not allowed" }));
      });

      server.middlewares.use("/api/generate-lesson", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Method not allowed. Use POST." }));
          return;
        }

        const rawKeys =
          env.GROQ_API_KEYS ||
          process.env.GROQ_API_KEYS ||
          env.GROQ_API_KEY ||
          process.env.GROQ_API_KEY ||
          "";
        const apiKeys = rawKeys
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean);

        if (apiKeys.length === 0) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              error:
                "GROQ_API_KEY is not configured. For production, set it in Supabase (Edge Functions > Secrets) or Vercel. For local testing, add GROQ_API_KEY=your_key to your .env file.",
            })
          );
          return;
        }

        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", async () => {
          try {
            const rawBody = Buffer.concat(chunks).toString();
            const body = JSON.parse(rawBody);
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
              topic,
              interest,
              educationLevel,
              academicSubject,
              studentName,
            });

            async function executePool(
              groqMessages: Array<{ role: string; content: string }>,
              maxTokens: number
            ): Promise<{ content: string; model: string }> {
              const now = Date.now();
              const startIdx = devRoundRobin++;
              const orderedModels: string[] = [];

              for (let i = 0; i < GROQ_MODEL_POOL.length; i++) {
                const m = GROQ_MODEL_POOL[(startIdx + i) % GROQ_MODEL_POOL.length];
                if ((devModelCooldown.get(m) || 0) <= now) {
                  orderedModels.push(m);
                }
              }
              for (const m of GROQ_MODEL_POOL) {
                if (!orderedModels.includes(m)) orderedModels.push(m);
              }

              let lastStatus = 502;
              let lastErrMsg = "Groq API error";

              for (let idx = 0; idx < orderedModels.length; idx++) {
                const modelName = orderedModels[idx];
                const apiKey = apiKeys[(startIdx + idx) % apiKeys.length];
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
                    lastErrMsg = errData?.error?.message || lastErrMsg;
                  } catch {}

                  if (response.status === 429) {
                    devModelCooldown.set(modelName, Date.now() + 25_000);
                    continue;
                  }
                  if (response.status === 400 || response.status === 404) {
                    devModelCooldown.set(modelName, Date.now() + 600_000);
                    continue;
                  }
                } catch (e) {
                  clearTimeout(timeout);
                  lastErrMsg = e instanceof Error ? e.message : "Network timeout";
                }
              }

              const error = new Error(
                lastStatus === 429
                  ? "The AI tutor is currently experiencing high demand. Please wait 5-10 seconds and try again."
                  : lastErrMsg
              ) as Error & { status?: number };
              error.status = lastStatus;
              throw error;
            }

            if (mode === "lesson") {
              if (!topic || !interest) {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: "Both 'topic' and 'interest' are required." }));
                return;
              }

              const cacheKey = [
                String(topic).trim().toLowerCase(),
                String(interest).trim().toLowerCase(),
                String(educationLevel).trim().toLowerCase(),
                String(academicSubject || "").trim().toLowerCase(),
              ].join("|");

              const cached = devLessonCache.get(cacheKey);
              if (cached && Date.now() < cached.expiresAt) {
                res.statusCode = 200;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ content: cached.content, model: cached.model, mode, cached: true }));
                return;
              }

              if (devInFlight.has(cacheKey)) {
                const shared = await devInFlight.get(cacheKey)!;
                res.statusCode = 200;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ...shared, mode, coalesced: true }));
                return;
              }

              const groqMessages = [
                { role: "system", content: systemPrompt },
                {
                  role: "user",
                  content: `Teach me about "${topic.trim()}" through a short, engaging story tailored to ${interest.trim()}. Do not use any asterisks (**) or section headers.`,
                },
              ];

              const promise = executePool(groqMessages, 550);
              devInFlight.set(cacheKey, promise);

              try {
                const result = await promise;
                if (devLessonCache.size >= 500) {
                  const firstKey = devLessonCache.keys().next().value;
                  if (firstKey) devLessonCache.delete(firstKey);
                }
                devLessonCache.set(cacheKey, {
                  ...result,
                  expiresAt: Date.now() + 1000 * 60 * 60 * 6,
                });
                res.statusCode = 200;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ...result, mode }));
              } finally {
                devInFlight.delete(cacheKey);
              }
            } else {
              const sanitizedHistory = (messages || []).slice(-6).map((m: { role?: string; content?: string }) => ({
                role: m.role === "assistant" ? "assistant" : "user",
                content: String(m.content || "").slice(0, 1200),
              }));
              const groqMessages = [{ role: "system", content: systemPrompt }, ...sanitizedHistory];
              const result = await executePool(groqMessages, 300);
              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ...result, mode }));
            }
          } catch (err: unknown) {
            const status = (err as { status?: number })?.status === 429 ? 429 : 500;
            const message = err instanceof Error ? err.message : "Failed to generate lesson response.";
            res.statusCode = status;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: message }));
          }
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      react(),
      tailwindcss(),
      groqDevServerPlugin(env),
      VitePWA({
        registerType: "prompt",
        // ── Manifest ──────────────────────────────────────────────────────────
        manifest: {
          name: "LearnMyWay",
          short_name: "LearnMyWay",
          description:
            "An AI-powered personalised learning platform that makes education engaging through storytelling.",
          theme_color: "#09090f",
          background_color: "#09090f",
          display: "standalone",
          orientation: "any",
          start_url: "/",
          scope: "/",
          icons: [
            {
              src: "/icons/icon-192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "/icons/icon-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "/icons/icon-192-maskable.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "maskable",
            },
            {
              src: "/icons/icon-512-maskable.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
            {
              src: "/icons/icon-192.svg",
              sizes: "any",
              type: "image/svg+xml",
              purpose: "any",
            },
          ],
        },

        // ── Workbox caching strategy ──────────────────────────────────────────
        workbox: {
          // Precache the app shell built assets (JS, CSS, HTML)
          globPatterns: ["**/*.{js,css,html,svg,png,woff,woff2}"],

          // Never cache: Supabase, Groq API, or any /api/ routes
          navigateFallback: "/index.html",
          navigateFallbackDenylist: [
            /^\/api\//,
            /supabase\.co/,
            /groq\.com/,
          ],

          runtimeCaching: [
            // Google Fonts — cache-first (long-lived, immutable)
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: "CacheFirst",
              options: {
                cacheName: "google-fonts-stylesheets",
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: "CacheFirst",
              options: {
                cacheName: "google-fonts-webfonts",
                cacheableResponse: { statuses: [0, 200] },
                expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },

            // Static images — cache-first
            {
              urlPattern: /\.(?:png|svg|jpg|jpeg|gif|webp|ico)$/i,
              handler: "CacheFirst",
              options: {
                cacheName: "learnmyway-images",
                expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },

            // EXPLICITLY skip Supabase & Groq — always go to network
            {
              urlPattern: ({ url }: { url: URL }) =>
                url.hostname.includes("supabase.co") ||
                url.hostname.includes("groq.com"),
              handler: "NetworkOnly",
            },

            // /api/ routes — network only
            {
              urlPattern: /^\/api\/.*/i,
              handler: "NetworkOnly",
            },
          ],

          // Allow the waiting SW to skip waiting when instructed by our UpdatePrompt
          skipWaiting: false,
          clientsClaim: true,
        },

        // Use public/sw.js and public/manifest.webmanifest in local dev
        devOptions: {
          enabled: false,
        },
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
      },
      dedupe: ["react", "react-dom"],
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
    server: {
      port: 3000,
      host: true,
    },
    preview: {
      port: 4173,
      host: true,
    },
  };
});
