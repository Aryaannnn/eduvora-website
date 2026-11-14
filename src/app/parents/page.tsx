import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import Accordion from "@/components/Accordion";
import FounderHighlights from "@/components/FounderHighlights";
import FounderPhoto from "@/components/FounderPhoto";
import { ArrowRightIcon, BookIcon, CalendarIcon, CheckIcon, ClipboardIcon, FileIcon, GraduationIcon, LockIcon, MailIcon, ReceiptIcon, ShieldIcon, TargetIcon, UsersIcon, WhatsAppIcon } from "@/components/Icons";
import PageHero from "@/components/PageHero";
import Reveal from "@/components/Reveal";
import SectionHeading from "@/components/SectionHeading";
import Stars from "@/components/Stars";
import JsonLd from "@/components/seo/JsonLd";
import { whatsappLink } from "@/config/site";
import { founder } from "@/content/founder";
import { parentsPage as c } from "@/content/parents";
import { getApprovedReviews } from "@/lib/data";
import { breadcrumbLd, faqLd, pageMeta } from "@/lib/seo";

// ✏️ All the text on this page is in src/content/parents.ts
export const metadata: Metadata = pageMeta({ title: c.meta.title, description: c.meta.description, path: "/parents" });

const coverIcons = [GraduationIcon, BookIcon, ReceiptIcon, CalendarIcon, FileIcon, ClipboardIcon];
const safetyIcons = [LockIcon, MailIcon, ShieldIcon, UsersIcon, CheckIcon];
const bookHref = "/book-a-slot?with=parents#book";

function Buttons({ center = false, dark = false }: { center?: boolean; dark?: boolean }) {
  return (
    <div className={`flex flex-col gap-3 sm:flex-row ${center ? "sm:justify-center" : ""}`}>
      <Link href={bookHref} className="btn-accent !px-6 !py-3.5 text-base">
        <CalendarIcon className="h-5 w-5" /> {c.buttons.book}
      </Link>
      <a href={whatsappLink(c.buttons.whatsappMessage)} target="_blank" rel="noopener noreferrer" className={`${dark ? "btn-outline" : "btn-light"} !px-6 !py-3.5 text-base`}>
        <WhatsAppIcon className="h-5 w-5 text-[#25D366]" /> {c.buttons.whatsapp}
      </a>
    </div>
  );
}

