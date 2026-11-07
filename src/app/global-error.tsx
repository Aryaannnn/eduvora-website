"use client"; // Error boundaries must be Client Components

// Last-resort error page (when even the main layout fails). It replaces the whole
// page, so it has its own <html>/<body> and simple inline styles.
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { siteConfig } from "@/config/site";

export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  const btn: React.CSSProperties = { display: "inline-block", padding: "12px 22px", borderRadius: 999, fontWeight: 700, fontSize: 15, textDecoration: "none", cursor: "pointer" };
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#f8fafc", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", color: "#0f172a", padding: 16 }}>
        <title>{`Something went wrong | ${siteConfig.businessName}`}</title>
        <main style={{ maxWidth: 480, width: "100%", background: "#fff", borderRadius: 24, padding: "36px 28px", textAlign: "center", boxShadow: "0 10px 40px rgba(15,23,42,.08)", border: "1px solid #e2e8f0" }}>
          <p style={{ margin: 0, fontWeight: 800, letterSpacing: 1, color: "#1d4ed8" }}>{siteConfig.businessName}</p>
          <h1 style={{ margin: "16px 0 8px", fontSize: 26 }}>Something went wrong</h1>
          <p style={{ margin: 0, color: "#475569", lineHeight: 1.6 }}>
            Please try again. If it keeps happening, contact us at{" "}
            <a href={`mailto:${siteConfig.email}`} style={{ color: "#1d4ed8", fontWeight: 700 }}>{siteConfig.email}</a>.
          </p>
          <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 14 }}>Your payments and bookings are safe — nothing was lost.</p>
          <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button type="button" onClick={() => retry()} style={{ ...btn, border: 0, background: "#1d4ed8", color: "#fff" }}>Try again</button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- the app may be broken; a full page load is safest */}
            <a href="/" style={{ ...btn, background: "#fff", color: "#0f172a", border: "1px solid #cbd5e1" }}>Go to home page</a>
          </div>
          {digest && <p style={{ marginTop: 22, fontSize: 12, color: "#94a3b8" }}>Error code: {digest}</p>}
        </main>
      </body>
    </html>
  );
}
