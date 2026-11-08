import type { Metadata } from "next";
import JsonLd from "@/components/seo/JsonLd";
import { pageMeta, breadcrumbLd } from "@/lib/seo";
import Accordion from "@/components/Accordion";
import Disclaimer from "@/components/Disclaimer";
import PageHero from "@/components/PageHero";
import PredictorGate from "@/components/predictor/PredictorGate";
import Reveal from "@/components/Reveal";
import SectionHeading from "@/components/SectionHeading";

export const metadata: Metadata = pageMeta({ title: "VITEEE Rank Predictor – Marks vs Rank", description: "Free VITEEE rank predictor: enter your marks to see your likely rank range. Get your full VIT campus and branch list with EDUVORA counselling.", path: "/predictor" });

const faqs = [
  { q: "Is the predictor free?", a: "Yes — the rank part is free. Log in or sign up and you can see your predicted VITEEE rank range for any marks. The full college & branch list (with chances, fee categories, filters and PDF download) is included when you book a counselling session." },
  { q: "How is my rank calculated?", a: "We use marks-vs-rank data from the previous year. Your marks are placed between the nearest known points and the rank is calculated smoothly between them. We show a range (± 2 marks) because the real rank can vary a little." },
  { q: "What do High, Moderate and Low chance mean?", a: "High: even your worst-case predicted rank is comfortably inside last year's closing rank. Moderate: you are close to the closing rank — it could go either way. Low: your predicted rank is beyond last year's closing rank." },
  { q: "What are fee categories?", a: "VIT has different fee categories (1 to 5) for the same programme. Better ranks usually get lower-fee categories. Our counsellors explain the current fees in detail." },
  { q: "Is this result guaranteed?", a: "No. It is an estimate based on previous year data. Actual ranks and closing ranks change every year. Use it to plan — then book a counselling call for personal advice." },
];

export default function PredictorPage() {
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Rank Predictor", path: "/predictor" }])} />
      <PageHero eyebrow="Free rank predictor" title="VITEEE Rank & College Predictor" subtitle="Move the slider to your expected marks and see your likely rank range — free for every logged-in student. Your full college & branch list comes with counselling." />
      <section className="container-page py-10 sm:py-14">
        {/* Guest: log in to see rank · Logged in: free rank range · Paid counselling: full college list (checked on the server) */}
        <PredictorGate mode="public" returnTo="/predictor" />
      </section>
      <section className="container-page max-w-3xl pb-16 sm:pb-24">
        <SectionHeading center eyebrow="FAQ" title="How the predictor works" />
        <Reveal className="mt-8"><Accordion items={faqs} /></Reveal>
        <Disclaimer className="mt-8" />
      </section>
    </>
  );
}
