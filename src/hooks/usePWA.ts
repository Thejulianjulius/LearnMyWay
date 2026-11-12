import { useState, useEffect, useCallback } from "react";

// Extends the standard BeforeInstallPromptEvent (not yet in lib.dom.d.ts)
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

export interface PWAState {
  /** True when the native install prompt is available (Android / desktop Chrome/Edge) */
  canInstall: boolean;
  /** True when running as an installed PWA in standalone mode */
  isInstalled: boolean;
  /** True when running on iOS Safari (shows manual instructions instead) */
  isIOS: boolean;
  /** True when running on macOS */
  isMac: boolean;
  /** True when running on macOS Safari */
  isMacSafari: boolean;
  /** True when a new service worker version is waiting */
  needsUpdate: boolean;
  /** Triggers the native install prompt; returns true if native prompt was shown */
  promptInstall: () => Promise<boolean>;
  /** Applies the waiting service worker update */
  applyUpdate: () => void;
}

function detectIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPad on iOS 13+ reports as MacIntel with touch support
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function detectMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Macintosh|MacIntel|MacPPC|Mac68K/i.test(navigator.userAgent) && !detectIOS();
}

function detectMacSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return (
    detectMac() &&
    /Safari/i.test(ua) &&
    !/Chrome|Chromium|Edg|OPR|Brave/i.test(ua)
  );
}

function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari sets this when added to Home Screen
    ("standalone" in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true)
  );
}

// ── Global shared state so beforeinstallprompt is never missed before mount ──
let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
let globalIsInstalled = detectStandalone();
let globalWaitingWorker: ServiceWorker | null = null;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

if (typeof window !== "undefined") {
  // Register /sw.js immediately so the PWA is always installable in dev and prod
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => {
        for (const reg of regs) {
          if (reg.active?.scriptURL.includes("dev-sw.js")) {
            reg.unregister();
          }
        }
      })
      .catch(() => {});

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        if (reg.waiting) {
          globalWaitingWorker = reg.waiting;
          notifyListeners();
        }
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              globalWaitingWorker = newWorker;
              notifyListeners();
            }
          });
        });
      })
      .catch(() => {});
  }

  window.addEventListener("beforeinstallprompt", (e: Event) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
    notifyListeners();
  });

  window.addEventListener("appinstalled", () => {
    globalDeferredPrompt = null;
    globalIsInstalled = true;
    notifyListeners();
  });

  const mq = window.matchMedia("(display-mode: standalone)");
  mq.addEventListener("change", (e: MediaQueryListEvent) => {
    globalIsInstalled = e.matches;
    notifyListeners();
  });

  document.addEventListener("vite-pwa:update-found", (e: Event) => {
    const sw = (e as CustomEvent<{ waiting: ServiceWorker }>).detail?.waiting;
    if (sw) {
      globalWaitingWorker = sw;
      notifyListeners();
    }
  });
}

export function usePWA(): PWAState {
  const [, setTick] = useState(0);
  const [isIOS] = useState(detectIOS);
  const [isMac] = useState(detectMac);
  const [isMacSafari] = useState(detectMacSafari);

  useEffect(() => {
    const rerender = () => setTick((t) => t + 1);
    listeners.add(rerender);
    return () => {
      listeners.delete(rerender);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!globalDeferredPrompt) return false;
    await globalDeferredPrompt.prompt();
    const { outcome } = await globalDeferredPrompt.userChoice;
    if (outcome === "accepted") {
      globalDeferredPrompt = null;
      notifyListeners();
    }
    return true;
  }, []);

  const applyUpdate = useCallback(() => {
    if (globalWaitingWorker) {
      globalWaitingWorker.postMessage({ type: "SKIP_WAITING" });
      globalWaitingWorker = null;
    }
    notifyListeners();
    setTimeout(() => window.location.reload(), 300);
  }, []);

  return {
    canInstall: globalDeferredPrompt !== null,
    isInstalled: globalIsInstalled,
    isIOS,
    isMac,
    isMacSafari,
    needsUpdate: globalWaitingWorker !== null,
    promptInstall,
    applyUpdate,
  };
}
