import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { WHATSAPP_CHANNEL_URL } from "@/lib/constants";
import { trackEvent } from "@/lib/analytics";
import { MessageCircle, X, Bell, Sparkles, Lightbulb, ExternalLink } from "lucide-react";

const SESSION_DISMISSED_KEY = "learnmyway_whatsapp_popup_seen_v1";

/**
 * WhatsAppChannelModal — Appears when a user enters the site to invite them
 * to join the official LearnMyWay WhatsApp Channel for updates & feature suggestions.
 * Also renders a subtle floating WhatsApp pill in the bottom-right corner after dismissal
 * so users can always reopen or join anytime.
 */
export function WhatsAppChannelModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Show popup shortly after entering the site if not already dismissed in this tab session
    const seenInSession = sessionStorage.getItem(SESSION_DISMISSED_KEY);
    if (!seenInSession) {
      const timer = setTimeout(() => {
        setOpen(true);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    try {
      sessionStorage.setItem(SESSION_DISMISSED_KEY, "true");
    } catch {}
    setOpen(false);
  };

  const handleJoinClick = () => {
    trackEvent("page_view", {
      page_path: "/whatsapp-channel-join",
      topic: "WhatsApp Channel Click",
    });
    try {
      sessionStorage.setItem(SESSION_DISMISSED_KEY, "true");
    } catch {}
    setOpen(false);
  };

  return (
    <>
      {/* Subtle Floating WhatsApp Community Pill when modal is closed */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-20 md:bottom-5 right-4 z-40 flex items-center gap-2 px-3.5 py-2 rounded-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white text-xs font-bold shadow-lg shadow-emerald-500/30 hover:scale-105 transition-all cursor-pointer"
          aria-label="Join LearnMyWay WhatsApp Channel"
        >
          <MessageCircle className="w-4 h-4 fill-white/20" />
          <span className="hidden sm:inline">WhatsApp Channel</span>
        </button>
      )}

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[110] flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Join the LearnMyWay WhatsApp Channel"
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
              onClick={handleClose}
            />

            {/* Popup Card */}
            <div className="relative w-full max-w-md rounded-3xl bg-slate-900 border border-emerald-500/35 p-6 sm:p-7 shadow-2xl shadow-emerald-950/60 animate-in fade-in zoom-in-95 duration-300 overflow-hidden">
              {/* Top Ambient Glow */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-72 h-40 rounded-full bg-gradient-to-b from-emerald-500/25 via-violet-500/10 to-transparent blur-2xl"
              />

              {/* Close Button */}
              <button
                type="button"
                onClick={handleClose}
                className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Close popup"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Icon & Header */}
              <div className="relative text-center space-y-3 mb-5">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 via-emerald-500 to-green-600 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30">
                  <MessageCircle className="w-8 h-8 text-white fill-white/20" />
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold uppercase tracking-wider">
                  <span>Official Community</span>
                </div>

                <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                  Join Our WhatsApp Channel! 💬
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-sm mx-auto">
                  Stay connected with <span className="text-white font-semibold">LearnMyWay</span>! Join our WhatsApp channel for updates and share your ideas on how we can make the app even better.
                </p>
              </div>

              {/* Highlights */}
              <div className="space-y-2.5 mb-6 bg-white/5 border border-white/10 rounded-2xl p-4 text-xs sm:text-sm text-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0">
                    <Bell className="w-4 h-4" />
                  </div>
                  <span>Get instant updates on new AI features & study tools</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-violet-500/20 text-violet-300 flex items-center justify-center shrink-0">
                    <Lightbulb className="w-4 h-4" />
                  </div>
                  <span>Suggest new interests, topics & app improvements</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <span>Be part of the growing LearnMyWay student community</span>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2.5">
                <a
                  href={WHATSAPP_CHANNEL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleJoinClick}
                  className="w-full py-3.5 px-4 rounded-2xl font-bold text-sm bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4 fill-white/20" />
                  <span>Join WhatsApp Channel</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                </a>

                <button
                  type="button"
                  onClick={handleClose}
                  className="w-full py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Maybe later, take me to the app
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
