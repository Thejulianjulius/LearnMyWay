import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchUnifiedAnalytics,
  isAdminEmail,
  isAdminPinUnlocked,
  verifyAdminPin,
  lockAdminPin,
  type AnalyticsEvent,
  type AnalyticsEventType,
} from "@/lib/analytics";
import { formatModelDisplayName } from "@/lib/prompt";
import { INTERESTS } from "@/lib/constants";
import {
  BarChart3,
  Eye,
  Sparkles,
  MessageCircle,
  Bookmark,
  Download,
  Users,
  RefreshCw,
  Monitor,
  Smartphone,
  Clock,
  TrendingUp,
  Activity,
  Lock,
  KeyRound,
  LogOut,
} from "lucide-react";

type FilterType = "all" | AnalyticsEventType;

function formatRelativeTime(isoString: string): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(isoString).getTime()) / 1000));
  if (diffSec < 10) return "Just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function getEventBadge(type: AnalyticsEventType) {
  switch (type) {
    case "page_view":
      return {
        label: "Web Visit",
        color: "bg-sky-500/15 text-sky-300 border-sky-500/30",
      };
    case "lesson_generated":
      return {
        label: "Lesson Generated",
        color: "bg-violet-500/20 text-violet-200 border-violet-500/35",
      };
    case "followup_asked":
      return {
        label: "Tutor Follow-up",
        color: "bg-indigo-500/20 text-indigo-200 border-indigo-500/35",
      };
    case "lesson_saved":
      return {
        label: "Lesson Saved",
        color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
      };
    case "pwa_download":
      return {
        label: "App Download",
        color: "bg-pink-500/15 text-pink-300 border-pink-500/30",
      };
    case "user_signup":
      return {
        label: "Student Signup",
        color: "bg-amber-500/15 text-amber-300 border-amber-500/30",
      };
    case "user_login":
      return {
        label: "Student Login",
        color: "bg-teal-500/15 text-teal-300 border-teal-500/30",
      };
  }
}

