// =====================================================================
//  CRITICAL FAILURE ALERTS (Sentry) — payments, bookings, emails, logins
//  reportFailure("payment", "Webhook signature invalid", err, { orderRef })
//  • Tagged area:<payment|booking|email|login|calendar> + critical:yes, so a
//    Sentry alert rule can email you the moment one happens (see SENTRY.md).
//  • Only send ids / short codes in `extra` — NEVER names, emails, phones or
//    card/UPI details (they are also stripped by src/lib/sentry-scrub.ts).
//  • Does nothing when Sentry is off (no DSN); still logs to the console.
//  • Sentry is loaded only when a failure happens (keeps pages fast).
// =====================================================================
import { SENTRY_DSN } from "./sentry-scrub";

export type FailureArea = "payment" | "booking" | "email" | "login" | "calendar" | "reader" | "pdf" | "progress";

/** level "warning" = worth seeing in Sentry, but not an alert (e.g. a student's connection dropped). */
export function reportFailure(area: FailureArea, what: string, err?: unknown, extra?: Record<string, string | number | boolean | null | undefined>, level: "error" | "warning" = "error") {
  const detail = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  console.warn(`[${area}] ${what}${detail ? `: ${detail}` : ""}`);
  if (!SENTRY_DSN) return;
  void import("@sentry/nextjs")
    .then((Sentry) =>
      Sentry.withScope((scope) => {
        scope.setTag("area", area);
        scope.setTag("critical", level === "error" ? "yes" : "no");
        if (typeof extra?.step === "string") scope.setTag("step", extra.step); // which step failed (searchable)
        scope.setLevel(level);
        scope.setFingerprint([area, what]); // one issue per kind of failure
        if (extra) scope.setExtras(extra);
        if (err instanceof Error) {
          scope.setExtra("what", what);
          Sentry.captureException(err);
        } else {
          Sentry.captureMessage(`[${area}] ${what}${detail ? `: ${detail}` : ""}`);
        }
      }),
    )
    .catch(() => {
      /* monitoring must never break the website */
    });
}
