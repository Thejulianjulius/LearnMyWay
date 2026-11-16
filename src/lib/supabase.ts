import { createClient, type User } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://hplfynwisqujtiilmgyl.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_uUCWZo3DBX7WC4c2yu9a1w_HwEZkPvr";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase credentials missing. Please check your .env configuration.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  education_level: string | null;
  learning_interests: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface SavedLesson {
  id: string;
  user_id: string;
  interest: string;
  topic: string;
  lesson: string;
  created_at: string;
}

function getStorageKey(userId?: string | null): string {
  return `learnmyway_saved_lessons_${userId || "guest"}`;
}

function readLocalSavedLessons(userId?: string | null): SavedLesson[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeLocalSavedLessons(userId: string | null | undefined, lessons: SavedLesson[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(lessons.slice(0, 100)));
  } catch {}
}

/**
 * Saves a lesson reliably across LocalStorage, Supabase Auth user_metadata, and public.saved_lessons.
 * Succeeds even if the database table hasn't been migrated yet or if the visitor is a guest.
 */
export async function saveStudentLesson(params: {
  user?: User | null;
  interest: string;
  topic: string;
  lesson: string;
}): Promise<SavedLesson> {
  const { user, interest, topic, lesson } = params;
  const userId = user?.id || "guest";
  const newEntry: SavedLesson = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : "les_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8),
    user_id: userId,
    interest: interest.trim(),
    topic: topic.trim(),
    lesson,
    created_at: new Date().toISOString(),
  };

  // 1. Save to LocalStorage immediately (and also merge any guest lessons if logged in)
  const existingLocal = readLocalSavedLessons(userId);
  const filteredLocal = existingLocal.filter(
    (item) =>
      !(
        item.topic.toLowerCase() === newEntry.topic.toLowerCase() &&
        item.interest.toLowerCase() === newEntry.interest.toLowerCase()
      )
  );
  const updatedLocal = [newEntry, ...filteredLocal];
  writeLocalSavedLessons(userId, updatedLocal);

  if (user) {
    // 2. Try inserting into Supabase public.saved_lessons table
    try {
      const { data: insertedRow, error } = await supabase
        .from("saved_lessons")
        .insert({
          user_id: user.id,
          interest: newEntry.interest,
          topic: newEntry.topic,
          lesson: newEntry.lesson,
        })
        .select("*")
        .maybeSingle();

      if (!error && insertedRow?.id) {
        newEntry.id = String(insertedRow.id);
        writeLocalSavedLessons(userId, [newEntry, ...filteredLocal]);
      }
    } catch {}

    // 3. Also store recent 20 lessons in Supabase Auth user_metadata as a cloud fallback
    try {
      await supabase.auth.updateUser({
        data: {
          saved_lessons_backup: updatedLocal.slice(0, 20),
        },
      });
    } catch {}
  }

  return newEntry;
}

/**
 * Loads saved lessons by merging Supabase public.saved_lessons, Auth user_metadata backup,
 * and LocalStorage (including any lessons saved as a guest before logging in).
 */
export async function getStudentSavedLessons(user?: User | null): Promise<SavedLesson[]> {
  const userId = user?.id || "guest";
  const byKey = new Map<string, SavedLesson>();

  const addLesson = (item: SavedLesson) => {
    if (!item || !item.topic || !item.lesson) return;
    const dedupKey = `${item.topic.trim().toLowerCase()}|${(item.interest || "").trim().toLowerCase()}`;
    if (!byKey.has(dedupKey)) {
      byKey.set(dedupKey, item);
    }
  };

  // 1. From Supabase public.saved_lessons table (if user is logged in)
  if (user) {
    try {
      const { data, error } = await supabase
        .from("saved_lessons")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!error && Array.isArray(data)) {
        for (const row of data) {
          addLesson(row as SavedLesson);
        }
      }
    } catch {}

    // 2. From Supabase Auth user_metadata backup
    const metaBackup = user.user_metadata?.saved_lessons_backup;
    if (Array.isArray(metaBackup)) {
      for (const item of metaBackup) {
        addLesson(item as SavedLesson);
      }
    }
  }

  // 3. From LocalStorage (user-specific + guest lessons)
  for (const item of readLocalSavedLessons(userId)) {
    addLesson(item);
  }
  if (user) {
    for (const guestItem of readLocalSavedLessons("guest")) {
      addLesson({ ...guestItem, user_id: user.id });
    }
  }

  const merged = Array.from(byKey.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  writeLocalSavedLessons(userId, merged);
  return merged;
}

/**
 * Deletes a saved lesson from LocalStorage, Supabase public.saved_lessons, and Auth user_metadata.
 */
export async function deleteStudentSavedLesson(
  user: User | null | undefined,
  lessonToDelete: SavedLesson
): Promise<void> {
  const userId = user?.id || "guest";
  const matchFn = (item: SavedLesson) =>
    item.id === lessonToDelete.id ||
    (item.topic.toLowerCase() === lessonToDelete.topic.toLowerCase() &&
      item.interest.toLowerCase() === lessonToDelete.interest.toLowerCase());

  const remainingUser = readLocalSavedLessons(userId).filter((i) => !matchFn(i));
  writeLocalSavedLessons(userId, remainingUser);

  const remainingGuest = readLocalSavedLessons("guest").filter((i) => !matchFn(i));
  writeLocalSavedLessons("guest", remainingGuest);

  if (user) {
    try {
      await supabase.from("saved_lessons").delete().eq("id", lessonToDelete.id);
    } catch {}

    try {
      await supabase.auth.updateUser({
        data: {
          saved_lessons_backup: remainingUser.slice(0, 20),
        },
      });
    } catch {}
  }
}
