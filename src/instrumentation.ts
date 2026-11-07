// Runs once when the server starts: switches Sentry on for the server / edge
// (only when NEXT_PUBLIC_SENTRY_DSN is set) and reports errors from pages,
// server actions and API routes.
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("./sentry.server.config");
  if (process.env.NEXT_RUNTIME === "edge") await import("./sentry.edge.config");
}

export const onRequestError = Sentry.captureRequestError;