export default function ParentsPage() {
  return (
    <>
      <JsonLd data={[breadcrumbLd([{ name: "For Parents", path: "/parents" }]), faqLd(c.faq.items)]} />
      <PageHero eyebrow={c.hero.eyebrow} title={c.hero.title} subtitle={c.hero.subtitle}>
        <div className="mt-7"><Buttons dark /></div>
      </PageHero>

      {/* What counselling covers */}
      <section className="section">
        <div className="container-page">
          <SectionHeading center eyebrow="What we cover" title={c.covers.title} subtitle={c.covers.intro} />
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {c.covers.items.map((it, i) => {
              const Icon = coverIcons[i % coverIcons.length];
              return (
                <li key={it.title}>
                  <Reveal delay={(i % 3) * 80} className="card h-full p-6">
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100"><Icon className="h-5 w-5" /></span>
                    <h3 className="mt-4 text-lg font-extrabold text-slate-900">{it.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{it.text}</p>
                  </Reveal>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* How a session works */}
      <section className="section bg-slate-50">
        <div className="container-page max-w-3xl">
          <SectionHeading center eyebrow="Step by step" title={c.steps.title} />
          <ol className="mt-10 space-y-4">
            {c.steps.items.map((s, i) => (
              <li key={s.title}>
                <Reveal delay={i * 60} className="flex gap-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-600 text-base font-extrabold text-white">{i + 1}</span>
                  <span>
                    <span className="block text-lg font-extrabold text-slate-900">{s.title}</span>
                    <span className="mt-0.5 block leading-relaxed text-slate-600">{s.text}</span>
                  </span>
                </Reveal>
              </li>
            ))}
          </ol>
          <p className="mt-5 text-center text-sm text-slate-500">{c.steps.note}</p>
        </div>
      </section>

      {/* Questions parents ask */}
      <section className="section">
        <div className="container-page max-w-3xl">
          <SectionHeading center eyebrow="FAQ" title={c.faq.title} />
          <Reveal className="mt-10"><Accordion items={c.faq.items} /></Reveal>
          <p className="mt-4 text-center text-sm text-slate-500">
            Full details: <Link href="/refund-policy" className="font-semibold text-brand-700 underline">Refund &amp; Cancellation Policy</Link> ·{" "}
            <Link href="/privacy-policy" className="font-semibold text-brand-700 underline">Privacy Policy</Link>
          </p>
        </div>
      </section>

      {/* Meet the counsellor */}
      <section className="section bg-slate-50">
        <div className="container-page grid items-center gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <Reveal><FounderPhoto /></Reveal>
          <Reveal delay={100}>
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-accent-700">
              <span className="h-1.5 w-6 rounded-full bg-accent-400" /> {c.counsellor.title}
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-brand-700 sm:text-4xl">{founder.name}</h2>
            <p className="mt-2 text-sm font-semibold text-accent-700 sm:text-base">{founder.title}</p>
            <p className="mt-5 text-lg leading-relaxed text-slate-600">{founder.summary}</p>
            <FounderHighlights className="mt-6" />
            <Link href="/founder" className="mt-6 inline-flex items-center gap-1 font-bold text-brand-700 hover:underline">
              {c.counsellor.linkText} <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* Payment and data safety */}
      <section className="section">
        <div className="container-page">
          <SectionHeading center eyebrow="Trust" title={c.safety.title} />
          <ul className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {c.safety.items.map((it, i) => {
              const Icon = safetyIcons[i % safetyIcons.length];
              return (
                <li key={it.title} className="flex gap-4 rounded-2xl p-5 ring-1 ring-slate-200">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Icon className="h-5 w-5" /></span>
                  <span>
                    <span className="block font-extrabold text-slate-900">{it.title}</span>
                    <span className="mt-1 block text-sm leading-relaxed text-slate-600">{it.text}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Reviews from parents (hidden until one is approved in Admin → Reviews) */}
      <Suspense fallback={null}>
        <ParentReviews />
      </Suspense>

      {/* Closing */}
      <section className="section hero-bg relative overflow-hidden text-white">
        <div className="grid-pattern absolute inset-0 opacity-40" aria-hidden />
        <div className="container-page relative max-w-2xl text-center">
          <TargetIcon className="mx-auto h-10 w-10 text-accent-300" />
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">{c.closing.title}</h2>
          <p className="mt-3 text-slate-300 sm:text-lg">{c.closing.text}</p>
          <div className="mt-8"><Buttons center dark /></div>
        </div>
      </section>
    </>
  );
}

async function ParentReviews() {
  const parents = (await getApprovedReviews()).filter((r) => r.type === "parent");
  if (parents.length === 0) return null;
  return (
    <section className="section bg-slate-50">
      <div className="container-page">
        <SectionHeading center eyebrow="Reviews" title={c.reviews.title} subtitle={c.reviews.subtitle} />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {parents.slice(0, 6).map((r) => (
            <figure key={r.id} className="card flex flex-col p-6">
              <Stars rating={r.rating} />
              <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-slate-700">&ldquo;{r.comment}&rdquo;</blockquote>
              <figcaption className="mt-4 font-bold text-slate-900">{r.name} <span className="text-xs font-semibold text-slate-500">· Parent</span></figcaption>
            </figure>
          ))}
        </div>
        {parents.length > 6 && (
          <p className="mt-6 text-center"><Link href="/reviews" className="font-bold text-brand-700 hover:underline">Read all reviews →</Link></p>
        )}
      </div>
    </section>
  );
}
