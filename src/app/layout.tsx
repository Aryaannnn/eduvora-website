import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingButtons from "@/components/FloatingButtons";
import NavigationEffects from "@/components/NavigationEffects";
import PrivatePageGuard from "@/components/auth/PrivatePageGuard";
import { siteConfig } from "@/config/site";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });

const homeTitle = `${siteConfig.businessName} | ${siteConfig.tagline}`;

export const metadata: Metadata = {
  // Needed so WhatsApp/Facebook get full links to the share image (set NEXT_PUBLIC_SITE_URL when live)
  metadataBase: new URL(siteConfig.siteUrl),
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
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <FloatingButtons />
        <NavigationEffects />
        <PrivatePageGuard />
      </body>
    </html>
  );
}
