// Vercel Serverless Function: /api/analytics
// Stores and returns real-time application telemetry (page views, lessons generated,
// follow-up questions, saved lessons, and PWA downloads) across concurrent users.

const globalEvents = [];
const MAX_EVENTS = 1000;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method === "GET") {
    return res.status(200).json({
      events: globalEvents.slice(0, 400),
      totalStored: globalEvents.length,
    });
  }

  if (req.method === "POST") {
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      if (!body.event_type) {
        return res.status(400).json({ error: "event_type is required" });
      }
      const event = {
        id: body.id || "evt_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7),
        event_type: String(body.event_type),
        visitor_id: String(body.visitor_id || "anon"),
        user_id: body.user_id || null,
        user_name: body.user_name || null,
        page_path: String(body.page_path || "/"),
        topic: body.topic ? String(body.topic) : undefined,
        interest: body.interest ? String(body.interest) : undefined,
        academic_subject: body.academic_subject ? String(body.academic_subject) : undefined,
        education_level: body.education_level ? String(body.education_level) : undefined,
        ai_model: body.ai_model ? String(body.ai_model) : undefined,
        device_type: body.device_type || "Desktop",
        os_name: body.os_name || "Unknown",
        browser_name: body.browser_name || "Browser",
        created_at: body.created_at || new Date().toISOString(),
      };

      globalEvents.unshift(event);
      if (globalEvents.length > MAX_EVENTS) {
        globalEvents.length = MAX_EVENTS;
      }

      return res.status(200).json({ ok: true, id: event.id });
    } catch {
      return res.status(400).json({ error: "Invalid analytics payload" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
