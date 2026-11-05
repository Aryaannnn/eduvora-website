import type { Metadata } from "next";
import { Suspense } from "react";
import PageHero from "@/components/PageHero";
import TestRunner from "@/components/TestRunner";

export const metadata: Metadata = {
  title: "Take a Test",
  description: "VITEEE practice test with instant results and explanations.",
};

export default function TestPage(props: PageProps<"/tests/[id]">) {
  return (
    <>
      <PageHero eyebrow="Practice test" title="VITEEE Practice Test" subtitle="Choose one answer for each question. Your score and explanations appear after you submit." />
      <section className="container-page max-w-2xl py-10 sm:py-14">
        <Suspense fallback={<p className="py-16 text-center text-slate-500">Loading test…</p>}>
          {props.params.then(({ id }) => <TestRunner testId={id} />)}
        </Suspense>
      </section>
    </>
  );
}
