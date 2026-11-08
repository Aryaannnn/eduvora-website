import type { Metadata } from "next";
import JsonLd from "@/components/seo/JsonLd";
import { pageMeta, breadcrumbLd } from "@/lib/seo";
import ContactSection from "@/components/home/ContactSection";
import PageHero from "@/components/PageHero";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = pageMeta({ title: "Contact Us – VITEEE Counselling Help", description: "Contact EDUVORA for VITEEE counselling, VIT counselling guidance, courses and study material — chat on WhatsApp or email us anytime.", path: "/contact" });

export default function ContactPage() {
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Contact", path: "/contact" }])} />
      <PageHero eyebrow="Contact" title="Talk to us" subtitle={siteConfig.contactNote} />
      <div className="-mt-6 sm:-mt-10"><ContactSection showHeading={false} /></div>
    </>
  );
}
