import { supabase } from "@/lib/supabase";

export type AnalyticsEventType =
  | "page_view"
  | "lesson_generated"
  | "followup_asked"
  | "lesson_saved"
  | "user_signup"
  | "user_login"
  | "pwa_download";

export interface AnalyticsEvent {
  id: string;
  event_type: AnalyticsEventType;
  visitor_id: string;
  user_id?: string | null;
  user_name?: string | null;
  page_path?: string;
  topic?: string;
  interest?: string;
  academic_subject?: string;
  education_level?: string;
  ai_model?: string;
  device_type: "Desktop" | "Mobile" | "Tablet";
  os_name: string;
  browser_name: string;
  created_at: string;
}

const LOCAL_STORAGE_EVENTS_KEY = "learnmyway_analytics_events_v1";
const VISITOR_ID_KEY = "learnmyway_visitor_id_v1";
const ADMIN_SESSION_KEY = "learnmyway_admin_unlocked_v1";

export const ADMIN_EMAIL = "julianjulius305@gmail.com";
const ADMIN_PIN = "032009";

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

export function isAdminPinUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(ADMIN_SESSION_KEY) === "true";
  } catch {
    return false;
  }
}

export function verifyAdminPin(pin: string): boolean {
  if (pin.trim() === ADMIN_PIN) {
    try {
      sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
      window.dispatchEvent(new Event("learnmyway:admin-change"));
    } catch {}
    return true;
  }
  return false;
}

export function lockAdminPin(): void {
  try {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    window.dispatchEvent(new Event("learnmyway:admin-change"));
  } catch {}
}

export function getVisitorId(): string {
  if (typeof window === "undefined") return "server";
  let vid = localStorage.getItem(VISITOR_ID_KEY);
  if (!vid) {
    vid = "vis_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    try {
      localStorage.setItem(VISITOR_ID_KEY, vid);
    } catch {}
  }
  return vid;
}

export function detectClientEnvironment(): {
  device_type: "Desktop" | "Mobile" | "Tablet";
  os_name: string;
  browser_name: string;
} {
  if (typeof navigator === "undefined") {
    return { device_type: "Desktop", os_name: "Unknown", browser_name: "Unknown" };
  }
  const ua = navigator.userAgent;

  let device_type: "Desktop" | "Mobile" | "Tablet" = "Desktop";
  if (/ipad|tablet/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) {
    device_type = "Tablet";
  } else if (/mobi|iphone|ipod|android/i.test(ua)) {
    device_type = "Mobile";
  }

  let os_name = "Other";
  if (/iphone|ipad|ipod/i.test(ua)) os_name = "iOS";
  else if (/macintosh|mac os x/i.test(ua)) os_name = "macOS";
  else if (/android/i.test(ua)) os_name = "Android";
  else if (/windows/i.test(ua)) os_name = "Windows";
  else if (/linux/i.test(ua)) os_name = "Linux";

  let browser_name = "Browser";
  if (/edg\//i.test(ua)) browser_name = "Edge";
  else if (/opr\//i.test(ua)) browser_name = "Opera";
  else if (/chrome|crios/i.test(ua)) browser_name = "Chrome";
  else if (/firefox|fxios/i.test(ua)) browser_name = "Firefox";
  else if (/safari/i.test(ua)) browser_name = "Safari";

  return { device_type, os_name, browser_name };
}

function saveEventLocally(event: AnalyticsEvent) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_EVENTS_KEY);
    const list: AnalyticsEvent[] = raw ? JSON.parse(raw) : [];
    list.unshift(event);
    if (list.length > 500) list.length = 500;
    localStorage.setItem(LOCAL_STORAGE_EVENTS_KEY, JSON.stringify(list));
  } catch {}
}

