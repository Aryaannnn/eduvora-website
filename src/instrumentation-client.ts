// Sentry in the BROWSER. Off when NEXT_PUBLIC_SENTRY_DSN is empty (e.g. localhost).
// Every report is cleaned of personal data first (src/lib/sentry-scrub.ts).
import * as Sentry from "@sentry/nextjs";
import { SENTRY_DSN, sentryPrivacyOptions } from "@/lib/sentry-scrub";

if (SENTRY_DSN) {
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
  });
}

export const onRouterTransitionStart = SENTRY_DSN ? Sentry.captureRouterTransitionStart : undefined;
