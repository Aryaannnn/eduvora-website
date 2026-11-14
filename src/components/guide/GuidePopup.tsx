"use client";

// Free guide popup ("VITEEE Counselling Checklist"):
//  • appears after the visitor scrolls 60% of a page OR spends 30 seconds on it
//  • only ONCE per visitor (remembered in this browser), easy to close (✕, Esc, outside, "No thanks")
//  • never on checkout / payment / login / dashboard / admin / test pages,
//    and not for people who are logged in (they're already in Admin → Leads)
// The form itself is only downloaded when the popup opens (keeps pages fast).
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { hasLoginCookie } from "@/lib/supabase/lazy";

const GuideForm = dynamic(() => import("./GuideForm"), { ssr: false });

const KEY = "eduvora-guide-popup-v1";
const NEVER = ["/book-a-slot", "/booking-confirmed", "/payment-success", "/payment-failed", "/unlock", "/invoice", "/login", "/auth", "/forgot-password", "/reset-password", "/admin", "/admin-verify", "/dashboard", "/tests", "/parent"];
const blocked = (p: string) => NEVER.some((x) => p === x || p.startsWith(`${x}/`));

function alreadyShown(): boolean {
  try {
    return !!localStorage.getItem(KEY);
  } catch {
    return true; // can't remember → don't risk showing it again and again
  }
}
function remember() {
  try {
    localStorage.setItem(KEY, new Date().toISOString());
  } catch {
    /* ignore */
  }
}

export default function GuidePopup({ title }: { title: string }) {
  return (
    <Suspense fallback={null}>
      <Trigger title={title} />
    </Suspense>
  );
}

function Trigger({ title }: { title: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open || blocked(pathname) || alreadyShown() || hasLoginCookie()) return;
    let done = false;
    const show = () => {
      if (done || alreadyShown() || document.querySelector('[role="dialog"][aria-modal="true"]')) return; // never on top of another popup
      done = true;
      remember();
      setOpen(true);
    };
    const timer = setTimeout(show, 30_000);
    const onScroll = () => {
      const el = document.documentElement;
      const seen = (window.scrollY + window.innerHeight) / Math.max(el.scrollHeight, 1);
      if (window.scrollY > 0 && seen >= 0.6) show();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
  }, [pathname, open]);

  if (!open) return null;
  return <GuideForm title={title} onClose={() => setOpen(false)} />;
}
