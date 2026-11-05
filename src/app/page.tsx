import Link from "next/link";
import Accordion from "@/components/Accordion";
import CourseCard from "@/components/cards/CourseCard";
import MaterialCard from "@/components/cards/MaterialCard";
import TestCard from "@/components/cards/TestCard";
import EmptyState from "@/components/EmptyState";
import BookCallSection from "@/components/home/BookCallSection";
import ContactSection from "@/components/home/ContactSection";
import FounderSection from "@/components/home/FounderSection";
import HeroSlider from "@/components/home/HeroSlider";
import ResultsSection from "@/components/home/ResultsSection";
import ReviewsSection from "@/components/home/ReviewsSection";
import TrustSection from "@/components/home/TrustSection";
import { ArrowRightIcon } from "@/components/Icons";
import Reveal from "@/components/Reveal";
import SectionHeading from "@/components/SectionHeading";
import { faqs } from "@/data/misc";
import PredictorGate from "@/components/predictor/PredictorGate";
import { getApprovedReviews, getProducts, getUpcomingSlots } from "@/lib/data";

export default async function Home() {
  // All of this comes from Supabase (cached for a few minutes)
  const [materials, courses, mockTests, papers, reviews, slots] = await Promise.all([
    getProducts("study_material"),
    getProducts("crash_course"),
    getProducts("mock_test"),
    getProducts("previous_paper"),
    getApprovedReviews(),
    getUpcomingSlots(6),
  ]);
  // A mix of tests for the home page: up to 4 mock/MCQ + 2 papers
  const homeTests = [...mockTests.slice(0, 4), ...papers.slice(0, 2)];

  return (
    <>
      {/* 1. Hero slideshow */}
      <HeroSlider />

      {/* 2. Founder */}
      <FounderSection />

      {/* 3. Book a call */}
      <BookCallSection slots={slots} />

      {/* Rank & College Predictor */}
      <section className="section" id="predictor">
        <div className="container-page">
          <SectionHeader eyebrow="Rank & college predictor" title="What rank will your marks get you?" subtitle="Your likely VITEEE rank, the VIT campus and branch you can get, and your chances — included with counselling." href="/predictor" linkText="Open full predictor" />
          {/* Locked unless the visitor has paid for counselling (checked on the server) */}
          <Reveal className="mt-10"><PredictorGate mode="public" returnTo="/#predictor" /></Reveal>
        </div>
      </section>

      {/* 4. Study material */}
      <section className="section">
        <div className="container-page">
          <SectionHeader eyebrow="Study material" title="Campus-wise admission kits" subtitle="Everything you need to choose the right VIT campus — rank trends, fees, branches and checklists." href="/study-material" linkText="All study material" />
          {materials.length ? (
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {materials.slice(0, 4).map((m, i) => <Reveal key={m.id} delay={i * 80}><MaterialCard m={m} /></Reveal>)}
            </div>
          ) : <div className="mt-10"><EmptyState what="study material" /></div>}
        </div>
      </section>

      {/* 5. Crash courses */}
      <section className="section bg-slate-50">
        <div className="container-page">
          <SectionHeader eyebrow="Crash courses" title="Revise smart. Score higher." subtitle="Short, focused programmes built only for VITEEE." href="/courses" linkText="All courses" />
          {courses.length ? (
            <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {courses.slice(0, 4).map((c, i) => <Reveal key={c.id} delay={i * 80}><CourseCard course={c} /></Reveal>)}
            </div>
          ) : <div className="mt-10"><EmptyState what="courses" /></div>}
        </div>
      </section>

      {/* 6. Mock tests, MCQs & PYQs */}
      <section className="section">
        <div className="container-page">
          <SectionHeader eyebrow="Practice" title="Mock Tests, MCQs & Previous Year Papers" subtitle="Practise in the real exam pattern. Start with a free test — no sign-up needed." href="/mock-tests" linkText="All tests" />
          {homeTests.length ? (
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {homeTests.map((t, i) => <Reveal key={t.id} delay={(i % 3) * 80}><TestCard product={t} /></Reveal>)}
            </div>
          ) : <div className="mt-10"><EmptyState what="tests" /></div>}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/mock-tests" className="btn-light">Mock Tests</Link>
            <Link href="/mock-tests#mcq" className="btn-light">MCQ Practice</Link>
            <Link href="/previous-year-papers" className="btn-light">Previous Year Papers</Link>
          </div>
        </div>
      </section>

      {/* 7. Results */}
      <ResultsSection />

      {/* 8. Reviews */}
      <ReviewsSection reviews={reviews} />

      {/* 9. Trust / secure payments */}
      <TrustSection />

      {/* 10. FAQ */}
      <section className="section">
        <div className="container-page max-w-3xl">
          <SectionHeading center eyebrow="FAQ" title="VITEEE counselling questions" subtitle="Quick answers to what students and parents ask us most." />
          <Reveal className="mt-10"><Accordion items={faqs} /></Reveal>
        </div>
      </section>

      {/* 11. Contact */}
      <div className="bg-slate-50"><ContactSection /></div>
    </>
  );
}

function SectionHeader(props: { eyebrow: string; title: string; subtitle: string; href: string; linkText: string }) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <SectionHeading eyebrow={props.eyebrow} title={props.title} subtitle={props.subtitle} />
      <Link href={props.href} className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-brand-700 hover:underline">
        {props.linkText} <ArrowRightIcon className="h-4 w-4" />
      </Link>
    </div>
  );
}
