"use client";

import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { phoneLink, whatsappLink } from "@/config/site";
import { PhoneIcon, WhatsAppIcon } from "./Icons";

// Shown on every page (except the dashboard, which has its own Help page
// and a bottom menu in the same spot):
//  • WhatsApp button (bottom-right, all screens)
//  • "Call Now" button (bottom-left, phones/tablets only)
//  • WhatsApp → /go/whatsapp: opens WhatsApp for EVERYONE
//  • Call Now → /go/call: the SERVER checks if the visitor has paid:
//    paid / admin → phone dialer; everyone else → the "Unlock Direct Call" page.
//  The real number is never written in this file or in the page.
export default function FloatingButtons() {
  return (
    <Suspense fallback={null}>
      <Buttons />
    </Suspense>
  );
}

function Buttons() {
  const pathname = usePathname();
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/admin")) return null;

  return (
    <>
      <a
        href={phoneLink}
        aria-label="Call now"
        className="fixed bottom-5 left-4 z-50 inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-3.5 text-sm font-bold text-white shadow-xl shadow-brand-900/30 transition active:scale-95 md:hidden"
      >
        <PhoneIcon className="h-5 w-5" /> Call Now
      </a>

      <a
        href={whatsappLink()}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with us on WhatsApp"
        className="fixed bottom-5 right-4 z-50 grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-xl shadow-black/25 transition hover:scale-110 active:scale-95 sm:right-6"
      >
        <span className="absolute inset-0 animate-ping rounded-full bg-[#25D366] opacity-30 motion-reduce:hidden" />
        <WhatsAppIcon className="relative h-7 w-7" />
      </a>
    </>
  );
}
