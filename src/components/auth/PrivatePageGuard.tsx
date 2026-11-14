"use client";

// Stops the browser "Back" button from showing a private page after logout.
// On private pages it checks, whenever the page is shown (incl. from the
// back/forward cache), whether the user is still logged in. If not →
// replace with /login (so Back can't go there again either).
import { usePathname } from "next/navigation";
import { Suspense, useEffect } from "react";
import { loadBrowserSupabase } from "@/lib/supabase/lazy";

const PRIVATE = ["/dashboard", "/admin", "/invoice", "/payment-success", "/booking-confirmed"];
const isPrivate = (p: string) => PRIVATE.some((x) => p === x || p.startsWith(`${x}/`));

export default function PrivatePageGuard() {
  return (
    <Suspense fallback={null}>
      <Guard />
    </Suspense>
  );
}

function Guard() {
  const pathname = usePathname();

  useEffect(() => {
    if (!isPrivate(pathname)) return;
    let alive = true;
    let supabase: Awaited<ReturnType<typeof loadBrowserSupabase>> = null;
    let unsubscribe: (() => void) | undefined;
    const check = () => {
      supabase?.auth.getSession().then(({ data }) => {
        if (!data.session) {
          window.location.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        }
      });
    };
    // Page restored from the browser's back/forward cache → reload it so the server checks again
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) window.location.reload();
      else check();
    };
    window.addEventListener("pageshow", onShow);
    void loadBrowserSupabase().then((client) => {
      if (!client || !alive) return;
      supabase = client;
      check();
      // Logged out in another tab → leave this private page too
      const { data: sub } = client.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_OUT") check();
      });
      unsubscribe = () => sub.subscription.unsubscribe();
    });
    return () => {
      alive = false;
      window.removeEventListener("pageshow", onShow);
      unsubscribe?.();
    };
  }, [pathname]);

  return null;
}