export default function Analytics() {
  const { user } = useAuth();
  const [pinUnlocked, setPinUnlocked] = useState(isAdminPinUnlocked);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");

  const isAuthorized = isAdminEmail(user?.email) || pinUnlocked;

  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [savedLessonsCount, setSavedLessonsCount] = useState(0);
  const [profilesCount, setProfilesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");

  const loadAnalytics = useCallback(async (isSilent = false) => {
    if (!isAuthorized) return;
    if (!isSilent) setRefreshing(true);
    try {
      const data = await fetchUnifiedAnalytics();
      setEvents(data.events);
      setSavedLessonsCount(data.savedLessonsCount);
      setProfilesCount(data.profilesCount);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthorized]);

  useEffect(() => {
    if (isAuthorized) {
      loadAnalytics(false);
    }
  }, [isAuthorized, loadAnalytics]);

  useEffect(() => {
    if (!autoRefresh || !isAuthorized) return;
    const timer = setInterval(() => {
      loadAnalytics(true);
    }, 10_000);
    return () => clearInterval(timer);
  }, [autoRefresh, isAuthorized, loadAnalytics]);

  const metrics = useMemo(() => {
    const pageViews = events.filter((e) => e.event_type === "page_view");
    const lessonsGenerated = events.filter((e) => e.event_type === "lesson_generated");
    const followups = events.filter((e) => e.event_type === "followup_asked");
    const savedEvents = events.filter((e) => e.event_type === "lesson_saved");
    const pwaDownloads = events.filter((e) => e.event_type === "pwa_download");

    const uniqueVisitors = new Set(events.map((e) => e.visitor_id)).size;

    // Interest distribution
    const interestCounts = new Map<string, number>();
    for (const ev of [...lessonsGenerated, ...savedEvents]) {
      if (ev.interest) {
        const key = ev.interest.trim();
        interestCounts.set(key, (interestCounts.get(key) || 0) + 1);
      }
    }
    const totalInterestEvents = Array.from(interestCounts.values()).reduce((a, b) => a + b, 0) || 1;
    const topInterests = INTERESTS.map((item) => {
      const count = interestCounts.get(item.label) || interestCounts.get(item.id) || 0;
      return {
        ...item,
        count,
        pct: Math.round((count / totalInterestEvents) * 100),
      };
    }).sort((a, b) => b.count - a.count);

    // Top topics
    const topicCounts = new Map<string, { topic: string; count: number; interest?: string }>();
    for (const ev of [...lessonsGenerated, ...savedEvents]) {
      if (ev.topic) {
        const norm = ev.topic.trim().toLowerCase();
        const existing = topicCounts.get(norm);
        if (existing) {
          existing.count += 1;
        } else {
          topicCounts.set(norm, {
            topic: ev.topic.trim(),
            count: 1,
            interest: ev.interest,
          });
        }
      }
    }
    const topTopics = Array.from(topicCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Device & OS breakdown
    let desktopCount = 0;
    let mobileCount = 0;
    const osCounts = new Map<string, number>();
    for (const ev of events) {
      if (ev.device_type === "Mobile" || ev.device_type === "Tablet") {
        mobileCount += 1;
      } else {
        desktopCount += 1;
      }
      if (ev.os_name && ev.os_name !== "Unknown") {
        osCounts.set(ev.os_name, (osCounts.get(ev.os_name) || 0) + 1);
      }
    }
    const totalDeviceEvents = desktopCount + mobileCount || 1;
    const desktopPct = Math.round((desktopCount / totalDeviceEvents) * 100);
    const mobilePct = 100 - desktopPct;

    // Last 7 days chart
    const days: Array<{ label: string; dateStr: string; visits: number; lessons: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("en-US", { weekday: "short" });
      days.push({ label, dateStr, visits: 0, lessons: 0 });
    }
    for (const ev of events) {
      const dStr = ev.created_at?.slice(0, 10);
      const bucket = days.find((d) => d.dateStr === dStr);
      if (bucket) {
        if (ev.event_type === "page_view") bucket.visits += 1;
        if (ev.event_type === "lesson_generated") bucket.lessons += 1;
      }
    }
    const maxDayVal = Math.max(1, ...days.map((d) => Math.max(d.visits, d.lessons)));

    return {
      totalPageViews: pageViews.length,
      uniqueVisitors,
      totalLessons: lessonsGenerated.length,
      totalFollowups: followups.length,
      totalSaved: Math.max(savedLessonsCount, savedEvents.length),
      totalPwaDownloads: pwaDownloads.length,
      topInterests,
      topTopics,
      desktopPct,
      mobilePct,
      osList: Array.from(osCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
      days,
      maxDayVal,
    };
  }, [events, savedLessonsCount]);

  const filteredEvents = useMemo(() => {
    if (activeFilter === "all") return events.slice(0, 60);
    return events.filter((e) => e.event_type === activeFilter).slice(0, 60);
  }, [events, activeFilter]);

  if (!isAuthorized) {
    return (
      <div className="px-4 py-16 flex items-center justify-center min-h-[75vh]">
        <div className="w-full max-w-md bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center mx-auto shadow-lg shadow-violet-500/30">
              <Lock className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-extrabold text-white">Owner Analytics</h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              This dashboard is restricted to the application owner. Enter your Admin Passcode or log in with your admin email to continue.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (verifyAdminPin(pinInput)) {
                setPinUnlocked(true);
                setPinError("");
              } else {
                setPinError("Invalid Admin Passcode. Please try again.");
              }
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Admin Passcode
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    setPinError("");
                  }}
                  placeholder="Enter your 6-digit PIN..."
                  className="w-full bg-white/5 border border-white/15 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/60 focus:border-violet-400 transition-all"
                  autoFocus
                />
              </div>
              {pinError && (
                <p className="text-xs text-red-300 mt-2">{pinError}</p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-400 hover:to-indigo-400 text-white shadow-lg shadow-violet-500/30 transition-all cursor-pointer"
            >
              Unlock Analytics
            </button>
          </form>

          <div className="pt-4 border-t border-white/10 text-center space-y-2">
            <p className="text-xs text-slate-400">
              Or sign in with your owner account
            </p>
            <Link
              href="/login"
              className="inline-block text-xs font-semibold text-violet-300 hover:text-violet-200 underline"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-8 md:py-10">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                  Application Analytics
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Track web visits, lessons generated, AI tutor chats, student signups, and app downloads in one place.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                autoRefresh
                  ? "bg-violet-500/20 border-violet-500/40 text-violet-200"
                  : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Auto-Refresh: {autoRefresh ? "On (10s)" : "Off"}</span>
            </button>
            <button
              onClick={() => loadAnalytics(false)}
              disabled={refreshing}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 border border-white/15 text-white transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
            {pinUnlocked && !isAdminEmail(user?.email) && (
              <button
                onClick={() => {
                  lockAdminPin();
                  setPinUnlocked(false);
                  setPinInput("");
                }}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 transition-all flex items-center gap-1.5 cursor-pointer"
                title="Lock Analytics"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Lock</span>
              </button>
            )}
          </div>
        </div>

        {/* Top KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Web Visits */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 sm:p-5 space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>Web Visits</span>
              <div className="w-8 h-8 rounded-lg bg-sky-500/15 text-sky-400 flex items-center justify-center">
                <Eye className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white">
              {metrics.totalPageViews}
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-1">
              <Users className="w-3 h-3 text-sky-400" />
              <span>{metrics.uniqueVisitors} unique visitors</span>
            </div>
          </div>

          {/* Lessons Generated */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 sm:p-5 space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>Lessons Generated</span>
              <div className="w-8 h-8 rounded-lg bg-violet-500/15 text-violet-400 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white">
              {metrics.totalLessons}
            </div>
            <div className="text-[11px] text-slate-400">
              Guests & registered students
            </div>
          </div>

          {/* Tutor Follow-up Questions */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 sm:p-5 space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>Tutor Follow-ups</span>
              <div className="w-8 h-8 rounded-lg bg-indigo-500/15 text-indigo-400 flex items-center justify-center">
                <MessageCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white">
              {metrics.totalFollowups}
            </div>
            <div className="text-[11px] text-slate-400">
              Interactive Q&A messages
            </div>
          </div>

          {/* Saved Lessons & Students */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 sm:p-5 space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>Saved Lessons</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                <Bookmark className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white">
              {metrics.totalSaved}
            </div>
            <div className="text-[11px] text-slate-400">
              {profilesCount > 0 ? `${profilesCount} student profiles` : "Bookmarked in Supabase"}
            </div>
          </div>

          {/* PWA Downloads */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 sm:p-5 space-y-2 col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>App Downloads</span>
              <div className="w-8 h-8 rounded-lg bg-pink-500/15 text-pink-400 flex items-center justify-center">
                <Download className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white">
              {metrics.totalPwaDownloads}
            </div>
            <div className="text-[11px] text-slate-400">
              PWA & macOS app installs
            </div>
          </div>
        </div>

        {/* Middle Row: 7-Day Activity Chart + Popular Interests + Top Topics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 7-Day Activity Chart */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-violet-400" />
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    7-Day Activity
                  </h2>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-sky-400 inline-block" /> Visits
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-violet-400 inline-block" /> Lessons
                  </span>
                </div>
              </div>

              <div className="h-44 flex items-end justify-between gap-2 pt-4 px-1">
                {metrics.days.map((d) => {
                  const visitH = Math.max(6, Math.round((d.visits / metrics.maxDayVal) * 130));
                  const lessonH = Math.max(6, Math.round((d.lessons / metrics.maxDayVal) * 130));
                  return (
                    <div key={d.dateStr} className="flex-1 flex flex-col items-center gap-2">
                      <div className="w-full flex items-end justify-center gap-1 h-36">
                        <div
                          style={{ height: `${visitH}px` }}
                          title={`${d.visits} visits on ${d.dateStr}`}
                          className="w-2.5 sm:w-3 rounded-t-md bg-sky-400/80 hover:bg-sky-300 transition-all"
                        />
                        <div
                          style={{ height: `${lessonH}px` }}
                          title={`${d.lessons} lessons on ${d.dateStr}`}
                          className="w-2.5 sm:w-3 rounded-t-md bg-violet-400/90 hover:bg-violet-300 transition-all"
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">{d.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Device Breakdown Footer */}
            <div className="pt-4 mt-4 border-t border-white/10 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Monitor className="w-3.5 h-3.5 text-violet-400" /> Desktop ({metrics.desktopPct}%)
                </span>
                <span className="flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-pink-400" /> Mobile ({metrics.mobilePct}%)
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden flex">
                <div
                  style={{ width: `${metrics.desktopPct}%` }}
                  className="bg-violet-500 h-full transition-all"
                />
                <div
                  style={{ width: `${metrics.mobilePct}%` }}
                  className="bg-pink-500 h-full transition-all"
                />
              </div>
            </div>
          </div>

          {/* Popular Learning Interests */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Popular Learning Themes
            </h2>
            <div className="space-y-3">
              {metrics.topInterests.map((item) => (
                <div key={item.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-slate-200 font-medium">
                      <span>{item.emoji}</span>
                      <span>{item.label}</span>
                    </span>
                    <span className="text-slate-400">
                      {item.count} ({item.pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                    <div
                      style={{ width: `${Math.max(item.count > 0 ? 6 : 0, item.pct)}%` }}
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-400 transition-all"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Searched School Topics */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Top Searched School Topics
            </h2>
            {metrics.topTopics.length === 0 ? (
              <div className="text-xs text-slate-400 py-8 text-center">
                No topics searched yet. Generate a lesson on the home page to see live topic rankings!
              </div>
            ) : (
              <div className="space-y-2.5">
                {metrics.topTopics.map((item, idx) => (
                  <div
                    key={item.topic}
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-300 font-bold text-[11px] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="text-white font-semibold truncate capitalize">
                        {item.topic}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {item.interest && (
                        <span className="px-2 py-0.5 rounded-md bg-white/5 text-slate-300 text-[11px]">
                          {item.interest}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-md bg-violet-500/20 text-violet-200 font-bold">
                        {item.count}x
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Live Real-Time Activity Stream */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-violet-400" />
                <span>Real-Time Activity Stream</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Every visit, generated lesson, follow-up question, and app download as it happens
              </p>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: "all", label: "All Activity" },
                  { id: "page_view", label: "Web Visits" },
                  { id: "lesson_generated", label: "Lessons" },
                  { id: "followup_asked", label: "Follow-ups" },
                  { id: "lesson_saved", label: "Saved" },
                  { id: "pwa_download", label: "Downloads" },
                ] as Array<{ id: FilterType; label: string }>
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeFilter === tab.id
                      ? "bg-violet-500 text-white shadow-sm shadow-violet-500/30"
                      : "bg-white/5 text-slate-400 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-slate-400">
              Loading real-time activity...
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">
              No matching events yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-3">Event</th>
                    <th className="py-3 px-3">User / Visitor</th>
                    <th className="py-3 px-3">Details (Topic / Page / Theme)</th>
                    <th className="py-3 px-3">Device / OS</th>
                    <th className="py-3 px-3 text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs">
                  {filteredEvents.map((ev) => {
                    const badge = getEventBadge(ev.event_type);
                    return (
                      <tr key={ev.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${badge.color}`}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-slate-300 font-medium">
                          {ev.user_name ? (
                            <span className="text-violet-200">{ev.user_name}</span>
                          ) : (
                            <span className="text-slate-400">
                              Guest ({ev.visitor_id.slice(0, 8)})
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-200">
                          {ev.topic ? (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-semibold text-white">{ev.topic}</span>
                              {ev.interest && (
                                <span className="px-2 py-0.5 rounded bg-violet-500/15 text-violet-300 text-[11px]">
                                  {ev.interest}
                                </span>
                              )}
                              {ev.ai_model && (
                                <span className="text-[11px] text-slate-400">
                                  • {formatModelDisplayName(ev.ai_model)}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 font-mono text-[11px]">
                              Visited {ev.page_path || "/"}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-slate-400">
                          {ev.device_type} • {ev.os_name} ({ev.browser_name})
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-right text-slate-400">
                          {formatRelativeTime(ev.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
