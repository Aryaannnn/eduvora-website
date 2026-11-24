// =====================================================================
//  Stop the page behind a menu / popup from scrolling.
//  Locks the <html> element (NOT <body>): <body> keeps its "overflow-x: clip",
//  so the page can never become wider than the phone screen while a menu is open
//  (changing body overflow made phones re-measure the page and shift the layout).
//  Several popups can lock at once; the page scrolls again when the last one closes.
// =====================================================================
import { useEffect } from "react";

let locks = 0;
let saved = { overflow: "", overscroll: "" };

export function lockScroll(): () => void {
  const html = document.documentElement;
  if (locks === 0) {
    saved = { overflow: html.style.overflow, overscroll: html.style.overscrollBehavior };
    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none"; // no pull-to-refresh / rubber-band behind the menu
  }
  locks++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    locks = Math.max(0, locks - 1);
    if (locks === 0) {
      html.style.overflow = saved.overflow;
      html.style.overscrollBehavior = saved.overscroll;
    }
  };
}

/** React: keep the page behind still while `active` is true (popups, sheets). */
export function useScrollLock(active: boolean) {
  useEffect(() => (active ? lockScroll() : undefined), [active]);
}
