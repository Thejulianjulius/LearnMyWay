import { RefreshCw, X } from "lucide-react";
import { usePWA } from "@/hooks/usePWA";
import { useState } from "react";

/**
 * UpdatePrompt — a non-intrusive toast shown when a new version of the app is
 * waiting in the service worker. Users can dismiss it or choose to update.
 * It never interrupts an active lesson.
 */
export function UpdatePrompt() {
  const { needsUpdate, applyUpdate } = usePWA();
  const [dismissed, setDismissed] = useState(false);

  if (!needsUpdate || dismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[90] w-full max-w-sm px-4"
    >
      <div className="flex items-center gap-3 rounded-xl bg-slate-900 border border-violet-500/30 shadow-2xl shadow-black/50 px-4 py-3 animate-in slide-in-from-bottom-4 duration-300">
        {/* Icon */}
        <div className="shrink-0 w-9 h-9 rounded-lg bg-violet-500/20 flex items-center justify-center">
          <RefreshCw className="w-4 h-4 text-violet-400" />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Update available</p>
          <p className="text-xs text-slate-400 truncate">A new version of LearnMyWay is ready.</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={applyUpdate}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-violet-500 to-indigo-500 text-white hover:from-violet-400 hover:to-indigo-400 transition-all"
          >
            Update
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
            aria-label="Dismiss update notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
