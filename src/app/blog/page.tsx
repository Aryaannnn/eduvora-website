import type { Metadata } from "next";
import { Suspense } from "react";
import BlogBrowser from "@/components/blog/BlogBrowser";
import PageHero from "@/components/PageHero";
import { siteConfig } from "@/config/site";
import { getPublishedPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "VITEEE Blog — Preparation, Counselling & VIT Colleges",
  description: `VITEEE preparation tips, VIT counselling guidance, campus and branch guides and the latest updates from ${siteConfig.founder.name}.`,
  alternates: { canonical: "/blog" },
  openGraph: { type: "website", title: `${siteConfig.businessName} Blog`, description: "VITEEE preparation, counselling and VIT college guides." },
};

// ✏️ Posts are written in Admin → Blog.
export default async function BlogPage() {
  const posts = await getPublishedPosts();
  return (
    <>
      <PageHero eyebrow="Blog" title="VITEEE Guides & Updates" subtitle={`Preparation tips, counselling guidance and VIT campus guides — written by ${siteConfig.founder.name}.`} />
      <section className="container-page py-10 sm:py-14">
        <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-slate-100" />}>
          <BlogBrowser posts={posts} />
        </Suspense>
      </section>
    </>
  );
}
