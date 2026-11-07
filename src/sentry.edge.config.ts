// Sentry on the EDGE runtime (src/proxy.ts and edge routes). Loaded by src/instrumentation.ts.
// Off when NEXT_PUBLIC_SENTRY_DSN is empty. Personal data is removed first (src/lib/sentry-scrub.ts).
import * as Sentry from "@sentry/nextjs";
import { SENTRY_DSN, sentryPrivacyOptions } from "@/lib/sentry-scrub";

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    ...sentryPrivacyOptions,
  });
}
