// Sentry in the BROWSER. Off when NEXT_PUBLIC_SENTRY_DSN is empty (e.g. localhost).
//
// Speed: the Sentry library (~150 KB compressed) is NOT downloaded on a normal
// visit. These few lines only listen for errors; the first error loads Sentry
// (src/lib/sentry-browser.ts), which then sends it — and catches any later ones
// itself. Every report is cleaned of personal data first (src/lib/sentry-scrub.ts).
import { loadSentry } from "@/lib/sentry-browser";
import { SENTRY_DSN } from "@/lib/sentry-scrub";

if (SENTRY_DSN && typeof window !== "undefined") {
  let loaded = false;
  const pending: unknown[] = [];
  const report = (error: unknown) => {
    if (loaded) return; // Sentry is set up → it catches errors on its own
    pending.push(error);
    void loadSentry().then((Sentry) => {
      if (!Sentry || loaded) return;
      loaded = true;
      for (const e of pending.splice(0)) Sentry.captureException(e);
    });
  };
  window.addEventListener("error", (e) => {
    // a script / image that failed to load has no error object — not a website bug
    if (e.error || e.message) report(e.error ?? new Error(e.message));
  });
  window.addEventListener("unhandledrejection", (e) => report(e.reason));
}
