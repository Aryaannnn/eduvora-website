import Link from "next/link";
import { siteConfig, whatsappLink } from "@/config/site";
import { MailIcon, WhatsAppIcon } from "./Icons";

// Shown when no counselling slot is open (home page "How it works").
// The Book a Slot page shows the free enquiry form itself.
// ✏️ Text: src/config/site.ts → noSlotsMessage
export default function NoSlotsMessage({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-xl bg-amber-50 p-4 text-center ring-1 ring-amber-200 ${className}`}>
      <p className="text-sm font-medium text-slate-800">{siteConfig.noSlotsMessage}</p>
      <Link href="/contact#enquiry" className="btn-primary mt-3 w-full !py-3 text-base">
        <MailIcon className="h-5 w-5" /> Leave your details
      </Link>
      {siteConfig.showWhatsApp && (
        <a
          href={whatsappLink("Hi, I'd like to book a counselling session. When can we talk?")}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-light mt-2 w-full !py-3 text-base"
        >
          <WhatsAppIcon className="h-5 w-5 text-[#25D366]" /> Message us on WhatsApp
        </a>
      )}
    </div>
  );
}
