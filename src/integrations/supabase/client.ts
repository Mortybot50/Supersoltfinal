// Supabase client — env vars must match Vercel dashboard settings
// Variable names: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.error("⚠️ CRITICAL: Supabase environment variables are missing!");
  console.error("VITE_SUPABASE_URL:", SUPABASE_URL ? "✅ Set" : "❌ Missing");
  console.error(
    "VITE_SUPABASE_PUBLISHABLE_KEY:",
    SUPABASE_PUBLISHABLE_KEY ? "✅ Set" : "❌ Missing",
  );
}

export const supabase = createClient<Database>(
  SUPABASE_URL || "",
  SUPABASE_PUBLISHABLE_KEY || "",
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
