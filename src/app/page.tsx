import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/seo/JsonLd";
import { faqLd, pageMeta } from "@/lib/seo";
import Accordion from "@/components/Accordion";
import CourseCard from "@/components/cards/CourseCard";
import MaterialCard from "@/components/cards/MaterialCard";
import TestCard from "@/components/cards/TestCard";
import EmptyState from "@/components/EmptyState";
import { FreeProductCard, FreeTestCard } from "@/components/free/FreeResourceCard";
import HowItWorks from "@/components/home/HowItWorks";
import TrustStrip from "@/components/home/TrustStrip";
import MobileViewAll, { hideOnPhone } from "@/components/MobileViewAll";
import PackageCards from "@/components/packages/PackageCards";
import CommunityBanner from "@/components/CommunityBanner";
import ContactSection from "@/components/home/ContactSection";
import FounderSection from "@/components/home/FounderSection";
import HeroSlider from "@/components/home/HeroSlider";
import ReviewsSection from "@/components/home/ReviewsSection";
import TrustSection from "@/components/home/TrustSection";
import WhySection from "@/components/home/WhySection";
import { ArrowRightIcon } from "@/components/Icons";
import Reveal from "@/components/Reveal";
import SectionHeading from "@/components/SectionHeading";
import { faqs } from "@/data/misc";
import HomePredictor from "@/components/predictor/HomePredictor";
import { getApprovedReviews, getProducts, getUpcomingSlots, getVideoTestimonials } from "@/lib/data";
import VideoTestimonials from "@/components/reviews/VideoTestimonials";
import { getFreeResources } from "@/lib/free-resources";
import { getNextDates } from "@/lib/important-dates";
import { NextDatesList, OFFICIAL_NOTE } from "@/components/dates/DateBits";

