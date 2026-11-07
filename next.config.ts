import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";
import { PRE_LAUNCH } from "./src/config/launch";

// Supabase address (for blog pictures stored in the public 'blog-images' bucket)
const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
  } catch {
    return "";
  }
})();

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Image qualities the website may use (90 keeps the logo's thin letters sharp)
  images: {
    qualities: [75, 90],
    // YouTube thumbnails for video testimonials
    remotePatterns: [
      { protocol: "https", hostname: "i.ytimg.com", pathname: "/vi/**" },
      ...(supabaseHost ? [{ protocol: "https" as const, hostname: supabaseHost, pathname: "/storage/v1/object/public/blog-images/**" }] : []),
    ],
  },
  // The small logo is read from disk when building PDF invoices (server routes)
  outputFileTracingIncludes: {
    "/api/**": ["./public/logo-email.png"],
    "/admin/**": ["./public/logo-email.png"],
    "/booking-confirmed": ["./public/logo-email.png"],
    "/payment-failed": ["./public/logo-email.png"],
    "/dashboard/**": ["./public/logo-email.png"],
  },
  // Pre-launch: also tell search engines "noindex" in a header (covers PDFs and images too)
  async headers() {
    // Private parent pages (/parent/<secret>): never indexed or cached, and the secret
    // is never sent to other sites as a "referrer"
    const parent = {
      source: "/parent/:path*",
      headers: [
        { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "Cache-Control", value: "private, no-store, max-age=0" },
      ],
    };
    return PRE_LAUNCH ? [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }, parent] : [parent];
  },
  // The old "My Account" page now lives inside the student dashboard
  async redirects() {
    return [{ source: "/account", destination: "/dashboard", permanent: false }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

// Error monitoring (Sentry) — only when NEXT_PUBLIC_SENTRY_DSN is set (see SENTRY.md).
// With SENTRY_AUTH_TOKEN + SENTRY_ORG + SENTRY_PROJECT, readable code maps are uploaded
// to Sentry during the Vercel build and then deleted, so they are never public.
const sentryOn = !!(process.env.NEXT_PUBLIC_SENTRY_DSN ?? "").trim();
const uploadMaps = !!(process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT);

export default sentryOn
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: !process.env.CI,
      telemetry: false,
      widenClientFileUpload: true,
      sourcemaps: { disable: !uploadMaps, deleteSourcemapsAfterUpload: true },
    })
  : nextConfig;
