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
    return PRE_LAUNCH ? [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }] : [];
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

export default nextConfig;
