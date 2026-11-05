import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Image qualities the website may use (90 keeps the logo's thin letters sharp)
  images: { qualities: [75, 90] },
  // The small logo is read from disk when building PDF invoices (server routes)
  outputFileTracingIncludes: {
    "/api/**": ["./public/logo-email.png"],
    "/admin/**": ["./public/logo-email.png"],
    "/booking-confirmed": ["./public/logo-email.png"],
    "/payment-failed": ["./public/logo-email.png"],
    "/dashboard/**": ["./public/logo-email.png"],
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
