import Link from "next/link";
import { siteConfig, whatsappLink } from "@/config/site";
import { founder } from "@/content/founder";
import { getOpenContact } from "@/lib/contact";
import { getContactMode } from "@/lib/contact-mode";
import FounderHighlights from "../FounderHighlights";
import FounderPhoto from "../FounderPhoto";
import { ArrowRightIcon, CalendarIcon, PhoneIcon, WhatsAppIcon } from "../Icons";
import Reveal from "../Reveal";

// Home page founder section (short version). Text lives in src/content/founder.ts
// Sits right under the hero slideshow: phones show the photo on top, text below.
// eagerPhoto: right under the slideshow the photo is visible on phones straight away → load it first
export default async function FounderSection({ className = "", eagerPhoto = false }: { className?: string; eagerPhoto?: boolean }) {
  // Contact mode Open (Admin → Settings) → the number with Call + WhatsApp here too
  const [open, cm] = await Promise.all([getOpenContact(), getContactMode()]);
  return (
    <section aria-labelledby="founder-heading" className={`section ${className}`}>
      <div className="container-page grid items-center gap-10 sm:gap-12 lg:grid-cols-[0.85fr_1.15fr]">
        <Reveal className="relative mx-auto w-full max-w-[18rem] pb-6 sm:max-w-sm">
          <FounderPhoto eager={eagerPhoto} />
          <div className="absolute bottom-0 left-1/2 w-max max-w-[90%] -translate-x-1/2 rounded-2xl bg-white px-5 py-3 text-center shadow-xl ring-1 ring-slate-200">
            <p className="font-extrabold text-brand-700">{founder.name}</p>
            <p className="text-xs font-semibold text-accent-700">{founder.shortTitle}</p>
          </div>
        </Reveal>

        <Reveal delay={100}>
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-accent-700">
            <span className="h-1.5 w-6 rounded-full bg-accent-400" /> About the founder
          </p>
          <h2 id="founder-heading" className="mt-3 text-3xl font-extrabold tracking-tight text-brand-700 sm:text-4xl">{founder.name}</h2>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-accent-700 sm:text-base">{founder.title}</p>
          <p className="mt-5 text-lg leading-relaxed text-slate-600">{founder.summary}</p>

          <FounderHighlights className="mt-6" />

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/founder" className="btn-primary !px-6 !py-3.5">
              Read Full Story <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <Link href="/book-a-slot" className="btn-accent !px-6 !py-3.5">
              <CalendarIcon className="h-5 w-5" /> Book a Direct Call
            </Link>
          </div>
          {open && (
            <div className="mt-5 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <p className="text-sm font-semibold text-slate-500">Call or WhatsApp</p>
              <p className="text-xl font-extrabold tracking-wide text-brand-700">{open.display}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-600 sm:text-xs">{cm.openNote}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <a href={`tel:${open.tel}`} className="btn-light !py-2.5 text-sm"><PhoneIcon className="h-4 w-4" /> Call</a>
                <a href={whatsappLink(siteConfig.whatsappMessage, open.waDigits)} target="_blank" rel="noopener noreferrer" className="btn-primary !bg-[#25D366] !py-2.5 text-sm hover:!bg-[#1ebe5b]">
                  <WhatsAppIcon className="h-4 w-4" /> WhatsApp
                </a>
              </div>
            </div>
          )}
          <Link href="/about" className="tap mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
            About EDUVORA <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
