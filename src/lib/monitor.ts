// =====================================================================
//  CRITICAL FAILURE ALERTS (Sentry) — payments, bookings, emails, logins
//  reportFailure("payment", "Webhook signature invalid", err, { orderRef })
//  • Tagged area:<payment|booking|email|login|calendar> + critical:yes, so a
//    Sentry alert rule can email you the moment one happens (see SENTRY.md).
//  • Only send ids / short codes in `extra` — NEVER names, emails, phones or
//    card/UPI details (they are also stripped by src/lib/sentry-scrub.ts).
//  • Does nothing when Sentry is off (no DSN); still logs to the console.
// =====================================================================
import * as Sentry from "@sentry/nextjs";

export type FailureArea = "payment" | "booking" | "email" | "login" | "calendar";

export function reportFailure(area: FailureArea, what: string, err?: unknown, extra?: Record<string, string | number | boolean | null | undefined>) {
  const detail = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  console.warn(`[${area}] ${what}${detail ? `: ${detail}` : ""}`);
  try {
    Sentry.withScope((scope) => {
      scope.setTag("area", area);
      scope.setTag("critical", "yes");
      scope.setLevel("error");
      scope.setFingerprint([area, what]); // one issue per kind of failure
      if (extra) scope.setExtras(extra);
      if (err instanceof Error) {
        scope.setExtra("what", what);
        Sentry.captureException(err);
      } else {
        Sentry.captureMessage(`[${area}] ${what}${detail ? `: ${detail}` : ""}`);
      }
    });
  } catch {
    /* monitoring must never break the website */
  }
}
