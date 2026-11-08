import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingButtons from "@/components/FloatingButtons";
import NavigationEffects from "@/components/NavigationEffects";
import CompleteProfilePrompt from "@/components/auth/CompleteProfilePrompt";
import SiteAnalytics from "@/components/analytics/SiteAnalytics";
import ConsentPrompt from "@/components/privacy/ConsentPrompt";
import CookieNotice from "@/components/privacy/CookieNotice";
import MaintenanceBanner from "@/components/MaintenanceBanner";
import JsonLd from "@/components/seo/JsonLd";
import { organizationLd } from "@/lib/seo";
import { communityHref, getCommunityLink } from "@/lib/community";
import { Suspense } from "react";
import PrivatePageGuard from "@/components/auth/PrivatePageGuard";
import { PRE_LAUNCH } from "@/config/launch";
import { siteConfig } from "@/config/site";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });

const homeTitle = `${siteConfig.businessName} | ${siteConfig.tagline}`;

export const metadata: Metadata = {
  // Full links to the share image for WhatsApp/Facebook (comes from NEXT_PUBLIC_SITE_URL)
  metadataBase: new URL(siteConfig.siteUrl),
  // Pre-launch: hide the whole site from Google (switch in src/config/launch.ts)
  ...(PRE_LAUNCH ? { robots: { index: false, follow: false, googleBot: { index: false, follow: false } } } : {}),
  applicationName: siteConfig.businessName,
  title: {
    default: homeTitle,
    template: `%s | ${siteConfig.businessName}`,
  },
  description: siteConfig.description,
  // Link previews (WhatsApp, Facebook, LinkedIn, X). The image is src/app/opengraph-image.png
  openGraph: {
    type: "website",
    siteName: siteConfig.businessName,
    title: homeTitle,
    description: `${siteConfig.tagline} ${siteConfig.description}`,
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: homeTitle,
    description: siteConfig.tagline,
  },
};

export const viewport: Viewport = { themeColor: "#0b2a5b" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${jakarta.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        {/* Google: who we are (logo, social links) */}
        <JsonLd data={organizationLd()} />
        {/* "Maintenance mode is ON" — only admins/counsellors ever see the site while it is on */}
        <Suspense fallback={null}>
          <MaintenanceBanner />
        </Suspense>
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <FloatingButtons />
        <NavigationEffects />
        <PrivatePageGuard />
        <Suspense fallback={null}>
          <ProfilePrompt />
        </Suspense>
        {/* Privacy: one-time consent for accounts without it + small cookie notice (shown once) */}
        <ConsentPrompt />
        <CookieNotice />
        {/* Vercel Analytics + Speed Insights (+ Google Analytics if NEXT_PUBLIC_GA_ID is set) */}
        <Suspense fallback={null}>
          <SiteAnalytics />
        </Suspense>
      </body>
    </html>
  );
}

// "Complete your profile" popup (shown right after sign-up) + WhatsApp community link if set
async function ProfilePrompt() {
  const link = await getCommunityLink();
  return <CompleteProfilePrompt communityHref={link ? communityHref("signup") : null} />;
}