export const metadata: Metadata = pageMeta({
  title: "VITEEE Counselling & Rank Predictor | EDUVORA",
  absolute: true,
  description: "Expert VITEEE counselling and VIT counselling guidance: free VITEEE rank predictor, campus and branch choice, fee categories, crash courses and mock tests.",
  path: "/",
});

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
  ];
  const freeCount = freeItems.length;
  freeItems.splice(6);
  // A mix of tests for the home page: up to 4 mock/MCQ + 2 papers
  const homeTests = [...mockTests.slice(0, 4), ...papers.slice(0, 2)];

  return (
    <>
      {/* Google: the FAQ section below */}
      <JsonLd data={faqLd(faqs)} />

      {/* 1. Hero slideshow (4 slides, one main button each) */}
      <HeroSlider />

      {/* 2. Trust strip — the student number comes from Admin → Settings */}
      <TrustStrip />

      {/* 3. How it works (3 steps) + next open counselling slots */}
      <HowItWorks slots={slots} />

      {/* 4. Counselling packages (hidden when there are none) */}
      <section className="section">
        <div className="container-page"><PackageCards /></div>
      </section>

      {/* 5. Free Rank & College Predictor (+ Fee Calculator) */}
      <section className="section bg-slate-50" id="predictor">
        <div className="container-page">
          <SectionHeader eyebrow="Free rank predictor" title="What rank will your marks get you?" subtitle="See your likely VITEEE rank range for free. The VIT campus and branch you can get, with your chances, comes with counselling." href="/predictor" linkText="Open full predictor" />
          {/* Locked unless the visitor has paid for counselling (checked on the server); its code loads only when scrolled near */}
          <Reveal className="mt-10"><HomePredictor returnTo="/#predictor" /></Reveal>
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

      {/* 6. Founder (+ "Why EDUVORA?" cards — edit or hide in Admin → Settings) */}
      <FounderSection />
      <WhySection />

      {/* 7. Reviews + video testimonials (both hidden when there are none) */}
      {reviews.length > 0 && <ReviewsSection reviews={reviews} mobileShort />}
      <VideoTestimonials videos={videos.slice(0, 6)} className={reviews.length > 0 ? "!pt-0" : ""} mobileShort />

      {/* 8. Study material */}
      <section className="section bg-slate-50">
        <div className="container-page">
          <SectionHeader eyebrow="Study material" title="Campus-wise admission kits" subtitle="Everything you need to choose the right VIT campus — rank trends, fees, branches and checklists." href="/study-material" linkText="All study material" />
          {materials.length ? (
            <>
              <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {materials.slice(0, 4).map((m, i) => <Reveal key={m.id} delay={i * 80} className={hideOnPhone(i)}><MaterialCard m={m} /></Reveal>)}
              </div>
              <MobileViewAll total={materials.length} href="/study-material" label="View all study material" />
            </>
          ) : <div className="mt-10"><EmptyState what="study material" /></div>}
        </div>
      </section>

      {/* 9. Crash courses */}
      <section className="section">
        <div className="container-page">
          <SectionHeader eyebrow="Crash courses" title="Revise smart. Score higher." subtitle="Short, focused programmes built only for VITEEE." href="/courses" linkText="All courses" />
          {courses.length ? (
            <>
              <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                {courses.slice(0, 4).map((c, i) => <Reveal key={c.id} delay={i * 80} className={hideOnPhone(i, "md")}><CourseCard course={c} /></Reveal>)}
              </div>
              <MobileViewAll total={courses.length} href="/courses" label="View all courses" bp="md" />
            </>
          ) : <div className="mt-10"><EmptyState what="courses" /></div>}
        </div>
      </section>

      {/* 10. Mock tests, MCQs & previous year papers */}
      <section className="section bg-slate-50">
        <div className="container-page">
          <SectionHeader eyebrow="Practice" title="Mock Tests, MCQs & Previous Year Papers" subtitle="Practise in the real exam pattern. Start with a free test — just sign up free." href="/mock-tests" linkText="All tests" />
          {homeTests.length ? (
            <>
              <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {homeTests.map((t, i) => <Reveal key={t.id} delay={(i % 3) * 80} className={hideOnPhone(i)}><TestCard product={t} /></Reveal>)}
              </div>
              <MobileViewAll total={mockTests.length + papers.length} href="/mock-tests" label="View all tests & papers" />
            </>
          ) : <div className="mt-10"><EmptyState what="tests" /></div>}
          <div className="mt-8 hidden flex-wrap justify-center gap-3 sm:flex">
            <Link href="/mock-tests" className="btn-light">Mock Tests</Link>
            <Link href="/mock-tests#mcq" className="btn-light">MCQ Practice</Link>
            <Link href="/previous-year-papers" className="btn-light">Previous Year Papers</Link>
          </div>
        </div>
      </section>

      {/* Free resources (hidden until at least one item is marked Free in the admin) */}
      {freeItems.length > 0 && (
        <section className="section bg-gradient-to-b from-emerald-50/70 to-white" id="free-resources">
          <div className="container-page">
            <SectionHeader eyebrow="Free resources" title="Start free — mock tests, papers & PDF guides" subtitle="Sign up free and unlock them instantly. Everything is saved in your dashboard." href="/free-resources" linkText="All free resources" />
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {freeItems.map((it, i) => <Reveal key={it.key} delay={(i % 3) * 80} className={hideOnPhone(i)}>{it.el}</Reveal>)}
            </div>
            <MobileViewAll total={freeCount} href="/free-resources" label="View all free resources" />
          </div>
        </section>
      )}

      {/* 11. Next 3 important dates (hidden when there are none) */}
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

      {/* Secure payments (Razorpay) */}
      <TrustSection />

      {/* 12. FAQ */}
      <section className="section">
        <div className="container-page max-w-3xl">
          <SectionHeading center eyebrow="FAQ" title="VITEEE counselling questions" subtitle="Quick answers to what students and parents ask us most." />
          <Reveal className="mt-10"><Accordion items={faqs} /></Reveal>
        </div>
      </section>

      {/* 13. Contact */}
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
