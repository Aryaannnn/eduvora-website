// Supabase client for PUBLIC data (products, slots, reviews) that is the same
// for every visitor. It never uses login cookies, so the results can be cached.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./env";

export function getPublicSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
