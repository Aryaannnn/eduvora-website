"use client";

// Small cookie notice at the bottom of the website — shown once.
// Explains essential cookies (login) and analytics; "OK" hides it for good.
import Link from "next/link";
import { useEffect, useState } from "react";

const KEY = "eduvora-cookie-notice";

export default function CookieNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(KEY) === "1";
    } catch {
      /* private window: show it */
    }
    if (seen) return;
    const id = setTimeout(() => setShow(true), 1200); // after the page has loaded
    return () => clearTimeout(id);
  }, []);

  if (!show) return null;
  function ok() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    setShow(false);
  }

  return (
    <div className="fixed inset-x-3 bottom-24 z-[45] mx-auto max-w-xl animate-fade-up sm:bottom-5 print:hidden" role="region" aria-label="Cookie notice">
      <div className="flex flex-col gap-3 rounded-2xl bg-slate-900/95 p-4 text-sm text-slate-200 shadow-2xl ring-1 ring-white/10 backdrop-blur sm:flex-row sm:items-center">
        <p className="flex-1 leading-relaxed">
          🍪 We use <strong className="text-white">essential cookies</strong> to keep you logged in and secure, and <strong className="text-white">analytics</strong> to see which pages help students — never to show you ads.{" "}
          <Link href="/privacy-policy#cookies" className="font-semibold text-accent-300 underline">Privacy Policy</Link>
        </p>
        <button type="button" onClick={ok} className="btn-accent shrink-0 !px-6 !py-2.5">OK</button>
      </div>
    </div>
  );
}
