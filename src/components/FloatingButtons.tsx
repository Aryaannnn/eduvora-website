"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type MouseEvent } from "react";
import { phoneLink, whatsappLink } from "@/config/site";
import { whatsappMessageFor } from "@/lib/whatsapp-message";
import { CalendarIcon, PhoneIcon, WhatsAppIcon } from "./Icons";

// Contact buttons on every public page:
//  • PHONES: a bar fixed to the bottom → [📞] [Book a Slot] [WhatsApp]
//    (hidden on booking, payment, test, login and admin pages, where it
//     would cover the form — those pages keep only the small WhatsApp button)
//  • COMPUTERS: the round WhatsApp button, bottom-right
//  • WhatsApp → /go/whatsapp: opens WhatsApp for EVERYONE, with a message about
//    the page they're on (src/lib/whatsapp-message.ts)
//  • Call → /go/call: the SERVER checks if the visitor has paid:
//    paid / admin → phone dialer; everyone else → the "Unlock Direct Call" page.
//  The real number is never written in this file or in the page.
//  Not shown at all on the dashboard (own bottom menu), admin or the exam screen.

const NONE = ["/dashboard", "/admin", "/tests"];
const NO_BAR = ["/book-a-slot", "/booking-confirmed", "/payment-success", "/payment-failed", "/unlock", "/invoice", "/login", "/auth", "/forgot-password", "/reset-password"];
const on = (pathname: string, list: string[]) => list.some((p) => pathname === p || pathname.startsWith(`${p}/`));

export default function FloatingButtons() {
  return (
    <Suspense fallback={null}>
      <Buttons />
    </Suspense>
  );
}

function Buttons() {
  const pathname = usePathname();
  if (on(pathname, NONE)) return null;
  // Course pages have their own "Enroll Now – ₹price" bar on phones (with WhatsApp)
  const coursePage = /^\/courses\/[^/]+/.test(pathname);
  const showBar = !on(pathname, NO_BAR) && !coursePage;

  // The link already mentions the page; on a click we add the page heading too
  // (e.g. the course name), read from the page itself.
  const href = whatsappLink(whatsappMessageFor(pathname));
  const withHeading = (e: MouseEvent<HTMLAnchorElement>) => {
    const h1 = (document.querySelector("main h1") ?? document.querySelector("h1"))?.textContent;
    e.currentTarget.href = whatsappLink(whatsappMessageFor(pathname, h1));
  };
  const waProps = { target: "_blank", rel: "noopener noreferrer", onClick: withHeading, onAuxClick: withHeading, onContextMenu: withHeading };

  return (
    <>
      {/* Round WhatsApp button: computers always; phones only where the bar is hidden */}
      <a
        href={href}
        {...waProps}
        aria-label="Chat with us on WhatsApp"
        className={`fixed bottom-5 right-4 z-50 h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-xl shadow-black/25 transition hover:scale-110 active:scale-95 sm:right-6 print:hidden ${showBar || coursePage ? "hidden md:grid" : "grid"}`}
      >
        <span className="absolute inset-0 animate-ping rounded-full bg-[#25D366] opacity-30 motion-reduce:hidden" />
        <WhatsAppIcon className="relative h-7 w-7" />
      </a>

      {showBar && (
        <>
          {/* Space at the end of the page so the bar never covers the footer */}
          <div className="h-20 md:hidden print:hidden" aria-hidden />
          <nav
            aria-label="Quick contact"
            className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-3 pt-2.5 shadow-[0_-8px_24px_-12px_rgba(15,23,42,0.25)] backdrop-blur pb-[max(0.625rem,env(safe-area-inset-bottom))] md:hidden print:hidden"
          >
            <div className="mx-auto flex max-w-md items-center gap-2.5">
              <a href={phoneLink} aria-label="Call us" className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100 active:scale-95">
                <PhoneIcon className="h-5 w-5" />
              </a>
              <Link href="/book-a-slot" className="btn-primary h-12 flex-1 !rounded-xl !py-0 text-[15px]">
                <CalendarIcon className="h-5 w-5" /> Book a Slot
              </Link>
              <a href={href} {...waProps} aria-label="Chat with us on WhatsApp" className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#25D366] text-white shadow-md shadow-[#25D366]/30 active:scale-95">
                <WhatsAppIcon className="h-6 w-6" />
              </a>
            </div>
          </nav>
        </>
      )}
    </>
  );
}
