// Google Search Console verification code (Admin → Settings → Google Search Console).
// Put in every page's <head> by src/app/layout.tsx. Table: supabase/search-console.sql.
import { cacheLife, cacheTag } from "next/cache";
import { getPublicSupabase } from "./supabase/public";

/** "abc123…" or null. Pasting the whole <meta … content="…"> tag also works. */
export function cleanVerificationCode(raw: string): string | null {
  const v = (raw.match(/content=["']([^"']+)["']/)?.[1] ?? raw).trim();
  return /^[A-Za-z0-9_-]{10,100}$/.test(v) ? v : null;
}

export async function getSearchConsoleCode(): Promise<string | null> {
  "use cache";
  cacheTag("settings");
  cacheLife("hours");
  const db = getPublicSupabase();
  if (!db) return null;
  const { data, error } = await db.from("display_settings").select("google_site_verification").eq("id", 1).maybeSingle();
  if (error) return null; // SQL not run yet
  return (data?.google_site_verification as string | null) || null;
}
