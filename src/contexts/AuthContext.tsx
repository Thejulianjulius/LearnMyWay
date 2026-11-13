import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase, type Profile } from "@/lib/supabase";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getLocalCachedProfile(userId: string): Partial<Profile> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`learnmyway_profile_${userId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setLocalCachedProfile(userId: string, profile: Profile) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`learnmyway_profile_${userId}`, JSON.stringify(profile));
  } catch {}
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchProfile = useCallback(async (userId: string, currentUser?: User) => {
    const meta = currentUser?.user_metadata || {};
    const cached = getLocalCachedProfile(userId);

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.warn("Could not fetch profile from Supabase:", error.message);
      }

      if (data) {
        const merged: Profile = {
          id: userId,
          full_name:
            data.full_name ||
            cached?.full_name ||
            meta.full_name ||
            currentUser?.email?.split("@")[0] ||
            "Student",
          email: data.email || currentUser?.email || null,
          education_level:
            data.education_level ||
            cached?.education_level ||
            meta.education_level ||
            "High School",
          learning_interests:
            Array.isArray(data.learning_interests) && data.learning_interests.length > 0
              ? data.learning_interests
              : Array.isArray(cached?.learning_interests) && cached.learning_interests.length > 0
              ? cached.learning_interests
              : Array.isArray(meta.learning_interests)
              ? meta.learning_interests
              : [],
          created_at: data.created_at || new Date().toISOString(),
          updated_at: data.updated_at || new Date().toISOString(),
        };
        setProfile(merged);
        setLocalCachedProfile(userId, merged);
      } else {
        // Fallback profile if trigger hasn't run yet or table wasn't created
        const fallback: Profile = {
          id: userId,
          full_name:
            cached?.full_name ||
            meta.full_name ||
            currentUser?.email?.split("@")[0] ||
            "Student",
          email: currentUser?.email || null,
          education_level: cached?.education_level || meta.education_level || "High School",
          learning_interests:
            Array.isArray(cached?.learning_interests)
              ? cached.learning_interests
              : Array.isArray(meta.learning_interests)
              ? meta.learning_interests
              : [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        setProfile(fallback);
        setLocalCachedProfile(userId, fallback);

        // Try upserting the fallback row safely
        await supabase
          .from("profiles")
          .upsert(
            {
              id: fallback.id,
              full_name: fallback.full_name,
              email: fallback.email,
              education_level: fallback.education_level,
              learning_interests: fallback.learning_interests,
              updated_at: fallback.updated_at,
            },
            { onConflict: "id" }
          )
          .then(() => {});
      }
    } catch (err) {
      console.error("Error in fetchProfile:", err);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id, user);
    }
  }, [user, fetchProfile]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!mounted) return;
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      if (initialSession?.user) {
        fetchProfile(initialSession.user.id, initialSession.user).finally(() => {
          if (mounted) setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      if (!mounted) return;
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user) {
        await fetchProfile(currentSession.user.id, currentSession.user);
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  const updateProfile = async (updates: Partial<Profile>): Promise<{ error: Error | null }> => {
    if (!user) {
      return { error: new Error("User not authenticated") };
    }

    const nowIso = new Date().toISOString();
    const updatedProfile: Profile = {
      id: user.id,
      full_name:
        updates.full_name !== undefined
          ? updates.full_name
          : profile?.full_name || user.user_metadata?.full_name || "Student",
      email: user.email || profile?.email || null,
      education_level:
        updates.education_level !== undefined
          ? updates.education_level
          : profile?.education_level || "High School",
      learning_interests:
        updates.learning_interests !== undefined
          ? updates.learning_interests
          : profile?.learning_interests || [],
      created_at: profile?.created_at || nowIso,
      updated_at: nowIso,
    };

    try {
      // 1. Update local state & localStorage immediately so UI is responsive
      setProfile(updatedProfile);
      setLocalCachedProfile(user.id, updatedProfile);

      // 2. Persist in Supabase Auth user_metadata (always works across all Supabase schemas)
      const { data: authData } = await supabase.auth.updateUser({
        data: {
          full_name: updatedProfile.full_name,
          education_level: updatedProfile.education_level,
          learning_interests: updatedProfile.learning_interests,
        },
      });
      if (authData?.user) {
        setUser(authData.user);
      }

      // 3. Also upsert into public.profiles table (inserts if missing, updates if present)
      const { error: upsertError } = await supabase.from("profiles").upsert(
        {
          id: user.id,
          email: user.email,
          full_name: updatedProfile.full_name,
          education_level: updatedProfile.education_level,
          learning_interests: updatedProfile.learning_interests,
          updated_at: nowIso,
        },
        { onConflict: "id" }
      );

      if (upsertError) {
        console.warn("profiles table upsert warning (saved to auth metadata):", upsertError.message);
      }

      return { error: null };
    } catch (err: unknown) {
      return {
        error: err instanceof Error ? err : new Error("Failed to update profile"),
      };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        signOut,
        refreshProfile,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
