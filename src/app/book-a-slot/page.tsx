import type { Metadata } from "next";
import BookingForm from "@/components/BookingForm";
import PackageCards from "@/components/packages/PackageCards";
import PageHero from "@/components/PageHero";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Book a Counselling Slot",
  description: `Book a one-to-one VITEEE counselling call with ${siteConfig.founder.name}.`,
};

export default function BookASlotPage() {
  return (
    <>
      <PageHero
        eyebrow="Book a slot"
        title="Book Your Counselling Slot"
        subtitle={`A private one-to-one call with ${siteConfig.founder.name} or our senior counsellors. Parents are welcome to join.`}
      >
        <div className="mt-6 flex flex-wrap gap-3">
          <a href="#packages" className="btn-outline !py-2.5">See Packages</a>
          <a href="#book" className="btn-outline !py-2.5">Book a Single Slot</a>
        </div>
      </PageHero>
      {/* Counselling packages (hidden until supabase/packages.sql is run / any package is active) */}
      <section className="bg-slate-50 py-14 sm:py-20">
        <div className="container-page">
          <PackageCards />
        </div>
      </section>
      <section id="book" className="container-page scroll-mt-24 py-10 sm:py-14">
        <h2 className="mb-2 text-2xl font-extrabold text-brand-700">Book a session</h2>
        <p className="mb-8 text-slate-600">Have a package? Your session credit is used automatically. Otherwise pay for a single slot.</p>
        <BookingForm />
      </section>
    </>
  );
}
