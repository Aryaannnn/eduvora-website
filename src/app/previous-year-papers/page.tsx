import type { Metadata } from "next";
import TestCard from "@/components/cards/TestCard";
import CtaBanner from "@/components/CtaBanner";
import { CheckIcon } from "@/components/Icons";
import PageHero from "@/components/PageHero";
import Reveal from "@/components/Reveal";
import EmptyState from "@/components/EmptyState";
import { getProducts } from "@/lib/data";

export const metadata: Metadata = {
  title: "Previous Year Papers",
  description: "Memory-based VITEEE previous year papers with step-by-step solutions.",
};

const benefits = [
  "Understand the real difficulty level",
  "Spot the most repeated topics",
  "Practise time management",
  "Step-by-step solutions for every question",
];

export default async function PreviousYearPapersPage() {
  const papers = await getProducts("previous_paper");
  return (
    <>
      <PageHero eyebrow="Previous year papers" title="VITEEE Previous Year Papers" subtitle="Memory-based papers from recent years with detailed solutions and topic-wise analysis." />

      <section className="container-page py-14 sm:py-20">
        <Reveal className="mb-10 rounded-2xl bg-amber-50 p-5 text-sm text-amber-900 ring-1 ring-amber-200">
          <strong>Note:</strong> VIT does not officially publish VITEEE question papers. Our papers are carefully
          rebuilt from student memory and expert analysis, so a few questions may differ slightly from the original.
        </Reveal>

        {papers.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {papers.map((t, i) => <Reveal key={t.id} delay={i * 80}><TestCard product={t} /></Reveal>)}
          </div>
        ) : <EmptyState what="papers" />}

        <Reveal className="mt-14 rounded-3xl bg-slate-50 p-6 ring-1 ring-slate-200 sm:p-10">
          <h2 className="text-2xl font-extrabold text-slate-900">Why solve previous year papers?</h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {benefits.map((b) => (
              <li key={b} className="flex items-center gap-3 font-medium text-slate-700"><CheckIcon className="h-5 w-5 text-green-600" />{b}</li>
            ))}
          </ul>
        </Reveal>
      </section>

      <CtaBanner />
    </>
  );
}
