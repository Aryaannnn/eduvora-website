import type { Metadata } from "next";
import JsonLd from "@/components/seo/JsonLd";
import { pageMeta, breadcrumbLd } from "@/lib/seo";
import ContactSection from "@/components/home/ContactSection";
import PageHero from "@/components/PageHero";
import { getContactMode } from "@/lib/contact-mode";

export const metadata: Metadata = pageMeta({ title: "Contact Us – VITEEE Counselling Help", description: "Contact EDUVORA for VITEEE counselling, VIT counselling guidance, courses and study material — send us an enquiry or email us anytime.", path: "/contact" });

export default async function ContactPage() {
  const cm = await getContactMode();
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Contact", path: "/contact" }])} />
      <PageHero eyebrow="Contact" title="Talk to us" subtitle={cm.mode === "open" ? cm.openNote : `Send us a free enquiry or email us — ${cm.privateNote.charAt(0).toLowerCase()}${cm.privateNote.slice(1)}`} />
      <div className="-mt-6 sm:-mt-10"><ContactSection showHeading={false} /></div>
    </>
  );
}
