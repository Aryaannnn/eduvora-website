import type { Metadata } from "next";
import RatingLine from "@/components/reviews/RatingLine";
import JsonLd from "@/components/seo/JsonLd";
import { pageMeta, breadcrumbLd } from "@/lib/seo";
import BookingForm from "@/components/BookingForm";
import PackageCards from "@/components/packages/PackageCards";
import PackageComparison from "@/components/packages/PackageComparison";
import PageHero from "@/components/PageHero";
import { SlotPickerSkeleton } from "@/components/booking/SlotPicker";
import { connection } from "next/server";
import { Suspense } from "react";
import { getSlotBoard } from "@/lib/slot-board";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = pageMeta({ title: "Book One-to-One VITEEE Counselling", description: "Book a 30-minute one-to-one VITEEE counselling voice call with Utkarsh Shrivastava: rank review, campus and branch choice, fee categories and documents.", path: "/book-a-slot" });

export default function BookASlotPage() {
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Book Counselling", path: "/book-a-slot" }])} />
      <PageHero
        eyebrow="Book a slot"
        title="Book Your Counselling Slot"
        subtitle={`A private 30-minute one-to-one voice call with ${siteConfig.founder.name.split(" ")[0]} Sir. He calls you on your phone at the booked time — parents are welcome to join on speaker.`}
      >
        <div className="mt-6 flex flex-wrap gap-3">
          <a href="#book" className="btn-outline !py-2.5">Book a Single Slot</a>
          <a href="#packages" className="btn-outline !py-2.5">See Packages</a>
        </div>
      </PageHero>
      {/* 1. Book a session (slot picker + details) */}
      <section id="book" className="container-page scroll-mt-24 py-10 sm:py-14">
        <h2 className="mb-2 text-2xl font-extrabold text-brand-700">Book a session</h2>
        <p className="mb-3 text-slate-600">Each session is a 30-minute voice call. Have a package? Your session credit is used automatically. Otherwise pay for a single slot. All times are India time (IST).</p>
        <RatingLine className="mb-8 !justify-start" />
        <Suspense fallback={<SlotPickerSkeleton className="max-w-2xl" />}>
          <Booking />
        </Suspense>
      </section>
      {/* 2. Counselling packages, below the booking form */}
      {/* (hidden until supabase/packages.sql is run / any package is active) */}
      <section className="bg-slate-50 py-14 sm:py-20">
        <div className="container-page">
          <PackageCards />
          {/* What's included in each package (only with 2+ packages) */}
          <PackageComparison />
        </div>
      </section>
    </>
  );
}

/** Slots (free + booked) are loaded on the server for every visit; the form refreshes them every minute. */
async function Booking() {
  await connection();
  return <BookingForm initialBoard={await getSlotBoard()} />;
}
