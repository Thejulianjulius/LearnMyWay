import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { isAdminEmail, isAdminPinUnlocked } from "@/lib/analytics";
import { Sparkles, LayoutDashboard, User, LogIn, BarChart3 } from "lucide-react";

/**
 * MobileBottomNav — native-style bottom navigation bar on mobile screens (`md:hidden`)
 * for effortless one-thumb switching between the Generator, Saved Library/Dashboard, and Profile.
 */
export function MobileBottomNav() {
  const [location] = useLocation();
  const { user } = useAuth();
  const [pinUnlocked, setPinUnlocked] = useState(isAdminPinUnlocked);

  useEffect(() => {
    const syncAdmin = () => setPinUnlocked(isAdminPinUnlocked());
    window.addEventListener("learnmyway:admin-change", syncAdmin);
    return () => window.removeEventListener("learnmyway:admin-change", syncAdmin);
  }, []);

  const isAdmin = isAdminEmail(user?.email) || pinUnlocked;

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-950/90 backdrop-blur-xl border-t border-white/10 px-2 py-1.5"
    >
      <div className="max-w-md mx-auto flex items-center justify-around">
        {/* 1. Learn / Generator */}
        <Link
          href="/"
          className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all cursor-pointer ${
            location === "/"
              ? "text-violet-300 bg-violet-500/15"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Learn</span>
        </Link>

        {/* 2. Dashboard / Saved Lessons */}
        {user ? (
          <Link
            href="/dashboard"
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all cursor-pointer ${
              location === "/dashboard"
                ? "text-violet-300 bg-violet-500/15"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>My Library</span>
          </Link>
        ) : (
          <Link
            href="/login"
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all cursor-pointer ${
              location === "/login"
                ? "text-violet-300 bg-violet-500/15"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <LogIn className="w-4 h-4" />
            <span>Log In</span>
          </Link>
        )}

        {/* 3. Account / Sign Up */}
        {user ? (
          <Link
            href="/dashboard"
            className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
          >
            <User className="w-4 h-4" />
            <span>Profile</span>
          </Link>
        ) : (
          <Link
            href="/register"
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all cursor-pointer ${
              location === "/register"
                ? "text-violet-300 bg-violet-500/15"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <User className="w-4 h-4" />
            <span>Sign Up</span>
          </Link>
        )}

        {/* 4. Owner Analytics (Only visible to Owner) */}
        {isAdmin && (
          <Link
            href="/analytics"
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all cursor-pointer ${
              location === "/analytics"
                ? "text-violet-300 bg-violet-500/15"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Analytics</span>
          </Link>
        )}
      </div>
    </nav>
  );
}
