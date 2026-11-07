"use client";

// =====================================================================
//  WEBSITE ANALYTICS (loaded on every page from src/app/layout.tsx)
//  • Vercel Analytics + Speed Insights — work automatically on Vercel
//    (turn them on in Vercel → your project → Analytics / Speed Insights).
//  • Google Analytics 4 — ONLY if NEXT_PUBLIC_GA_ID (e.g. G-ABC123XYZ) is set.
//  • Clicks on WhatsApp / Call / Community buttons are counted here.
//  🔒 Page addresses are sent WITHOUT the "?…" part (it can contain codes
//     or emails), and no personal details are ever sent (src/lib/analytics.ts).
// =====================================================================
import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { Suspense, useEffect } from "react";
import { track } from "@/lib/analytics";

const GA_ID = (process.env.NEXT_PUBLIC_GA_ID ?? "").trim();
const gaOn = /^G-[A-Z0-9]{4,20}$/.test(GA_ID);

const stripQuery = (url: string) => url.split("?")[0].split("#")[0];
const beforeSend = (e: BeforeSendEvent) => ({ ...e, url: stripQuery(e.url) });

export default function SiteAnalytics() {
  return (
    <>
      <Analytics beforeSend={beforeSend} />
      <SpeedInsights beforeSend={(e) => ({ ...e, url: stripQuery(e.url) })} />
      {gaOn && <GoogleAnalytics />}
      <ClickTracker />
    </>
  );
}

function GoogleAnalytics() {
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());
gtag('config','${GA_ID}',{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false});`}
      </Script>
      <Suspense fallback={null}>
        <GaPageViews />
      </Suspense>
    </>
  );
}

// One page_view per page, with the address WITHOUT "?…"
function GaPageViews() {
  const pathname = usePathname();
  useEffect(() => {
    const send = () => window.gtag?.("event", "page_view", { page_location: window.location.origin + pathname, page_path: pathname, page_title: document.title });
    if (window.gtag) send();
    else {
      const id = setTimeout(send, 1500); // gtag still loading
      return () => clearTimeout(id);
    }
  }, [pathname]);
  return null;
}

// Counts clicks on any WhatsApp / Call / Community link on the whole site
function ClickTracker() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      const href = a?.getAttribute("href") ?? "";
      const page = window.location.pathname;
      if (href.startsWith("/go/whatsapp") || href.includes("wa.me/")) track("whatsapp_click", { page });
      else if (href.startsWith("/go/call") || href.startsWith("tel:")) track("call_click", { page });
      else if (href.startsWith("/go/community")) track("community_click", { page, source: new URL(href, window.location.origin).searchParams.get("from") ?? "" });
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);
  return null;
}
