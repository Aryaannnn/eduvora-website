// Loads the Supabase browser library ONLY when it is needed.
//
// The library is big (~68 KB compressed). The header, the privacy prompt and
// the "add your mobile" prompt only need it for LOGGED-IN visitors, so:
//  • hasLoginCookie(): a logged-in browser always has Supabase's
//    "sb-…-auth-token" cookie. No cookie → a visitor → nothing to load.
//  • loadBrowserSupabase(): downloads the library separately, after the page is
//    already usable (it doesn't delay the first paint or the first tap).
// It returns the SAME client as getBrowserSupabase(), so login/logout events
// are shared with the login form.
import { useSyncExternalStore } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

export function hasLoginCookie(): boolean {
  if (typeof document === "undefined") return false;
  return /(?:^|;\s*)sb-[^=;]*-auth-token(?:\.\d+)?=/.test(document.cookie);
}

export async function loadBrowserSupabase(): Promise<SupabaseClient | null> {
  const { getBrowserSupabase } = await import("./client");
  return getBrowserSupabase();
}

const noSubscribe = () => () => {};
/**
 * true when this browser has a login cookie. Re-checked every time the component
 * re-renders (e.g. on every page change), so logging in on /login is noticed.
 * Always false on the server and during the first render (no hydration mismatch).
 */
export function useHasLoginCookie(): boolean {
  return useSyncExternalStore(noSubscribe, hasLoginCookie, () => false);
}
