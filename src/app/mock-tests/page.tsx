import type { Metadata } from "next";
import Link from "next/link";
import TestCard from "@/components/cards/TestCard";
import CtaBanner from "@/components/CtaBanner";
import EmptyState from "@/components/EmptyState";
import { ArrowRightIcon, ClipboardIcon } from "@/components/Icons";
import PageHero from "@/components/PageHero";
import Reveal from "@/components/Reveal";
import SectionHeading from "@/components/SectionHeading";
import { getProducts } from "@/lib/data";

export const metadata: Metadata = {
  title: "Mock Tests & MCQ Practice",
  description: "VITEEE full-length mock tests and chapter-wise MCQ practice with detailed solutions.",
};

export default async function MockTestsPage() {
  const all = await getProducts("mock_test");
  const mocks = all.filter((p) => p.details.test_type !== "mcq");
  const mcqs = all.filter((p) => p.details.test_type === "mcq");
  const freeTest = all.flatMap((p) => p.tests ?? []).find((t) => t.is_free);

  return (
    <>
      <PageHero eyebrow="Practice" title="Mock Tests & MCQ Practice" subtitle="Practise in the latest VITEEE pattern, find your weak topics and improve your speed.">
        <div className="mt-6 flex flex-wrap gap-3">
          <a href="#mock" className="btn-outline !py-2.5">Mock Tests</a>
          <a href="#mcq" className="btn-outline !py-2.5">MCQ Practice</a>
          <Link href="/previous-year-papers" className="btn-outline !py-2.5">Previous Year Papers</Link>
        </div>
      </PageHero>

      {freeTest && (
        <section className="container-page pt-12">
          <Reveal className="flex flex-col items-start gap-4 rounded-3xl bg-gradient-to-r from-emerald-500 to-teal-600 p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div className="flex items-center gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/20"><ClipboardIcon className="h-7 w-7" /></span>
              <div>
                <p className="text-xl font-extrabold">Try a free sample test now</p>
                <p className="text-sm text-emerald-50">{freeTest.duration_minutes} minutes · {freeTest.total_marks} marks · instant score with explanations</p>
              </div>
            </div>
            <Link href={`/tests/${freeTest.id}`} className="btn-accent shrink-0">Start Free Test <ArrowRightIcon className="h-4 w-4" /></Link>
          </Reveal>
        </section>
      )}

      <section id="mock" className="container-page py-14 sm:py-16">
        <SectionHeading eyebrow="Mock tests" title="Full-length mock tests" subtitle="Same pattern, same timing, same pressure — so exam day feels familiar." />
        {mocks.length ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {mocks.map((t, i) => <Reveal key={t.id} delay={i * 80}><TestCard product={t} /></Reveal>)}
          </div>
        ) : <div className="mt-8"><EmptyState what="mock tests" /></div>}
      </section>

      <section id="mcq" className="bg-slate-50 py-14 sm:py-16">
        <div className="container-page">
          <SectionHeading eyebrow="MCQ practice" title="Chapter-wise MCQ tests" subtitle="Practise one chapter at a time, from easy to exam level." />
          {mcqs.length ? (
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {mcqs.map((t, i) => <Reveal key={t.id} delay={i * 80}><TestCard product={t} /></Reveal>)}
            </div>
          ) : <div className="mt-8"><EmptyState what="MCQ tests" /></div>}
        </div>
      </section>

      <div className="pt-16"><CtaBanner title="Want a study plan with your tests?" text="Our counsellors can build a week-by-week plan around your mock test results." /></div>
    </>
  );
}
