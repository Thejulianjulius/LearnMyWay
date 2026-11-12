import { createClient } from "@supabase/supabase-js";

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
