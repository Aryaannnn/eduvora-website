"use client";

// One logout for the whole website (navbar menu, dashboard sidebar, admin
// sidebar, mobile menus, Help page).
//  1. The server ends the session and deletes the login cookies.
//  2. The browser forgets its copy of the session too.
//  3. A full-page "replace" to /login?loggedOut=1 — the private page is
//     removed from history, so Back can't return to it, and the navbar is
//     rebuilt fresh (shows "Login").
import { useState } from "react";
import { getBrowserSupabase } from "./supabase/client";

export function useLogout() {
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    if (loggingOut) return; // no double clicks
    setLoggingOut(true);
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      await fetch("/auth/logout", { method: "POST", cache: "no-store", signal: ctrl.signal });
      clearTimeout(t);
    } catch {
      /* still continue — the browser sign-out below and the login page handle it */
    }
    try {
      await getBrowserSupabase()?.auth.signOut({ scope: "local" });
    } catch {
      /* already signed out */
    }
    window.location.replace("/login?loggedOut=1");
  }

  return { logout, loggingOut };
}
