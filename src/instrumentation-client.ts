// Sentry in the BROWSER. Off when NEXT_PUBLIC_SENTRY_DSN is empty (e.g. localhost).
// Every report is cleaned of personal data first (src/lib/sentry-scrub.ts).
//
// Speed (mobile SEO): the Sentry code (~70 KB) is NOT part of the first page
// load. It is downloaded when the browser is idle after the page has shown,
// and only when Sentry is switched on.
import { SENTRY_DSN, sentryPrivacyOptions } from "@/lib/sentry-scrub";

if (SENTRY_DSN && typeof window !== "undefined") {
  const start = () => {
    void import("@sentry/nextjs").then((Sentry) =>
      Sentry.init({
        dsn: SENTRY_DSN,
        environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
        ...sentryPrivacyOptions,
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
