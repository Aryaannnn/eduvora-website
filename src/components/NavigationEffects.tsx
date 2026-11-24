"use client";

import { usePathname } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";

// Remembers how many pages the visitor has opened on THIS website in this tab,
// so the "← Back" button knows whether there is a previous page to go back to.
export const NAV_DEPTH_KEY = "eduvora-nav-depth";
const SCROLL_KEY = "eduvora-scroll"; // { "<path+search>": y } for this tab

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

// ---------- scroll positions per page (this tab only) ----------
const pageKey = () => `${location.pathname}${location.search}`;
function readPositions(): Record<string, number> {
  try {
    return JSON.parse(sessionStorage.getItem(SCROLL_KEY) || "{}");
  } catch {
    return {};
  }
}
function savePosition(key: string, y: number) {
  try {
    const all = readPositions();
    all[key] = Math.max(0, Math.round(y));
    const keys = Object.keys(all);
    if (keys.length > 60) delete all[keys[0]]; // keep it small
    sessionStorage.setItem(SCROLL_KEY, JSON.stringify(all));
  } catch {
    /* private mode — Back just opens at the top */
  }
}

/**
 * Back / Forward: go back to where the visitor was. Some sections load after the
 * page opens, so keep trying until the page is tall enough (max ~4 s), and stop at
 * once if the visitor scrolls, taps or presses a key themselves.
 */
function restore(y: number) {
  let stopped = false;
  const stop = () => {
    stopped = true;
    cleanup();
  };
  const started = performance.now();
  const tryNow = () => {
    if (stopped) return;
    const maxY = document.documentElement.scrollHeight - innerHeight;
    window.scrollTo({ top: Math.min(y, Math.max(0, maxY)), left: 0, behavior: "instant" });
    if (maxY >= y - 2 || performance.now() - started > 4000) return stop();
  };
  const ro = new ResizeObserver(tryNow); // the page grew (sections loaded) → try again
  ro.observe(document.body);
  const timer = setInterval(tryNow, 150);
  const userMoved = () => stop();
  addEventListener("wheel", userMoved, { passive: true, once: true });
  addEventListener("touchstart", userMoved, { passive: true, once: true });
  addEventListener("keydown", userMoved, { once: true });
  function cleanup() {
    ro.disconnect();
    clearInterval(timer);
    removeEventListener("wheel", userMoved);
    removeEventListener("touchstart", userMoved);
    removeEventListener("keydown", userMoved);
  }
  requestAnimationFrame(tryNow);
}

/**
 * Runs on every page change:
 *  1. NEW page (link, logo, menu) → the very TOP (or the #section the link points to).
 *  2. BACK / FORWARD (browser, phone or the site's "← Back") → the SAME position as before.
 *  3. Counts in-site page visits for the Back button.
 */
function Effects() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null); // null = page just loaded (or opened directly)
  const traverseAt = useRef(0); // when the last Back / Forward started
  const lastChange = useRef<{ at: number; key: string; back: boolean } | null>(null);

  useEffect(() => {
    // We handle scrolling ourselves: the browser can't restore well when sections load late
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    // Back / Forward. Browsers tell us in different orders: the router may already have
    // shown the page before "popstate" arrives. So: remember WHEN a Back / Forward
    // started; and if the page change already ran as a "new page", fix it up here.
    const onTraverse = () => {
      const c = lastChange.current;
      if (c && performance.now() - c.at < 1000 && c.key === pageKey()) {
        if (c.back) return; // already handled as Back / Forward
        c.back = true;
        writeNavDepth(readNavDepth() - 2); // it was counted +1 as a new page; Back is −1
        restore(readPositions()[c.key] ?? 0);
        return;
      }
      traverseAt.current = performance.now();
    };
    const onPopState = () => onTraverse();
    // Navigation API (Chrome, Edge, Safari): fires at the very START of Back / Forward
    type NavEvent = Event & { navigationType?: string };
    const nav = (window as unknown as { navigation?: EventTarget }).navigation;
    const onNavigate = (e: Event) => {
      if ((e as NavEvent).navigationType === "traverse") traverseAt.current = performance.now();
    };
    // A link to the page you are already on (e.g. the logo on the home page) → back to the top
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.origin !== location.origin || a.hash) return;
      if (a.pathname === location.pathname && a.search === location.search) window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    };
    // Keep the position of the page being shown. Only while the address still belongs to
    // it — after a click the address changes first, so the jump to the top of the NEXT
    // page is never saved over this page's position.
    let shownKey = pageKey();
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (pageKey() === shownKey) savePosition(shownKey, scrollY);
      });
    };
    const onShown = () => {
      shownKey = pageKey();
    };
    const onHide = () => {
      if (pageKey() === shownKey) savePosition(shownKey, scrollY);
    };
    // capture: runs BEFORE the router's own popstate handler, which re-renders the page
    // straight away — so the page change below already knows it was Back / Forward
    addEventListener("popstate", onPopState, { capture: true });
    nav?.addEventListener("navigate", onNavigate);
    addEventListener("click", onClick, { capture: true });
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("eduvora:page-shown", onShown);
    addEventListener("pagehide", onHide);
    return () => {
      removeEventListener("popstate", onPopState, { capture: true });
      nav?.removeEventListener("navigate", onNavigate);
      removeEventListener("click", onClick, { capture: true });
      removeEventListener("scroll", onScroll);
      removeEventListener("eduvora:page-shown", onShown);
      removeEventListener("pagehide", onHide);
      cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    // Count only REAL page changes (React may run this twice for the same page in development)
    if (lastPath.current === pathname) return;
    const isFirstPage = lastPath.current === null;
    lastPath.current = pathname;
    const back = !isFirstPage && traverseAt.current > 0 && performance.now() - traverseAt.current < 1500;
    traverseAt.current = 0;
    if (!isFirstPage) writeNavDepth(readNavDepth() + (back ? -1 : 1)); // in-site page count for "← Back"
    lastChange.current = { at: performance.now(), key: pageKey(), back };
    dispatchEvent(new Event("eduvora:page-shown")); // positions now belong to this page

    if (back) {
      // Back / Forward → where they were (0 if we never saw this page scrolled)
      restore(readPositions()[pageKey()] ?? 0);
    } else if (!window.location.hash) {
      // A new page → the very top (links like /mock-tests#mcq still go to their section)
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
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
