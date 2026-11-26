import type { Metadata } from "next";
import Link from "next/link";
import Accordion from "@/components/Accordion";
import OfficialNotice from "@/components/OfficialNotice";
import PageHero from "@/components/PageHero";
import { CalendarIcon, CheckIcon, TargetIcon } from "@/components/Icons";
import JsonLd from "@/components/seo/JsonLd";
import RelatedPages from "@/components/seo/RelatedPages";
import { siteConfig } from "@/config/site";
import { breadcrumbLd, faqLd, pageMeta } from "@/lib/seo";
import { getVitGuide } from "@/lib/vit-guide";
import { hasPlaceholder, PLACEHOLDER, plainText, prettyDate } from "@/lib/vit-guide-shared";

// ✏️ All text on this page is edited in Admin → Settings → "VIT Counselling Guide".
//    [[FILL: …]] placeholders show as "to be confirmed" — never as made-up dates, ranks or fees.
export async function generateMetadata(): Promise<Metadata> {
  const g = await getVitGuide();
  return pageMeta({
    title: `VIT Counselling Process${g.year ? ` ${g.year}` : ""}: Step-by-Step Guide`,
    description: "How the VIT counselling process works after VITEEE: online phases by rank, the official counselling fee, documents needed, choice filling tips and common mistakes.",
    path: "/vit-counselling-guide",
  });
}

/** A line of text: [[FILL: …]] → a "to be confirmed" chip */
function Rich({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(new RegExp(PLACEHOLDER.source, "gi"))) {
    if (m.index! > last) parts.push(text.slice(last, m.index));
    parts.push(
      <span key={m.index} className="mx-0.5 inline-flex rounded-md bg-amber-100 px-1.5 py-0.5 text-[0.9em] font-semibold text-amber-900 ring-1 ring-amber-300" title={`To be updated: ${m[1]}`}>
        to be confirmed — check the official VIT website
      </span>,
    );
    last = m.index! + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

/** Section text: blank line = new paragraph, "- " = bullet point */
function Body({ text }: { text: string }) {
  const blocks = text.split(/\n\s*\n/).map((b) => b.split("\n").filter((l) => l.trim()));
  return (
    <div className="space-y-4">
      {blocks.map((lines, i) => {
        const bullets = lines.every((l) => /^\s*[-•]\s+/.test(l));
        if (bullets) {
          return (
            <ul key={i} className="space-y-2">
              {lines.map((l, j) => (
                <li key={j} className="flex items-start gap-2">
                  <CheckIcon className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />
                  <span><Rich text={l.replace(/^\s*[-•]\s+/, "")} /></span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {/^\s*[-•]\s+/.test(l) ? "• " : null}
                <Rich text={l.replace(/^\s*[-•]\s+/, "")} />
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

export default async function VitCounsellingGuidePage() {
  const g = await getVitGuide();
  const checked = prettyDate(g.checkedOn);
  const first = siteConfig.founder.name.split(" ")[0];
  // Google's FAQ data: only answers that are complete (no placeholders)
  const faqForGoogle = g.faqs.filter((f) => !hasPlaceholder(f.q) && !hasPlaceholder(f.a)).map((f) => ({ q: plainText(f.q), a: plainText(f.a) }));
  return (
    <>
      <JsonLd data={[breadcrumbLd([{ name: "VIT Counselling Guide", path: "/vit-counselling-guide" }]), ...(faqForGoogle.length ? [faqLd(faqForGoogle)] : [])]} />
      <PageHero
        eyebrow="Free guide"
        title={`VIT Counselling Process${g.year ? ` ${g.year}` : ""}: A Step-by-Step Guide`}
        subtitle={plainText(g.intro)}
      />

      <div className="container-page max-w-4xl py-10 sm:py-14">
        <OfficialNotice variant="box" />
        <p className="mt-4 text-sm text-slate-500">
          {checked ? <>Facts last checked on the official VIT website on <strong>{checked}</strong>. </> : null}
          Dates, fees and rank ranges change every year — always confirm them on vit.ac.in / viteee.vit.ac.in.
        </p>

        {/* Contents */}
        <nav aria-label="On this page" className="mt-8 rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">On this page</p>
          <ol className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            {g.sections.map((s, i) => (
              <li key={s.id}><a href={`#${s.id}`} className="font-semibold text-brand-700 hover:underline">{i + 1}. {plainText(s.title)}</a></li>
            ))}
            {g.faqs.length > 0 && <li><a href="#faq" className="font-semibold text-brand-700 hover:underline">{g.sections.length + 1}. Questions</a></li>}
          </ol>
        </nav>

        {/* Sections */}
        <div className="mt-10 space-y-12">
          {g.sections.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-24" aria-labelledby={`${s.id}-h`}>
              <h2 id={`${s.id}-h`} className="text-2xl font-extrabold tracking-tight text-brand-700 sm:text-3xl">
                <span className="mr-2 text-accent-500">{i + 1}.</span><Rich text={s.title} />
              </h2>
              <div className="mt-4 text-[1.02rem] leading-relaxed text-slate-700"><Body text={s.body} /></div>
            </section>
          ))}
        </div>

        {/* Predictor link */}
        <div className="mt-12 flex flex-col items-start gap-3 rounded-2xl bg-brand-50 p-5 ring-1 ring-brand-100 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-sm text-slate-700"><TargetIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" /> Not sure which phase or campus to expect? Check your likely VITEEE rank range first.</p>
          <Link href="/predictor" className="btn-primary shrink-0 !py-2.5">Free Rank Predictor</Link>
        </div>

        {/* FAQ */}
        {g.faqs.length > 0 && (
          <section id="faq" className="mt-14 scroll-mt-24" aria-labelledby="faq-h">
            <h2 id="faq-h" className="text-2xl font-extrabold tracking-tight text-brand-700 sm:text-3xl">Questions about VIT counselling</h2>
            <div className="mt-6"><Accordion items={g.faqs.map((f) => ({ q: plainText(f.q), a: plainText(f.a) }))} /></div>
          </section>
        )}

        {/* Book a counselling call */}
        <section className="mt-14 overflow-hidden rounded-3xl bg-brand-700 p-6 text-white shadow-xl shadow-brand-900/20 sm:p-8" aria-labelledby="book-h">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-accent-300">Personal guidance</p>
          <h2 id="book-h" className="mt-2 text-2xl font-extrabold sm:text-3xl">Book a counselling call with {first} Sir</h2>
          <p className="mt-2 max-w-2xl text-slate-200">A private 30-minute call to plan your campus, branch and fee category choices for your rank — parents are welcome to join.</p>
          <ul className="mt-4 grid gap-2 text-sm text-slate-200 sm:grid-cols-2">
            {["Your rank and realistic options", "Fee category guidance", "Choice filling list, in your order", "What to do after allotment"].map((t) => (
              <li key={t} className="flex items-center gap-2"><CheckIcon className="h-4 w-4 text-accent-300" /> {t}</li>
            ))}
          </ul>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href="/book-a-slot" className="btn-accent !px-6 !py-3.5 text-base"><CalendarIcon className="h-5 w-5" /> Book a counselling call</Link>
            <Link href="/parents" className="btn-outline !py-3.5">Guide for parents</Link>
          </div>
          <p className="mt-4 text-xs text-slate-300">This is EDUVORA&apos;s optional guidance service. It is not part of VIT&apos;s admission process and does not reserve a seat.</p>
        </section>
      </div>
      <RelatedPages current="/vit-counselling-guide" />
    </>
  );
}
