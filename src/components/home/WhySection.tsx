import Link from "next/link";
import { getWhySettings } from "@/lib/why";
import { ArrowRightIcon } from "../Icons";
import { WHY_ICON_COMPONENTS } from "./why-icons";
import Reveal from "../Reveal";
import SectionHeading from "../SectionHeading";


const ACCENTS = [
  "bg-brand-50 text-brand-700 ring-brand-100",
  "bg-accent-400/15 text-accent-700 ring-accent-400/30",
  "bg-emerald-50 text-emerald-700 ring-emerald-100",
  "bg-violet-50 text-violet-700 ring-violet-100",
];

/** "Why EDUVORA?" — 4 cards, edited in Admin → Settings (hidden there with one switch). */
export default async function WhySection() {
  const why = await getWhySettings();
  if (!why.enabled || why.cards.length === 0) return null;
  const n = why.cards.length;
  const cols = n === 1 ? "max-w-sm mx-auto" : n === 2 ? "sm:grid-cols-2 max-w-3xl mx-auto" : n === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4";
  return (
    <section className="section" id="why-eduvora" aria-labelledby="why-eduvora-title">
      <div className="container-page">
        <SectionHeading center eyebrow="Why students choose us" title={why.title} id="why-eduvora-title" />
        <ul className={`mt-10 grid gap-5 ${cols}`}>
          {why.cards.map((c, i) => {
            const Icon = WHY_ICON_COMPONENTS[c.icon];
            const body = (
              <>
                <span className={`grid h-12 w-12 place-items-center rounded-2xl ring-1 ${ACCENTS[i % ACCENTS.length]}`}><Icon className="h-6 w-6" /></span>
                <h3 className="mt-4 text-lg font-extrabold text-slate-900">{c.title}</h3>
                {c.text && <p className="mt-2 text-sm leading-relaxed text-slate-600">{c.text}</p>}
                {c.href && <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-bold text-brand-700">Learn more <ArrowRightIcon className="h-4 w-4" /></span>}
              </>
            );
            return (
              <li key={i}>
                <Reveal delay={i * 80} className="h-full">
                  {c.href ? (
                    <Link href={c.href} className="card card-hover flex h-full flex-col p-6">{body}</Link>
                  ) : (
                    <div className="card flex h-full flex-col p-6">{body}</div>
                  )}
                </Reveal>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
