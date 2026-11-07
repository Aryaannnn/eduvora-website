import type { Metadata } from "next";
import ReviewsSection from "@/components/home/ReviewsSection";
import PageHero from "@/components/PageHero";
import Reveal from "@/components/Reveal";
import Link from "next/link";
import { getApprovedReviews, getVideoTestimonials } from "@/lib/data";
import VideoTestimonials from "@/components/reviews/VideoTestimonials";

export const metadata: Metadata = {
  title: "Reviews",
  description: "What students and parents say about our VITEEE counselling and coaching.",
};

export default async function ReviewsPage() {
  const [reviews, videos] = await Promise.all([getApprovedReviews(), getVideoTestimonials()]);
  return (
    <>
      <PageHero eyebrow="Reviews" title="Student & Parent Reviews" subtitle="Honest feedback from the families we've guided through VITEEE and VIT counselling." />
      {/* Video testimonials first (hidden when there are none) */}
      <VideoTestimonials videos={videos} className="!pb-0" />
      {reviews.length > 0 ? (
        <div className={videos.length ? "" : "-mt-10 sm:-mt-14"}><ReviewsSection reviews={reviews} showHeading={videos.length > 0} /></div>
      ) : videos.length > 0 ? null : (
        <section className="container-page py-12 text-center">
          <p className="text-lg font-bold text-slate-900">Reviews from our students will appear here soon.</p>
          <p className="mt-1 text-slate-600">Every review is written by a real student or parent who used EDUVORA.</p>
        </section>
      )}
      <section className="container-page pb-16 sm:pb-24">
        <Reveal className="rounded-3xl bg-slate-50 p-8 text-center ring-1 ring-slate-200">
          <h2 className="text-2xl font-extrabold text-slate-900">Studied or got counselling with us?</h2>
          <p className="mt-2 text-slate-600">We&apos;d love to hear about your experience. Log in to write a review from your dashboard.</p>
          <Link href="/dashboard/review" className="btn-primary mt-6">
            Write a Review
          </Link>
        </Reveal>
      </section>
    </>
  );
}
