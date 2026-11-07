// =====================================================================
//  ANALYTICS EVENTS (browser) — Vercel Analytics + Google Analytics 4
//  track("buy_click", { item_type: "course" })
//
//  🔒 Privacy: we NEVER send names, emails or phone numbers. Only the
//  small set of keys below is allowed, and any value that looks like an
//  email or a phone number is dropped before anything is sent.
// =====================================================================
import { track as vercelTrack } from "@vercel/analytics";

export type EventName =
  | "sign_up"
  | "login"
  | "buy_click"
  | "payment_success"
  | "slot_booked"
  | "predictor_used"
  | "free_resource"
  | "whatsapp_click"
  | "call_click"
  | "community_click";

type Props = Record<string, string | number | boolean | null | undefined>;

// The ONLY detail keys that may be sent
const ALLOWED = new Set(["method", "item_type", "item_id", "value", "currency", "source", "access", "action", "page", "free"]);

const looksPersonal = (v: string) => v.includes("@") || /\d{7,}/.test(v.replace(/[\s+-]/g, ""));

export function cleanProps(props: Props = {}): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(props)) {
    if (!ALLOWED.has(k) || v === null || v === undefined) continue;
    if (typeof v === "string") {
      const s = v.slice(0, 80);
      if (!looksPersonal(s)) out[k] = s;
    } else if (typeof v === "number" ? Number.isFinite(v) : true) out[k] = v;
  }
  return out;
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/** Send one event to Vercel Analytics and (if set up) Google Analytics. Never throws. */
export function track(name: EventName, props?: Props) {
  if (typeof window === "undefined") return;
  const clean = cleanProps(props);
  try {
    vercelTrack(name, clean);
  } catch {
    /* analytics must never break the site */
  }
  try {
    window.gtag?.("event", name, clean);
  } catch {
    /* ignore */
  }
}

/** Same as track(), but only once per browser tab for this key (e.g. a purchase id) — refreshing won't count it twice. */
export function trackOnce(key: string, name: EventName, props?: Props) {
  try {
    const k = `eduvora-ev-${key}`;
    if (sessionStorage.getItem(k)) return;
    sessionStorage.setItem(k, "1");
  } catch {
    /* private mode: just send it */
  }
  track(name, props);
}
