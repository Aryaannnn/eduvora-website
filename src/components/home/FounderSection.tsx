import Link from "next/link";
import { founder } from "@/content/founder";
import FounderHighlights from "../FounderHighlights";
import FounderPhoto from "../FounderPhoto";
import { ArrowRightIcon, CalendarIcon } from "../Icons";
import Reveal from "../Reveal";

// Home page founder section (short version). Text lives in src/content/founder.ts
export default function FounderSection() {
  return (
    <section className="section">
      <div className="container-page grid items-center gap-12 lg:grid-cols-[0.85fr_1.15fr]">
        <Reveal className="relative pb-6">
          <FounderPhoto />
          <div className="absolute bottom-0 left-1/2 w-max max-w-[90%] -translate-x-1/2 rounded-2xl bg-white px-5 py-3 text-center shadow-xl ring-1 ring-slate-200">
            <p className="font-extrabold text-brand-700">{founder.name}</p>
            <p className="text-xs font-semibold text-accent-700">{founder.shortTitle}</p>
          </div>
        </Reveal>

        <Reveal delay={100}>
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-accent-700">
            <span className="h-1.5 w-6 rounded-full bg-accent-400" /> Meet the founder
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-brand-700 sm:text-4xl">{founder.name}</h2>
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
          <Link href="/about" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
            About EDUVORA <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