export function getLocalEvents(): AnalyticsEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_EVENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function trackEvent(
  event_type: AnalyticsEventType,
  meta: {
    user_id?: string | null;
    user_name?: string | null;
    page_path?: string;
    topic?: string;
    interest?: string;
    academic_subject?: string;
    education_level?: string;
    ai_model?: string;
  } = {}
): Promise<void> {
  const env = detectClientEnvironment();
  const event: AnalyticsEvent = {
    id: "evt_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7),
    event_type,
    visitor_id: getVisitorId(),
    user_id: meta.user_id || null,
    user_name: meta.user_name || null,
    page_path: meta.page_path || (typeof window !== "undefined" ? window.location.pathname : "/"),
    topic: meta.topic,
    interest: meta.interest,
    academic_subject: meta.academic_subject,
    education_level: meta.education_level,
    ai_model: meta.ai_model,
    device_type: env.device_type,
    os_name: env.os_name,
    browser_name: env.browser_name,
    created_at: new Date().toISOString(),
  };

  // 1. Save immediately in local cache
  saveEventLocally(event);

  // 2. Send to server-side analytics collector (/api/analytics)
  fetch("/api/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
  }).catch(() => {});

  // 3. Also attempt to insert into Supabase `analytics_events` table if configured
  try {
    await supabase.from("analytics_events").insert({
      event_type: event.event_type,
      visitor_id: event.visitor_id,
      user_id: event.user_id,
      user_name: event.user_name,
      page_path: event.page_path,
      topic: event.topic || null,
      interest: event.interest || null,
      academic_subject: event.academic_subject || null,
      education_level: event.education_level || null,
      ai_model: event.ai_model || null,
      device_type: event.device_type,
      os_name: event.os_name,
      browser_name: event.browser_name,
    });
  } catch {
    // Ignore if table not created yet in Supabase
  }
}

export async function fetchUnifiedAnalytics(): Promise<{
  events: AnalyticsEvent[];
  savedLessonsCount: number;
  profilesCount: number;
}> {
  const mergedMap = new Map<string, AnalyticsEvent>();

  // 1. Load local events
  for (const ev of getLocalEvents()) {
    mergedMap.set(ev.id, ev);
  }

  // 2. Load server-side events from /api/analytics
  try {
    const res = await fetch("/api/analytics");
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.events)) {
        for (const ev of data.events) {
          if (ev && ev.id) mergedMap.set(ev.id, ev);
        }
      }
    }
  } catch {}

  // 3. Load from Supabase `analytics_events` (if table exists) + `saved_lessons` + `profiles`
  let savedLessonsCount = 0;
  let profilesCount = 0;

  try {
    const { data: sbEvents } = await supabase
      .from("analytics_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);

    if (Array.isArray(sbEvents)) {
      for (const row of sbEvents) {
        const id = String(row.id);
        if (!mergedMap.has(id)) {
          mergedMap.set(id, {
            id,
            event_type: row.event_type,
            visitor_id: row.visitor_id || "anon",
            user_id: row.user_id,
            user_name: row.user_name,
            page_path: row.page_path || "/",
            topic: row.topic,
            interest: row.interest,
            academic_subject: row.academic_subject,
            education_level: row.education_level,
            ai_model: row.ai_model,
            device_type: row.device_type || "Desktop",
            os_name: row.os_name || "Unknown",
            browser_name: row.browser_name || "Browser",
            created_at: row.created_at,
          });
        }
      }
    }
  } catch {}

  try {
    const { count: sCount, data: savedRows } = await supabase
      .from("saved_lessons")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(100);

    if (typeof sCount === "number") savedLessonsCount = sCount;
    if (Array.isArray(savedRows)) {
      for (const row of savedRows) {
        const synId = "saved_" + row.id;
        if (!mergedMap.has(synId)) {
          mergedMap.set(synId, {
            id: synId,
            event_type: "lesson_saved",
            visitor_id: row.user_id || "student",
            user_id: row.user_id,
            user_name: "Student",
            page_path: "/",
            topic: row.topic,
            interest: row.interest,
            device_type: "Desktop",
            os_name: "Web",
            browser_name: "Browser",
            created_at: row.created_at,
          });
        }
      }
    }
  } catch {}

  try {
    const { count: pCount } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });
    if (typeof pCount === "number") profilesCount = pCount;
  } catch {}

  const events = Array.from(mergedMap.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return { events, savedLessonsCount, profilesCount };
}
