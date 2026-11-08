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
        <div className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Note:</strong> This is sample text to get you started. Please have it reviewed by a legal professional before going live.
        </div>
        <article className="legal mx-auto mt-8 max-w-3xl">{children}</article>
      </div>
    </>
  );
}
