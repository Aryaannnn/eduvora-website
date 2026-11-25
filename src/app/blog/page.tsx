import type { Metadata } from "next";
import JsonLd from "@/components/seo/JsonLd";
import { breadcrumbLd, pageMeta } from "@/lib/seo";
import BlogBrowser from "@/components/blog/BlogBrowser";
import PageHero from "@/components/PageHero";
import ComingSoon, { comingSoonMeta } from "@/components/ComingSoon";
import { siteConfig } from "@/config/site";
import { getPublishedPosts } from "@/lib/blog";
import RelatedPages from "@/components/seo/RelatedPages";

export const metadata: Metadata = !siteConfig.showBlog ? comingSoonMeta("Blog") : pageMeta({
  title: "VITEEE Blog — Preparation & VIT Counselling Guides",
  description: `VITEEE preparation tips, VIT counselling guidance, campus and branch guides and the latest updates from ${siteConfig.founder.name}.`,
  path: "/blog",
});

// ✏️ Posts are written in Admin → Blog.
export default async function BlogPage() {
  if (!siteConfig.showBlog) return <ComingSoon title="VITEEE Blog" text="Preparation tips and counselling guides are coming soon. Meanwhile, try the free Rank Predictor or book a counselling call." />;
  const posts = await getPublishedPosts();
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Blog", path: "/blog" }])} />
      <PageHero eyebrow="Blog" title="VITEEE Guides & Updates" subtitle={`Preparation tips, counselling guidance and VIT campus guides — written by ${siteConfig.founder.name}.`} />
      <section className="container-page py-10 sm:py-14">
        <h2 className="sr-only">All articles</h2>
        <BlogBrowser posts={posts} />
      </section>
      <RelatedPages current="/blog" />
    </>
  );
}
