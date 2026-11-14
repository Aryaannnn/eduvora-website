import { siteConfig, whatsappLink } from "@/config/site";
import { WhatsAppIcon } from "./Icons";

// Shown when no counselling slot is open (home page "Book a call" + the booking page).
// ✏️ Text: src/config/site.ts → noSlotsMessage
export default function NoSlotsMessage({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-xl bg-emerald-50/70 p-4 text-center ring-1 ring-emerald-200 ${className}`}>
      <p className="text-sm font-medium text-slate-700">{siteConfig.noSlotsMessage}</p>
      <a
        href={whatsappLink("Hi, I'd like to book a counselling session. When can we talk?")}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-primary mt-3 w-full !bg-[#25D366] !py-3 text-base !text-white hover:!bg-[#1ebe5b]"
      >
        <WhatsAppIcon className="h-5 w-5" /> Message us on WhatsApp
      </a>
    </div>
  );
}
