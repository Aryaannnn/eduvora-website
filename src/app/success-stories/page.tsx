import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageHero from "@/components/PageHero";
import { SuccessStoriesGrid } from "@/components/reviews/SuccessStories";
import JsonLd from "@/components/seo/JsonLd";
import { getSuccessStories } from "@/lib/data";
import { breadcrumbLd, pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Success Stories — Students Who Got Their VIT College",
  description: "Real EDUVORA students share the VIT campus and branch they got after VITEEE counselling. Shared with their permission.",
  path: "/success-stories",
});

// Real students only (Admin → Success Stories, with consent). No stories yet → "not found".
export default async function SuccessStoriesPage() {
  const stories = await getSuccessStories();
  if (stories.length === 0) notFound();
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Success Stories", path: "/success-stories" }])} />
      <PageHero eyebrow="Success stories" title="Students who found their VIT college" subtitle="Real EDUVORA students, shared with their permission." />
      <section className="container-page py-12 sm:py-16">
        <SuccessStoriesGrid stories={stories} />
        <p className="mt-10 text-center text-sm text-slate-500">
          Want to read more? See all <Link href="/reviews" className="font-semibold text-brand-700 underline">student &amp; parent reviews</Link>.
        </p>
      </section>
    </>
  );
}
