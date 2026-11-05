import type { Metadata } from "next";
import Link from "next/link";
import CtaBanner from "@/components/CtaBanner";
import FounderHighlights from "@/components/FounderHighlights";
import FounderPhoto from "@/components/FounderPhoto";
import ResultsSection from "@/components/home/ResultsSection";
import { CheckIcon, HeadsetIcon, ShieldIcon, TargetIcon, UsersIcon } from "@/components/Icons";
import PageHero from "@/components/PageHero";
import Reveal from "@/components/Reveal";
import SectionHeading from "@/components/SectionHeading";
import { siteConfig } from "@/config/site";
import { founder } from "@/content/founder";

export const metadata: Metadata = {
  title: "About Us",
  description: `The story of ${siteConfig.businessName} and our founder ${siteConfig.founder.name}.`,
};

const values = [
  { icon: ShieldIcon, title: "Honest guidance", text: "We tell you what you need to hear, not what sells." },
  { icon: TargetIcon, title: "Exam-focused", text: "Everything we teach is built for VITEEE." },
  { icon: UsersIcon, title: "Personal attention", text: "Every student gets a plan made for them." },
  { icon: HeadsetIcon, title: "Always reachable", text: "Quick replies on call and WhatsApp." },
];

// ✏️ The founder text comes from src/content/founder.ts
export default function AboutPage() {
  return (
    <>
      <PageHero eyebrow="About us" title={`About ${siteConfig.businessName}`} subtitle="Helping VITEEE students prepare smartly and choose confidently.">
        <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold tracking-[0.2em] text-accent-300 ring-1 ring-white/15">{siteConfig.nameMeaning}</p>
      </PageHero>

      <section className="section">
        <div className="container-page grid items-center gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <Reveal className="mx-auto w-full max-w-sm"><FounderPhoto /></Reveal>
          <Reveal delay={100}>
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-accent-700">
              <span className="h-1.5 w-6 rounded-full bg-accent-400" /> Founder story
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-brand-700 sm:text-4xl">{founder.name}</h2>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-accent-700 sm:text-base">{founder.title}</p>
            <p className="mt-5 text-lg leading-relaxed text-slate-600">{founder.summary}</p>
            <FounderHighlights className="mt-6" />
            <blockquote className="mt-6 rounded-2xl border-l-4 border-accent-400 bg-accent-50 px-5 py-4 text-base font-semibold italic leading-relaxed text-brand-700">
              &ldquo;{founder.vision}&rdquo;
            </blockquote>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/founder" className="btn-primary !px-6 !py-3.5">Read Full Story</Link>
              <Link href="/book-a-slot" className="btn-accent !px-6 !py-3.5">Book a Direct Call</Link>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section bg-slate-50">
        <div className="container-page">
          <SectionHeading center eyebrow="Our values" title="What we stand for" />
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {values.map((v, i) => (
              <Reveal key={v.title} delay={i * 80} className="card card-hover p-6">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600"><v.icon /></span>
                <h3 className="mt-4 font-bold text-slate-900">{v.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{v.text}</p>
              </Reveal>
            ))}
          </div>
          <Reveal className="mx-auto mt-12 max-w-3xl rounded-3xl bg-white p-6 ring-1 ring-slate-200 sm:p-8">
            <h3 className="text-xl font-extrabold text-slate-900">What we help with</h3>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {["VITEEE preparation & crash courses", "Mock tests & MCQ practice", "Campus & branch selection", "Fee category guidance", "Document & counselling checklist", "Parent Q&A sessions"].map((x) => (
                <li key={x} className="flex items-center gap-2 text-slate-700"><CheckIcon className="h-5 w-5 text-green-600" />{x}</li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      <ResultsSection />
      <div className="pt-16 sm:pt-24"><CtaBanner /></div>
    </>
  );
}
