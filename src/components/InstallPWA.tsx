import { useState } from "react";
import { createPortal } from "react-dom";
import { Download, Share, X, Monitor, Smartphone, CheckCircle2, Apple } from "lucide-react";
import { usePWA } from "@/hooks/usePWA";
import { trackEvent } from "@/lib/analytics";

interface InstallPWAProps {
  compact?: boolean;
  variant?: "navbar" | "banner";
}

/**
 * InstallPWA — always-visible "Download App" button & banner when the app is not yet installed.
 * 1. If native browser `beforeinstallprompt` is ready, immediately triggers the native OS PWA install dialog.
 * 2. Otherwise, opens a Download & Install modal that includes a direct one-click download for macOS
 *    (`LearnMyWay-macOS.zip` containing `LearnMyWay.app`) plus browser PWA install steps.
 */
export function InstallPWA({ compact = false, variant = "navbar" }: InstallPWAProps) {
  const { canInstall, isInstalled, isIOS, isMac, isMacSafari, promptInstall } = usePWA();
  const [modalOpen, setModalOpen] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [downloadedZip, setDownloadedZip] = useState(false);

  // Don't render anything when already running as an installed standalone PWA
  if (isInstalled) return null;

  const handleInstallClick = async () => {
    trackEvent("pwa_download", { topic: "App Download Click" });
    if (canInstall) {
      setInstalling(true);
      try {
        const triggered = await promptInstall();
        if (!triggered) {
          setModalOpen(true);
        }
      } finally {
        setInstalling(false);
      }
    } else {
      setModalOpen(true);
    }
  };

  const modal =
    modalOpen && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Download and Install LearnMyWay App"
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setModalOpen(false)}
            />

            {/* Modal Panel */}
            <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-violet-500/30 p-6 shadow-2xl shadow-violet-950/50 animate-in fade-in zoom-in-95 duration-200">
              <button
                onClick={() => setModalOpen(false)}
                className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Header */}
              <div className="flex items-center gap-3.5 mb-5">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-2xl shadow-lg shadow-violet-500/30 shrink-0">
                  🎓
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">Download LearnMyWay App</h3>
                  <p className="text-xs text-slate-400">
                    Get the standalone desktop or mobile app experience
                  </p>
                </div>
              </div>

              {/* Native PWA Install Button if ready */}
              {canInstall && (
                <button
                  onClick={handleInstallClick}
                  disabled={installing}
                  className="w-full mb-4 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-400 hover:to-indigo-400 text-white shadow-lg shadow-violet-500/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  {installing ? "Installing…" : "Install PWA Now"}
                </button>
              )}

              {/* Direct macOS App Bundle Download */}
              {isMac && !isIOS && (
                <div className="mb-5 p-4 rounded-xl bg-gradient-to-br from-violet-500/15 to-indigo-500/10 border border-violet-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-violet-200">
                      <Apple className="w-4 h-4 text-violet-300" />
                      <span>macOS Standalone App Bundle</span>
                    </div>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 font-medium">
                      LearnMyWay.app
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Download <span className="text-white font-medium">LearnMyWay.app</span> directly to your Mac. Unzip and double-click to launch LearnMyWay in its own dedicated app window.
                  </p>
                  <a
                    href="/LearnMyWay-macOS.zip"
                    download="LearnMyWay-macOS.zip"
                    onClick={() => setDownloadedZip(true)}
                    className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-400 hover:to-indigo-400 text-white shadow-md shadow-violet-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>
                      {downloadedZip ? "Downloaded LearnMyWay-macOS.zip!" : "Download App for macOS (.zip)"}
                    </span>
                  </a>
                  {downloadedZip && (
                    <p className="text-[11px] text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Open LearnMyWay-macOS.zip in your Downloads folder and run LearnMyWay.app!</span>
                    </p>
                  )}
                </div>
              )}

              {/* Browser PWA Instructions by Platform */}
              {isIOS ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet-300">
                    <Smartphone className="w-4 h-4" />
                    <span>Install on iPhone / iPad (Safari)</span>
                  </div>
                  <ol className="space-y-3 text-sm text-slate-300 bg-white/5 border border-white/10 rounded-xl p-4">
                    <li className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-violet-500/20 text-violet-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                        1
                      </span>
                      <span>
                        Tap the{" "}
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-white/10 rounded text-white font-medium">
                          <Share className="w-3 h-3" /> Share
                        </span>{" "}
                        button in Safari&apos;s toolbar.
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-violet-500/20 text-violet-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                        2
                      </span>
                      <span>
                        Scroll down and tap{" "}
                        <span className="font-semibold text-white">Add to Home Screen</span>.
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-violet-500/20 text-violet-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                        3
                      </span>
                      <span>
                        Tap <span className="font-semibold text-white">Add</span> to place LearnMyWay on your Home Screen.
                      </span>
                    </li>
                  </ol>
                </div>
              ) : isMacSafari ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet-300">
                    <Monitor className="w-4 h-4" />
                    <span>Or Add to Dock in Safari</span>
                  </div>
                  <ol className="space-y-2.5 text-xs text-slate-300 bg-white/5 border border-white/10 rounded-xl p-3.5">
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-300 font-bold text-[11px] flex items-center justify-center shrink-0">
                        1
                      </span>
                      <span>
                        Click <span className="font-semibold text-white">File → Add to Dock…</span> in the Safari menu bar.
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-300 font-bold text-[11px] flex items-center justify-center shrink-0">
                        2
                      </span>
                      <span>
                        Click <span className="font-semibold text-white">Add</span> to pin LearnMyWay to your macOS Dock.
                      </span>
                    </li>
                  </ol>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet-300">
                    <Monitor className="w-4 h-4" />
                    <span>Install via Browser (Desktop or Mobile)</span>
                  </div>
                  <ol className="space-y-2.5 text-xs text-slate-300 bg-white/5 border border-white/10 rounded-xl p-3.5">
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-300 font-bold text-[11px] flex items-center justify-center shrink-0">
                        1
                      </span>
                      <span>
                        Click the{" "}
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-white/10 rounded text-white font-medium">
                          <Download className="w-3 h-3" /> Install
                        </span>{" "}
                        icon on the right side of your browser&apos;s address bar, or open the browser menu <span className="font-semibold text-white">(⋮)</span>.
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-300 font-bold text-[11px] flex items-center justify-center shrink-0">
                        2
                      </span>
                      <span>
                        Select <span className="font-semibold text-white">Install LearnMyWay</span> (or{" "}
                        <span className="font-semibold text-white">Add to Home screen</span> on mobile) and confirm to add the app to your device.
                      </span>
                    </li>
                  </ol>
                </div>
              )}

              <button
                onClick={() => setModalOpen(false)}
                className="mt-5 w-full py-2.5 rounded-xl text-xs font-semibold text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>,
          document.body
        )
      : null;

  if (variant === "banner") {
    return (
      <>
        <div className="mt-6 rounded-2xl bg-gradient-to-r from-violet-500/15 via-indigo-500/10 to-purple-500/15 border border-violet-500/25 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center shadow-md shadow-violet-500/25 shrink-0">
              <Download className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Get the LearnMyWay App</h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Download as a standalone app on your Mac, PC, or phone for instant access.
              </p>
            </div>
          </div>
          <button
            onClick={handleInstallClick}
            disabled={installing}
            className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-400 hover:to-indigo-400 text-white shadow-md shadow-violet-500/25 hover:shadow-violet-500/40 transition-all cursor-pointer disabled:opacity-60"
          >
            <Download className="w-4 h-4" />
            <span>{installing ? "Installing…" : "Download App"}</span>
          </button>
        </div>
        {modal}
      </>
    );
  }

  return (
    <>
      <button
        onClick={handleInstallClick}
        disabled={installing}
        className={`flex items-center gap-1.5 rounded-lg font-medium transition-all cursor-pointer disabled:opacity-60 ${
          compact
            ? "px-2.5 py-1.5 text-xs bg-violet-500/20 border border-violet-500/30 text-violet-200 hover:bg-violet-500/30"
            : "px-3 py-1.5 text-sm bg-gradient-to-r from-violet-500/20 to-indigo-500/20 border border-violet-500/30 text-violet-200 hover:from-violet-500/30 hover:to-indigo-500/30 hover:border-violet-400/50 hover:text-white"
        }`}
        aria-label="Download LearnMyWay app"
      >
        <Download className={compact ? "w-3.5 h-3.5" : "w-4 h-4"} />
        <span>{installing ? "Installing…" : compact ? "Download" : "Download App"}</span>
      </button>
      {modal}
    </>
  );
}
