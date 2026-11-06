import type { Metadata } from "next";
import Link from "next/link";
import CtaBanner from "@/components/CtaBanner";
import { FreeProductCard, FreeTestCard } from "@/components/free/FreeResourceCard";
import { CheckIcon } from "@/components/Icons";
import PageHero from "@/components/PageHero";
import Reveal from "@/components/Reveal";
import SectionHeading from "@/components/SectionHeading";
import { getFreeResources } from "@/lib/free-resources";

export const metadata: Metadata = {
  title: "Free VITEEE Resources",
  description: "Free VITEEE mock tests, previous year papers and PDF guides. Sign up free to unlock them instantly.",
};

// ✏️ Which items appear here: every product you mark "Free" in Admin → Products,
//    plus every test marked "Free" in Admin → Tests.
export default async function FreeResourcesPage() {
  const { products, tests } = await getFreeResources();
  const papers = products.filter((p) => p.category === "previous_paper");
  const guides = products.filter((p) => p.category === "study_material" || p.category === "crash_course");
  const testPacks = products.filter((p) => p.category === "mock_test");
  const empty = products.length === 0 && tests.length === 0;

  return (
    <>
      <PageHero eyebrow="100% free" title="Free VITEEE Resources" subtitle="Free mock tests, previous year papers and PDF guides. Sign up free and they unlock instantly in your dashboard.">
        <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-slate-200">
          {["No payment needed", "Unlocks instantly", "Saved in My Courses & Material"].map((t) => (
            <li key={t} className="inline-flex items-center gap-1.5"><CheckIcon className="h-4 w-4 text-accent-400" /> {t}</li>
          ))}
        </ul>
      </PageHero>

      {empty ? (
        <section className="container-page py-16 text-center">
          <p className="text-lg font-bold text-slate-900">New free resources are coming soon.</p>
          <p className="mt-1 text-slate-600">Meanwhile, try the free rank predictor.</p>
          <Link href="/predictor" className="btn-primary mt-5">Free Rank Predictor</Link>
        </section>
      ) : (
        <>
          <Group id="tests" eyebrow="Practice" title="Free mock tests" items={[...testPacks.map((p) => ({ key: p.id, el: <FreeProductCard product={p} /> })), ...tests.map((t) => ({ key: t.id, el: <FreeTestCard test={t} /> }))]} />
          <Group id="papers" eyebrow="Past papers" title="Free previous year papers" items={papers.map((p) => ({ key: p.id, el: <FreeProductCard product={p} /> }))} grey />
          <Group id="guides" eyebrow="PDF guides" title="Free PDF guides" items={guides.map((p) => ({ key: p.id, el: <FreeProductCard product={p} /> }))} />
        </>
      )}

      <div className="pt-6"><CtaBanner title="Want a personal plan for your rank?" text="Book a one-to-one counselling session for campus, branch and fee category guidance." /></div>
    </>
  );
}

function Group({ id, eyebrow, title, items, grey = false }: { id: string; eyebrow: string; title: string; items: { key: string; el: React.ReactNode }[]; grey?: boolean }) {
  if (items.length === 0) return null;
  return (
    <section id={id} className={`scroll-mt-24 py-14 sm:py-16 ${grey ? "bg-slate-50" : ""}`}>
      <div className="container-page">
        <SectionHeading eyebrow={eyebrow} title={title} />
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it, i) => <Reveal key={it.key} delay={(i % 3) * 80}>{it.el}</Reveal>)}
        </div>
      </div>
    </section>
  );
}
