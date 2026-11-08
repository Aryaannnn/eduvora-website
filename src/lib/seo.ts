// =====================================================================
//  SEO HELPERS
//  pageMeta(): title + description + canonical URL (+ matching link-preview
//  text) for a public page. Canonical URLs are built from
//  NEXT_PUBLIC_SITE_URL (metadataBase in src/app/layout.tsx).
//  Pre-launch / Live is still decided ONLY in src/config/launch.ts — while
//  PRE_LAUNCH is true every page says "noindex" (root layout).
// =====================================================================
import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import { SITE_URL } from "./site-url";

type PageMetaInput = {
  /** Shown as "<title> | EDUVORA" (unless absolute) */
  title: string;
  /** 70–160 characters, written for people searching on Google */
  description: string;
  /** e.g. "/courses" — becomes the canonical URL */
  path: string;
  /** use the title exactly as given (no " | EDUVORA" added) */
  absolute?: boolean;
  /** extra link-preview image (otherwise the site's default share image) */
  image?: { url: string; alt: string };
  type?: "website" | "article" | "profile";
};

export function pageMeta({ title, description, path, absolute, image, type = "website" }: PageMetaInput): Metadata {
  const full = absolute ? title : `${title} | ${siteConfig.businessName}`;
  // Setting openGraph on a page replaces the site-wide one, so the default share picture
  // (src/app/opengraph-image.png) is added back unless the page has its own.
  const shareImage = image ?? { url: "/opengraph-image.png", width: 1200, height: 630, alt: `${siteConfig.businessName} — ${siteConfig.tagline}` };
  return {
    title: absolute ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type,
      siteName: siteConfig.businessName,
      locale: "en_IN",
      url: path,
      title: full,
      description,
      images: [shareImage],
    },
    twitter: { card: "summary_large_image", title: full, description, images: [shareImage.url] },
  };
}

/** For private pages (dashboard, payments, parent links …): never in Google. */
export const NO_INDEX: Metadata["robots"] = { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } };

export const absoluteUrl = (path: string) => (/^https?:\/\//.test(path) ? path : `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`);

// ---------------------------------------------------------------------
//  Structured data (JSON-LD) builders — schema.org
// ---------------------------------------------------------------------
const ORG_ID = () => `${SITE_URL}/#organization`;

/** EDUVORA as an organisation (+ the website) — on every page. */
export function organizationLd() {
  const sameAs = [siteConfig.instagram, siteConfig.youtube].filter((u): u is string => typeof u === "string" && /^https:\/\/\S+$/.test(u));
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "EducationalOrganization",
        "@id": ORG_ID(),
        name: siteConfig.businessName,
        url: SITE_URL,
        logo: { "@type": "ImageObject", url: absoluteUrl(siteConfig.logo) },
        description: siteConfig.description,
        email: siteConfig.email,
        founder: { "@type": "Person", name: siteConfig.founder.name, url: absoluteUrl("/founder") },
        areaServed: "IN",
        ...(sameAs.length ? { sameAs } : {}),
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: siteConfig.businessName,
        publisher: { "@id": ORG_ID() },
        inLanguage: "en-IN",
      },
    ],
  };
}

/** Home > … > current page */
export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [{ name: "Home", path: "/" }, ...items].map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absoluteUrl(it.path),
    })),
  };
}

export function faqLd(faqs: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}

export function courseLd(c: { name: string; description: string; path: string; price: number; image?: string | null }) {
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    name: c.name,
    description: c.description,
    url: absoluteUrl(c.path),
    ...(c.image ? { image: absoluteUrl(c.image) } : {}),
    provider: { "@type": "Organization", "@id": ORG_ID(), name: siteConfig.businessName, sameAs: SITE_URL },
    inLanguage: "en-IN",
    offers: {
      "@type": "Offer",
      category: c.price > 0 ? "Paid" : "Free",
      price: c.price,
      priceCurrency: "INR",
      availability: "https://schema.org/InStock",
      url: absoluteUrl(c.path),
    },
    hasCourseInstance: { "@type": "CourseInstance", courseMode: "Online" },
  };
}

export function personLd(p: { name: string; jobTitle?: string; description?: string; image?: string; path: string }) {
  const sameAs = [siteConfig.instagram, siteConfig.youtube].filter((u): u is string => typeof u === "string" && /^https:\/\/\S+$/.test(u));
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: p.name,
    url: absoluteUrl(p.path),
    ...(p.jobTitle ? { jobTitle: p.jobTitle } : {}),
    ...(p.description ? { description: p.description } : {}),
    ...(p.image ? { image: absoluteUrl(p.image) } : {}),
    worksFor: { "@id": ORG_ID() },
    ...(sameAs.length ? { sameAs } : {}),
  };
}
