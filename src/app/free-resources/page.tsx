import type { Metadata } from "next";
import JsonLd from "@/components/seo/JsonLd";
import { pageMeta, breadcrumbLd } from "@/lib/seo";
import Link from "next/link";
import CtaBanner from "@/components/CtaBanner";
import { FreeProductCard, FreeTestCard } from "@/components/free/FreeResourceCard";
import { CheckIcon } from "@/components/Icons";
import PageHero from "@/components/PageHero";
import Reveal from "@/components/Reveal";
import SectionHeading from "@/components/SectionHeading";
import { getFreeResources } from "@/lib/free-resources";
import RelatedPages from "@/components/seo/RelatedPages";

export const metadata: Metadata = pageMeta({ title: "Free VITEEE Mock Tests, Papers & Guides", description: "Free VITEEE resources: mock tests, previous year papers and PDF guides. Sign up free to unlock them instantly and track your scores.", path: "/free-resources" });

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
      <JsonLd data={breadcrumbLd([{ name: "Free Resources", path: "/free-resources" }])} />
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

      {/* What these are and how to get them — useful text for students and for Google (no login needed to read it) */}
      <section className="container-page py-14 sm:py-16" aria-labelledby="how-free">
        <div className="mx-auto max-w-3xl">
          <h2 id="how-free" className="text-2xl font-extrabold text-brand-700 sm:text-3xl">How the free VITEEE resources work</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="font-bold text-slate-900">Free mock tests &amp; MCQ practice</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">Practise VITEEE-style questions online. Each test shows its length and marks; you get your score straight after you submit, so you know which subjects to revise next.</p>
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Free previous year papers</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">Memory-based VITEEE papers help you get used to the question style and the time pressure of the real exam. See all papers on the <Link href="/previous-year-papers" className="font-semibold text-brand-700 underline">previous year papers</Link> page.</p>
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Free PDF guides</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">Short guides for VITEEE preparation and VIT admissions. Each PDF is your personal copy, watermarked with your name.</p>
            </div>
            <div>
              <h3 className="font-bold text-slate-900">How to unlock them</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">Create a free account (phone number or Google). Free items unlock instantly and stay in Dashboard → My Courses &amp; Material — no payment needed.</p>
            </div>
          </div>
          <p className="mt-8 text-sm text-slate-600">
            Next steps: check your likely rank with the free <Link href="/predictor" className="font-semibold text-brand-700 underline">VITEEE rank predictor</Link>, revise with a{" "}
            <Link href="/courses" className="font-semibold text-brand-700 underline">VITEEE crash course</Link>, or{" "}
            <Link href="/book-a-slot" className="font-semibold text-brand-700 underline">book VITEEE counselling</Link> for your campus and branch plan.
          </p>
        </div>
      </section>

      <div className="pt-6"><CtaBanner title="Want a personal plan for your rank?" text="Book a one-to-one counselling session for campus, branch and fee category guidance." /></div>
      <RelatedPages current="/free-resources" />
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
