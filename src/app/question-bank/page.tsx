import type { Metadata } from "next";
import BuyButton from "@/components/BuyButton";
import CtaBanner from "@/components/CtaBanner";
import EmptyState from "@/components/EmptyState";
import FreeBadge from "@/components/FreeBadge";
import { CheckIcon, ClipboardIcon } from "@/components/Icons";
import PageHero from "@/components/PageHero";
import Reveal from "@/components/Reveal";
import JsonLd from "@/components/seo/JsonLd";
import { getQuestionBank } from "@/lib/data";
import { discountPercent, formatPrice } from "@/lib/format";
import { subjectLabel } from "@/lib/product-files";
import { breadcrumbLd, pageMeta } from "@/lib/seo";
import type { Product } from "@/lib/types";

export const metadata: Metadata = pageMeta({
  title: "VITEEE Question Bank — Physics, Chemistry & Maths",
  description: "Chapter-wise VITEEE practice questions for Physics, Chemistry and Mathematics as PDFs — buy one subject or the PCM bundle.",
  path: "/question-bank",
});

const COLOR: Record<string, string> = {
  physics: "from-blue-600 to-sky-500",
  chemistry: "from-emerald-600 to-teal-500",
  mathematics: "from-violet-600 to-fuchsia-500",
  pcm: "from-brand-700 to-brand-500",
};

const points = [
  "Chapter-wise questions in the VITEEE pattern",
  "Open in your browser or download the PDF",
  "Your personal copy, watermarked with your name",
  "Instant access in your dashboard after payment",
];

export default async function QuestionBankPage() {
  const all = await getQuestionBank();
  const order = ["physics", "chemistry", "mathematics", "pcm"];
  const items = [...all].sort((a, b) => order.indexOf(a.subject ?? "") - order.indexOf(b.subject ?? ""));
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Question Bank", path: "/question-bank" }])} />
      <PageHero eyebrow="Question Bank" title="VITEEE Question Bank (PCM)" subtitle="Practise chapter-wise Physics, Chemistry and Mathematics questions. Buy one subject, or all three together." />

      <section className="container-page py-14 sm:py-20">
        {items.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((p, i) => (
              <Reveal key={p.id} delay={i * 80}>
                <QBCard p={p} />
              </Reveal>
            ))}
          </div>
        ) : (
          <EmptyState what="question banks" />
        )}

        <Reveal className="mt-14 rounded-3xl bg-slate-50 p-6 ring-1 ring-slate-200 sm:p-10">
          <h2 className="text-2xl font-extrabold text-slate-900">What you get</h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {points.map((b) => (
              <li key={b} className="flex items-center gap-3 font-medium text-slate-700"><CheckIcon className="h-5 w-5 text-green-600" />{b}</li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-slate-600">Some crash courses include the full Question Bank — check the course page.</p>
        </Reveal>
      </section>

      <CtaBanner />
    </>
  );
}

function QBCard({ p }: { p: Product }) {
  const free = p.is_free || p.price === 0;
  const off = discountPercent(p.price, p.original_price);
  const bundle = p.subject === "pcm";
  return (
    <article className={`card card-hover flex h-full flex-col overflow-hidden ${bundle ? "ring-2 ring-accent-400" : ""}`}>
      <div className={`relative bg-gradient-to-br ${COLOR[p.subject ?? ""] ?? COLOR.pcm} p-5 text-white`}>
        <div className="flex items-start justify-between">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/20"><ClipboardIcon className="h-5 w-5" /></span>
          <span className="flex gap-1.5">
            {free && <FreeBadge />}
            {bundle && <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-900">Best value</span>}
          </span>
        </div>
        <p className="mt-4 text-xl font-extrabold">{bundle ? "Physics + Chemistry + Maths" : subjectLabel(p.subject)}</p>
        <p className="text-xs font-medium text-white/80">PDF (watermarked)</p>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-bold text-slate-900">{p.title}</h3>
        {p.description && <p className="mt-1.5 text-sm text-slate-600">{p.description}</p>}
        <div className="mt-auto pt-5">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">{free ? "Free" : formatPrice(p.price)}</span>
            {!free && p.original_price && <span className="text-sm text-slate-500 line-through">{formatPrice(p.original_price)}</span>}
            {!free && off > 0 && <span className="text-xs font-bold text-green-600">{off}% off</span>}
          </div>
          <div className="mt-4">
            <BuyButton
              productId={p.id}
              label={free ? "Get it Free" : "Buy Now"}
              className={free ? "btn-accent w-full" : "btn-primary w-full"}
              trust={!free}
              free={free}
              ownedHref="/dashboard/question-bank"
              ownedLabel="Open Question Bank"
            />
          </div>
        </div>
      </div>
    </article>
  );
}
