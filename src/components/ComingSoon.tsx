import Link from "next/link";
import { ArrowRightIcon } from "./Icons";

// Shown instead of a page that is switched off for now
// (src/config/site.ts → showFeeCalculator / showBlog). The page also says "noindex".
export default function ComingSoon({ title, text }: { title: string; text: string }) {
  return (
    <section className="hero-bg relative overflow-hidden py-20 sm:py-28">
      <div className="grid-pattern absolute inset-0" aria-hidden />
      <div className="container-page relative max-w-2xl text-center text-white">
        <p className="inline-flex rounded-full bg-accent-400 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-brand-950">Coming soon</p>
        <h1 className="mt-4 text-3xl font-extrabold sm:text-4xl">{title}</h1>
        <p className="mx-auto mt-3 max-w-xl text-slate-300">{text}</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/predictor" className="btn-accent !px-6 !py-3.5">Try the free Rank Predictor <ArrowRightIcon className="h-4 w-4" /></Link>
          <Link href="/book-a-slot" className="btn-outline !py-3.5">Book counselling</Link>
        </div>
      </div>
    </section>
  );
}

/** Metadata for a switched-off page: never indexed. */
export const comingSoonMeta = (title: string) => ({ title: `${title} — coming soon`, robots: { index: false, follow: false } });
