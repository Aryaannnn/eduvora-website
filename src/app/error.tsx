"use client"; // Error boundaries must be Client Components

// Shown instead of a broken page when something fails while loading a page
// (the header and footer still show). The error goes to Sentry (if switched on),
// cleaned of personal data.
import Link from "next/link";
import { useEffect } from "react";
import { siteConfig } from "@/config/site";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;
  useEffect(() => {
    // Sentry is loaded only now (keeps normal pages fast); off without a DSN
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) void import("@sentry/nextjs").then((Sentry) => Sentry.captureException(error)).catch(() => {});
  }, [error]);

  return (
    <section className="container-page grid min-h-[60vh] place-items-center py-16">
      <div className="card max-w-lg p-8 text-center sm:p-10">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-amber-100 text-3xl" aria-hidden>😕</span>
        <h1 className="mt-5 text-2xl font-extrabold text-slate-900">Something went wrong</h1>
        <p className="mt-2 text-slate-600">
          Please try again. If it keeps happening, contact us at{" "}
          <a href={`mailto:${siteConfig.email}`} className="font-semibold text-brand-700 underline">{siteConfig.email}</a>.
        </p>
        <p className="mt-1 text-sm text-slate-500">Your payments and bookings are safe — nothing was lost.</p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <button type="button" onClick={() => retry()} className="btn-primary">Try again</button>
          <Link href="/" className="btn-light">Go to home page</Link>
        </div>
        {digest && <p className="mt-6 text-xs text-slate-400">Error code: {digest} (mention it if you contact us)</p>}
      </div>
    </section>
  );
}
