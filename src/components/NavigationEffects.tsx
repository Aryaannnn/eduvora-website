"use client";

import { usePathname } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";

// Remembers how many pages the visitor has opened on THIS website in this tab,
// so the "← Back" button knows whether there is a previous page to go back to.
export const NAV_DEPTH_KEY = "eduvora-nav-depth";

export function readNavDepth(): number {
  try {
    return Number(sessionStorage.getItem(NAV_DEPTH_KEY) || 0);
  } catch {
    return 0;
  }
}
function writeNavDepth(n: number) {
  try {
    sessionStorage.setItem(NAV_DEPTH_KEY, String(Math.max(0, n)));
  } catch {
    /* private mode — Back simply goes home */
  }
}

/**
 * Runs on every page change:
 *  1. Opens every page at the very TOP (unless the link points to a #section).
 *  2. Counts in-site page visits for the Back button.
 */
function Effects() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null); // null = page just loaded (or opened directly)
  const cameBack = useRef(false);

  useEffect(() => {
    // We handle scrolling ourselves (the browser would otherwise restore old positions)
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    const onPopState = () => {
      cameBack.current = true;
      writeNavDepth(readNavDepth() - 1);
    };
    addEventListener("popstate", onPopState);
    return () => removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    // Count only REAL page changes (React may run this twice for the same page in development)
    if (lastPath.current === pathname) return;
    const isFirstPage = lastPath.current === null;
    lastPath.current = pathname;
    if (!isFirstPage && !cameBack.current) writeNavDepth(readNavDepth() + 1); // clicked a link inside the site
    cameBack.current = false;

    // Jump to the top instantly — but leave links like /mock-tests#mcq to scroll to their section
    if (!window.location.hash) window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  return null;
}

export default function NavigationEffects() {
  return (
    <Suspense fallback={null}>
      <Effects />
    </Suspense>
  );
}
