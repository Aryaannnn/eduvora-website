// =====================================================================
//  SENTRY IN THE BROWSER — downloaded ONLY when something goes wrong
//  The Sentry library is big (~150 KB compressed, ~470 KB of JavaScript to
//  run). Almost every visit has no error, so no visitor should pay for it:
//  src/instrumentation-client.ts listens for errors with a few lines of code,
//  and only the first error (or a reportFailure() call) loads Sentry here,
//  sets it up and sends the report.
//  Every report is cleaned of personal data first (src/lib/sentry-scrub.ts).
//  Sampling: every error is sent (they are rare and each one matters);
//  performance tracing is off (tracesSampleRate 0 in sentry-scrub.ts).
// =====================================================================
import type { ErrorEvent } from "@sentry/nextjs";
import { SENTRY_DSN, sentryPrivacyOptions } from "./sentry-scrub";

type SentryModule = typeof import("@sentry/nextjs");
let ready: Promise<SentryModule | null> | null = null;

/** Loads + sets up Sentry once (browser only). null when Sentry is off or can't load. */
export function loadSentry(): Promise<SentryModule | null> {
  if (!SENTRY_DSN || typeof window === "undefined") return Promise.resolve(null);
  ready ??= import("@sentry/nextjs")
    .then((Sentry) => {
      Sentry.init({
        dsn: SENTRY_DSN,
        environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
        ...sentryPrivacyOptions,
        beforeSend: (event, hint) => sentryPrivacyOptions.beforeSend(addNetworkDetail(event), hint),
        // Browser noise that isn't a problem with the website
        ignoreErrors: [
          "ResizeObserver loop limit exceeded",
          "ResizeObserver loop completed with undelivered notifications",
          "Non-Error promise rejection captured",
          /^Script error\.?$/,
          /Loading chunk [\d]+ failed/,
          "AbortError",
        ],
        denyUrls: [/extensions\//i, /^chrome:\/\//i, /^chrome-extension:\/\//i, /^moz-extension:\/\//i],
      });
      return Sentry;
    })
    .catch(() => {
      ready = null; // e.g. offline — try again with the next error
      return null;
    });
  return ready;
}

/** "TypeError: Load failed" (Safari) / "Failed to fetch" (Chrome) say nothing about WHICH request
 *  failed. Add the last request the page made (path only, no query), whether the phone was online
 *  and whether the page was in the background — then the privacy filter runs as usual. */
function addNetworkDetail(event: ErrorEvent): ErrorEvent {
  const value = event.exception?.values?.[0]?.value ?? "";
  if (!/^(Load failed|Failed to fetch|NetworkError when attempting to fetch resource\.?)$/i.test(value)) return event;
  // Sentry's own record of requests (only once it is loaded) …
  const last = [...(event.breadcrumbs ?? [])].reverse().find((b) => b.category === "fetch" || b.category === "xhr");
  let url = typeof last?.data?.url === "string" ? last.data.url : "";
  // … otherwise the browser's list of the page's recent requests
  if (!url) {
    const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    url = [...entries].reverse().find((e) => e.initiatorType === "fetch" || e.initiatorType === "xmlhttprequest")?.name ?? "";
  }
  let path = "";
  try {
    path = url ? new URL(url, location.href).pathname : "";
  } catch {}
  event.tags = { ...event.tags, network_error: "yes", failed_request: path.slice(0, 120) || "unknown", online: String(navigator.onLine), page_visible: String(document.visibilityState === "visible") };
  event.extra = { ...event.extra, failedRequestMethod: typeof last?.data?.method === "string" ? last.data.method : "", failedRequestStatus: typeof last?.data?.status_code === "number" ? last.data.status_code : null };
  return event;
}
