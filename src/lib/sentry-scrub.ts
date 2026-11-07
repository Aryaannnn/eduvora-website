// =====================================================================
//  SENTRY PRIVACY FILTER — runs on EVERY error before it leaves the site
//  (browser, server and edge). Never sends names, emails, phone numbers,
//  payment details, login cookies or secret links to Sentry.
//   • no user info, cookies, headers, request bodies or IP address
//   • emails, phone numbers, card-like numbers, Razorpay ids, tokens and
//     the parent-link secret are replaced with [email], [phone], … in every
//     message, URL, breadcrumb and extra value
// =====================================================================
import type { Breadcrumb, ErrorEvent, EventHint } from "@sentry/nextjs";

const RULES: [RegExp, string][] = [
  [/[A-Z0-9._%+-]+(?:@|%40)[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]"], // also URL-encoded (%40)
  [/\b(pay|order|plink|rfnd|cust|sub|inv)_[A-Za-z0-9]{6,}\b/g, "[$1_id]"], // Razorpay ids
  [/\b\d(?:[ -]?\d){12,18}\b/g, "[number]"], // card-like numbers
  [/(?:\+?91[\s-]?)?\b[6-9]\d{4}[\s-]?\d{5}\b/g, "[phone]"], // Indian mobile numbers
  [/\b\d{10,12}\b/g, "[phone]"],
  [/\/parent\/[A-Za-z0-9_-]+/g, "/parent/[secret]"],
  [/\b(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})\b/g, "[jwt]"],
  [/\b(sk|rk|pk|re|rzp)_(live|test)?_?[A-Za-z0-9]{12,}\b/g, "[key]"],
  [/([?&](?:email|phone|mobile|name|token|code|access_token|refresh_token|password|otp|key|signature|error_description|token_hash|rank|marks)=)[^&#\s]*/gi, "$1[removed]"],
];

/** Removes personal data from one piece of text. */
export function scrubText(s: string): string {
  let out = s;
  for (const [re, rep] of RULES) out = out.replace(re, rep);
  return out;
}

const SENSITIVE_KEY = /pass|token|secret|auth|cookie|session|email|phone|mobile|name|address|card|cvv|upi|vpa|account|ifsc|signature|otp|razorpay|payment_id|order_id/i;

/** Deep copy of a value with personal data removed (sensitive keys dropped). */
export function scrubValue(v: unknown, depth = 0, dropKeys = true): unknown {
  if (depth > 6) return "[…]";
  if (typeof v === "string") return scrubText(v);
  if (Array.isArray(v)) return v.slice(0, 50).map((x) => scrubValue(x, depth + 1, dropKeys));
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = dropKeys && SENSITIVE_KEY.test(k) ? "[removed]" : scrubValue(val, depth + 1, dropKeys);
    return out;
  }
  return v;
}

export function scrubEvent(event: ErrorEvent, _hint?: EventHint): ErrorEvent | null {
  void _hint;
  delete event.user; // no user id, email, name or IP
  delete event.server_name;
  if (event.request) {
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.data;
    delete event.request.env;
    if (event.request.url) event.request.url = scrubText(event.request.url);
    if (typeof event.request.query_string === "string") event.request.query_string = scrubText(event.request.query_string);
    else delete event.request.query_string;
  }
  if (event.message) event.message = scrubText(event.message);
  if (event.transaction) event.transaction = scrubText(event.transaction);
  for (const ex of event.exception?.values ?? []) {
    if (ex.value) ex.value = scrubText(ex.value);
    for (const f of ex.stacktrace?.frames ?? []) {
      delete f.vars; // local variables could hold personal data
      if (f.abs_path) f.abs_path = scrubText(f.abs_path);
    }
  }
  if (event.extra) event.extra = scrubValue(event.extra) as typeof event.extra;
  if (event.contexts) {
    const { trace, os, browser, runtime, device, app, culture } = event.contexts;
    // technical info only (browser / OS names are kept; text is still scrubbed)
    event.contexts = scrubValue({ trace, os, browser, runtime, device, app, culture }, 0, false) as typeof event.contexts;
  }
  if (event.breadcrumbs) event.breadcrumbs = event.breadcrumbs.map((b) => scrubBreadcrumb(b)).filter(Boolean) as Breadcrumb[];
  if (event.tags) event.tags = scrubValue(event.tags) as typeof event.tags;
  return event;
}

export function scrubBreadcrumb(b: Breadcrumb): Breadcrumb | null {
  if (b.category === "console" && b.level !== "error" && b.level !== "warning") return null; // ordinary logs aren't needed
  if (b.message) b.message = scrubText(b.message);
  if (b.data) b.data = scrubValue(b.data) as typeof b.data;
  return b;
}

/** Shared Sentry options (browser, server and edge). */
export const sentryPrivacyOptions = {
  sendDefaultPii: false, // never attach IP addresses, cookies or user details
  beforeSend: scrubEvent,
  beforeBreadcrumb: scrubBreadcrumb,
  tracesSampleRate: 0, // errors only (keeps it free and private)
  maxValueLength: 1000,
};

export const SENTRY_DSN = (process.env.NEXT_PUBLIC_SENTRY_DSN ?? "").trim();
