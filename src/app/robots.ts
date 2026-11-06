// /robots.txt — tells search engines what they may look at.
// While PRE_LAUNCH is on (src/config/launch.ts), every page also carries
// "noindex", so Google won't show the site. Crawling is allowed on purpose:
// Google must be able to open a page to see its "noindex" note.
import type { MetadataRoute } from "next";
import { PRE_LAUNCH } from "@/config/launch";
import { SITE_URL } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const privatePaths = ["/admin", "/dashboard", "/api/", "/auth/", "/invoice/", "/booking-confirmed", "/payment-success", "/payment-failed"];
  return {
    rules: { userAgent: "*", allow: "/", disallow: PRE_LAUNCH ? [] : privatePaths },
    ...(PRE_LAUNCH ? {} : { host: SITE_URL }),
  };
}
