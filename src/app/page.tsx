import Link from "next/link";
import Accordion from "@/components/Accordion";
import CourseCard from "@/components/cards/CourseCard";
import MaterialCard from "@/components/cards/MaterialCard";
import TestCard from "@/components/cards/TestCard";
import EmptyState from "@/components/EmptyState";
import { FreeProductCard, FreeTestCard } from "@/components/free/FreeResourceCard";
import BookCallSection from "@/components/home/BookCallSection";
import PackageCards from "@/components/packages/PackageCards";
import CommunityBanner from "@/components/CommunityBanner";
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
import { getApprovedReviews, getProducts, getUpcomingSlots, getVideoTestimonials } from "@/lib/data";
import VideoTestimonials from "@/components/reviews/VideoTestimonials";
import { getFreeResources } from "@/lib/free-resources";
import { getNextDates } from "@/lib/important-dates";
import { NextDatesList, OFFICIAL_NOTE } from "@/components/dates/DateBits";

export default async function Home() {
  // All of this comes from Supabase (cached for a few minutes)
  const [materials, courses, mockTests, papers, reviews, slots, free, nextDates, videos] = await Promise.all([
    getProducts("study_material"),
    getProducts("crash_course"),
    getProducts("mock_test"),
    getProducts("previous_paper"),
    getApprovedReviews(),
    getUpcomingSlots(6),
    getFreeResources(),
    getNextDates(3),
    getVideoTestimonials(),
  ]);
  // Up to 6 free items for the home page (tests first, then papers and guides)
  const freeItems = [
    ...free.tests.map((t) => ({ key: t.id, el: <FreeTestCard test={t} /> })),
    ...free.products.map((p) => ({ key: p.id, el: <FreeProductCard product={p} /> })),
  ].slice(0, 6);
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

      {/* Next 3 important dates (hidden when there are none) */}
      {nextDates.length > 0 && (
        <section className="section" id="important-dates">
          <div className="container-page">
            <SectionHeader eyebrow="Important dates" title="Coming up next" subtitle={`Applications, exam, results and counselling deadlines. ${OFFICIAL_NOTE}`} href="/important-dates" linkText="All dates & updates" />
            <Reveal className="mx-auto mt-10 max-w-3xl"><NextDatesList dates={nextDates} /></Reveal>
          </div>
        </section>
      )}

      {/* WhatsApp community (hidden until a link is set in Admin → Settings) */}
      <div className="pb-4"><CommunityBanner from="home" /></div>

      {/* Counselling packages (hidden when there are none) */}
      <section className="section bg-slate-50">
        <div className="container-page"><PackageCards /></div>
      </section>

      {/* Free resources (hidden until at least one item is marked Free in the admin) */}
      {freeItems.length > 0 && (
        <section className="section bg-gradient-to-b from-emerald-50/70 to-white" id="free-resources">
          <div className="container-page">
            <SectionHeader eyebrow="Free resources" title="Start free — mock tests, papers & PDF guides" subtitle="Sign up free and unlock them instantly. Everything is saved in your dashboard." href="/free-resources" linkText="All free resources" />
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {freeItems.map((it, i) => <Reveal key={it.key} delay={(i % 3) * 80}>{it.el}</Reveal>)}
            </div>
          </div>
        </section>
      )}

      {/* Rank & College Predictor */}
      <section className="section" id="predictor">
        <div className="container-page">
          <SectionHeader eyebrow="Rank & college predictor" title="What rank will your marks get you?" subtitle="See your likely VITEEE rank range for free. The VIT campus and branch you can get, with your chances, comes with counselling." href="/predictor" linkText="Open full predictor" />
          {/* Locked unless the visitor has paid for counselling (checked on the server) */}
          <Reveal className="mt-10"><PredictorGate mode="public" returnTo="/#predictor" /></Reveal>
          {/* Fee Calculator & Campus Comparison */}
          <Reveal className="mt-6">
            <Link href="/fee-calculator" className="card card-hover flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <span className="flex items-center gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent-400 text-2xl" aria-hidden>💰</span>
                <span>
                  <span className="block text-lg font-extrabold text-slate-900">Fee Calculator &amp; Campus Comparison</span>
                  <span className="block text-sm text-slate-600">Estimate your fee category and 4-year tuition from your rank, and compare VIT campuses side by side.</span>
                </span>
              </span>
              <span className="btn-primary shrink-0">Calculate fees <ArrowRightIcon className="h-4 w-4" /></span>
            </Link>
          </Reveal>
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
          <SectionHeader eyebrow="Practice" title="Mock Tests, MCQs & Previous Year Papers" subtitle="Practise in the real exam pattern. Start with a free test — just sign up free." href="/mock-tests" linkText="All tests" />
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
      {/* Hidden automatically until at least one review is approved */}
      {reviews.length > 0 && <ReviewsSection reviews={reviews} />}
      {/* Video testimonials (hidden when there are none) */}
      <VideoTestimonials videos={videos.slice(0, 6)} className={reviews.length > 0 ? "!pt-0" : ""} />

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
