import type { Metadata } from "next";
import { Suspense } from "react";
import PageHero from "@/components/PageHero";
import ExamRunner from "@/components/tests/ExamRunner";

export const metadata: Metadata = {
  title: "Take a Test",
  description: "VITEEE practice test with instant results and explanations.",
  robots: { index: false, follow: true }, // needs a login — the product pages are the ones to find on Google
};

export default function TestPage(props: PageProps<"/tests/[id]">) {
  return (
    <>
      <PageHero eyebrow="Practice test" title="VITEEE Practice Test" subtitle="Read the instructions, then start. Your answers save automatically; your score and explanations appear after you submit." />
      <section className="container-page max-w-3xl py-10 sm:py-14">
        <Suspense fallback={<p className="py-16 text-center text-slate-500">Loading test…</p>}>
          {props.params.then(({ id }) => <ExamRunner testId={id} />)}
        </Suspense>
      </section>
    </>
  );
}
