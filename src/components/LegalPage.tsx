import { siteConfig } from "@/config/site";
import PageHero from "./PageHero";
import JsonLd from "./seo/JsonLd";
import { breadcrumbLd } from "@/lib/seo";

// Shared layout for Privacy / Terms / Refund pages.
export default function LegalPage({ title, path, children }: { title: string; path: string; children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: title, path }])} />
      <PageHero eyebrow="Legal" title={title} subtitle={`Last updated: ${siteConfig.policiesUpdated}`} />
      <div className="container-page py-10 sm:py-14">
        <article className="legal mx-auto max-w-3xl">{children}</article>
      </div>
    </>
  );
}
