// Sentry in the BROWSER. Off when NEXT_PUBLIC_SENTRY_DSN is empty (e.g. localhost).
// Every report is cleaned of personal data first (src/lib/sentry-scrub.ts).
//
// Speed (mobile SEO): the Sentry code (~70 KB) is NOT part of the first page
// load. It is downloaded when the browser is idle after the page has shown,
// and only when Sentry is switched on.
import type { ErrorEvent } from "@sentry/nextjs";
import { SENTRY_DSN, sentryPrivacyOptions } from "@/lib/sentry-scrub";

/** "TypeError: Load failed" (Safari) / "Failed to fetch" (Chrome) say nothing about WHICH request
 *  failed. Add the last request the page made (path only, no query), whether the phone was online
 *  and whether the page was in the background — then the privacy filter runs as usual. */
function addNetworkDetail(event: ErrorEvent): ErrorEvent {
  const value = event.exception?.values?.[0]?.value ?? "";
  if (!/^(Load failed|Failed to fetch|NetworkError when attempting to fetch resource\.?)$/i.test(value)) return event;
  const last = [...(event.breadcrumbs ?? [])].reverse().find((b) => b.category === "fetch" || b.category === "xhr");
  const url = typeof last?.data?.url === "string" ? last.data.url : "";
  let path = "";
  try {
    path = url ? new URL(url, location.href).pathname : "";
  } catch {}
  event.tags = { ...event.tags, network_error: "yes", failed_request: path.slice(0, 120) || "unknown", online: String(navigator.onLine), page_visible: String(document.visibilityState === "visible") };
  event.extra = { ...event.extra, failedRequestMethod: typeof last?.data?.method === "string" ? last.data.method : "", failedRequestStatus: typeof last?.data?.status_code === "number" ? last.data.status_code : null };
  return event;
}

if (SENTRY_DSN && typeof window !== "undefined") {
  const start = () => {
    void import("@sentry/nextjs").then((Sentry) =>
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
      }),
    );
  };
  if ("requestIdleCallback" in window) window.requestIdleCallback(start, { timeout: 3000 });
  else setTimeout(start, 1500);
}
