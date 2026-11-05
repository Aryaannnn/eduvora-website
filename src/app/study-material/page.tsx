import type { Metadata } from "next";
import Accordion from "@/components/Accordion";
import MaterialCard from "@/components/cards/MaterialCard";
import CtaBanner from "@/components/CtaBanner";
import { FileIcon, MailIcon, ZapIcon } from "@/components/Icons";
import PageHero from "@/components/PageHero";
import Reveal from "@/components/Reveal";
import SectionHeading from "@/components/SectionHeading";
import EmptyState from "@/components/EmptyState";
import { getProducts } from "@/lib/data";

export const metadata: Metadata = {
  title: "Study Material",
  description: "Campus-wise VIT admission kits for VIT Vellore, VIT Chennai, VIT-AP and VIT Bhopal.",
};

const perks = [
  { icon: ZapIcon, title: "Instant access", text: "PDF kits are sent right after payment." },
  { icon: FileIcon, title: "Updated every year", text: "Latest rank trends, fees and programme lists." },
  { icon: MailIcon, title: "Delivered to you", text: "Printed kits are shipped to your address." },
];

const materialFaqs = [
  { q: "How will I receive the material?", a: "After payment, PDF material is unlocked in your Dashboard (My Courses & Material), where you can download it anytime. Printed kits are shipped within 3–5 working days." },
  { q: "Is the material useful before results?", a: "Yes — understanding branches, fees and campuses early helps you set a target rank and plan better." },
  { q: "Can I buy kits for more than one campus?", a: "Yes. Many students compare two or three campuses. Contact us for a combo discount." },
];

export default async function StudyMaterialPage() {
  const materials = await getProducts("study_material");
  return (
    <>
      <PageHero eyebrow="Study material" title="Campus-wise Admission Kits" subtitle="Clear, updated guides for each VIT campus — so you can make smart choices during counselling." />

      <section className="container-page py-14 sm:py-20">
        {materials.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {materials.map((m, i) => (
              <Reveal key={m.id} delay={i * 80}><MaterialCard m={m} /></Reveal>
            ))}
          </div>
        ) : <EmptyState what="study material" />}

        <div className="mt-14 grid gap-4 sm:grid-cols-3">
          {perks.map((p) => (
            <Reveal key={p.title} className="flex items-start gap-4 rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-600 text-white"><p.icon className="h-5 w-5" /></span>
              <span>
                <span className="block font-bold text-slate-900">{p.title}</span>
                <span className="block text-sm text-slate-600">{p.text}</span>
              </span>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="container-page max-w-3xl pb-16">
        <SectionHeading center eyebrow="FAQ" title="About our study material" />
        <Reveal className="mt-8"><Accordion items={materialFaqs} /></Reveal>
      </section>

      <CtaBanner />
    </>
  );
}
