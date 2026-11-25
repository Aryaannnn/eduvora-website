"use client";

// =====================================================================
//  WEBSITE ANALYTICS (loaded on every page from src/app/layout.tsx)
//  • Vercel Analytics + Speed Insights — work automatically on Vercel
//    (turn them on in Vercel → your project → Analytics / Speed Insights).
//  • Google Analytics 4 — ONLY if NEXT_PUBLIC_GA_ID (e.g. G-ABC123XYZ) is set.
//  • Clicks on WhatsApp / Call / Community buttons are counted here.
//  ⚡ Speed: none of them load until the page has shown and the browser is
//     idle (they never delay the first paint or the first tap). Speed
//     Insights measures half of the visits (enough for averages).
//  🔒 Page addresses are sent WITHOUT the "?…" part (it can contain codes
//     or emails), and no personal details are ever sent (src/lib/analytics.ts).
// =====================================================================
import type { BeforeSendEvent } from "@vercel/analytics/next";
import dynamic from "next/dynamic";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { track } from "@/lib/analytics";

const GA_ID = (process.env.NEXT_PUBLIC_GA_ID ?? "").trim();
const gaOn = /^G-[A-Z0-9]{4,20}$/.test(GA_ID);

const stripQuery = (url: string) => url.split("?")[0].split("#")[0];
const beforeSend = (e: BeforeSendEvent) => ({ ...e, url: stripQuery(e.url) });

// downloaded separately, only once the page is idle
const Analytics = dynamic(() => import("@vercel/analytics/next").then((m) => m.Analytics), { ssr: false });
const SpeedInsights = dynamic(() => import("@vercel/speed-insights/next").then((m) => m.SpeedInsights), { ssr: false });

/** true once the page has loaded and the browser has a quiet moment */
function useIdle() {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    let cancel = () => {};
    const go = () => {
      if ("requestIdleCallback" in window) {
        const id = window.requestIdleCallback(() => setIdle(true), { timeout: 4000 });
        cancel = () => window.cancelIdleCallback(id);
      } else {
        const id = setTimeout(() => setIdle(true), 2000);
        cancel = () => clearTimeout(id);
      }
    };
    if (document.readyState === "complete") go();
    else window.addEventListener("load", go, { once: true });
    return () => {
      window.removeEventListener("load", go);
      cancel();
    };
  }, []);
  return idle;
}

export default function SiteAnalytics() {
  const idle = useIdle();
  return (
    <>
      {idle && (
        <>
          <Analytics beforeSend={beforeSend} />
          <SpeedInsights sampleRate={0.5} beforeSend={(e) => ({ ...e, url: stripQuery(e.url) })} />
          {gaOn && <GoogleAnalytics />}
        </>
      )}
      <ClickTracker />
    </>
  );
}

function GoogleAnalytics() {
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="lazyOnload" />
      <Script id="ga4-init" strategy="lazyOnload">
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
      // gtag still loading (it loads after the page) → check again for up to 15 s
      let tries = 0;
      const id = setInterval(() => {
        if (window.gtag) {
          clearInterval(id);
          send();
        } else if (++tries > 30) clearInterval(id);
      }, 500);
      return () => clearInterval(id);
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
