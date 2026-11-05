import type { Metadata } from "next";
import BookingForm from "@/components/BookingForm";
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
      />
      <section className="container-page py-10 sm:py-14">
        <BookingForm />
      </section>
    </>
  );
}
