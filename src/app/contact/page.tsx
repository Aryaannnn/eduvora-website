import type { Metadata } from "next";
import ContactSection from "@/components/home/ContactSection";
import PageHero from "@/components/PageHero";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Contact Us",
  description: `Contact ${siteConfig.businessName} for VITEEE counselling, courses and study material.`,
};

export default function ContactPage() {
  return (
    <>
      <PageHero eyebrow="Contact" title="Talk to us" subtitle={siteConfig.contactNote} />
      <div className="-mt-6 sm:-mt-10"><ContactSection showHeading={false} /></div>
    </>
  );
}
