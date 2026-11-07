"use client";

// =====================================================================
//  ADMIN INACTIVITY LOGOUT — 2 hours without any activity → logged out.
//  • Mouse, keyboard, touch and scrolling count as activity, in ANY open
//    admin tab (shared through localStorage).
//  • 5 minutes before, a warning with "Stay signed in" appears.
//  • The server checks the same 2-hour rule too (src/proxy.ts), so it
//    works even if this tab was closed.
// =====================================================================
import { useEffect, useRef, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";

export const ADMIN_IDLE_MS = 2 * 60 * 60 * 1000;
const WARN_MS = 5 * 60 * 1000;
const KEY = "eduvora-admin-last-active";

const read = () => {
  try {
    return Number(localStorage.getItem(KEY)) || 0;
  } catch {
    return 0;
  }
};
const write = (t: number) => {
  try {
    localStorage.setItem(KEY, String(t));
  } catch {
    /* private window */
  }
};

export default function AdminIdleGuard() {
  const [left, setLeft] = useState<number | null>(null); // ms until logout while warning
  const lastLocal = useRef(0);
  const lastPing = useRef(0);
  const leaving = useRef(false);

  useEffect(() => {
    lastLocal.current = Date.now();
    lastPing.current = Date.now();
    write(lastLocal.current);

    const ping = () => {
      lastPing.current = Date.now();
      void fetch("/api/admin/ping", { method: "POST", cache: "no-store" }).catch(() => undefined); // keeps the server-side timer fresh
    };
    const touch = () => {
      const now = Date.now();
      if (now - lastLocal.current < 15_000) return; // at most every 15 s
      lastLocal.current = now;
      write(now);
      setLeft(null);
      if (now - lastPing.current > 5 * 60_000) ping(); // while working (e.g. writing a long post), tell the server every 5 min
    };
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "wheel"] as const;
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));

    async function logOut() {
      if (leaving.current) return;
      leaving.current = true;
      try {
        await fetch("/auth/logout", { method: "POST", cache: "no-store" });
      } catch {
        /* continue */
      }
      try {
        await getBrowserSupabase()?.auth.signOut({ scope: "local" });
      } catch {
        /* already out */
      }
      try {
        localStorage.removeItem(KEY);
      } catch {
        /* ignore */
      }
      window.location.replace(`/login?loggedOut=idle&next=${encodeURIComponent(window.location.pathname)}`);
    }

    const tick = setInterval(() => {
      const idle = Date.now() - Math.max(read(), lastLocal.current);
      if (idle >= ADMIN_IDLE_MS) void logOut();
      else if (idle >= ADMIN_IDLE_MS - WARN_MS) setLeft(ADMIN_IDLE_MS - idle);
      else setLeft(null);
    }, 10_000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, touch));
      clearInterval(tick);
    };
  }, []);

  if (left === null) return null;
  const mins = Math.max(1, Math.ceil(left / 60_000));
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/50 p-4" role="alertdialog" aria-modal="true" aria-labelledby="idle-title">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
        <p className="text-3xl" aria-hidden>⏰</p>
        <h2 id="idle-title" className="mt-2 text-xl font-extrabold text-slate-900">Still there?</h2>
        <p className="mt-2 text-sm text-slate-600">For security you&apos;ll be logged out in about <strong>{mins} minute{mins === 1 ? "" : "s"}</strong> because there has been no activity.</p>
        <button
          type="button"
          onClick={() => {
            lastLocal.current = Date.now();
            write(lastLocal.current);
            setLeft(null);
            void fetch("/api/admin/ping", { method: "POST", cache: "no-store" }).catch(() => undefined); // refresh the server-side timer too
          }}
          className="btn-primary mt-5 w-full"
        >
          Stay signed in
        </button>
      </div>
    </div>
  );
}
