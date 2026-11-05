// Reads the Supabase keys from .env.local
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
// The public browser key. New Supabase projects call it the "publishable" key
// (sb_publishable_...); older projects call it the "anon" key. Either name works.
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// false until real keys are pasted into .env.local
export const isSupabaseConfigured =
  SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_URL.includes("your-project-id") &&
  SUPABASE_ANON_KEY.length > 20 &&
  !SUPABASE_ANON_KEY.startsWith("paste-");
