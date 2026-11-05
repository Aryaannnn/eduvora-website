// =====================================================================
//  SUPABASE "SERVICE ROLE" CLIENT — SERVER ONLY
//  This key skips Row Level Security, so it is ONLY used by the payment
//  routes to save orders and mark them paid after Razorpay confirms.
//  It reads SUPABASE_SERVICE_ROLE_KEY (never NEXT_PUBLIC_), and
//  "server-only" stops the build if browser code ever imports this file.
// =====================================================================
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./env";

let client: SupabaseClient | null = null;

export function getAdminSupabase(): SupabaseClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!SUPABASE_URL || key.length < 20) return null;
  client ??= createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}
