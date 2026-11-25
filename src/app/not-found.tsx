import type { Metadata } from "next";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import { ArrowRightIcon } from "@/components/Icons";
import { siteConfig } from "@/config/site";

// A page that doesn't exist (an old link, a typo). Never in Google ("noindex"),
// and it helps visitors find what they were looking for.
export const metadata: Metadata = {
  title: "Page not found",
  description: "This page doesn't exist or has moved. Try the VITEEE rank predictor, crash courses, free resources or book VITEEE counselling.",
  robots: { index: false, follow: true },
};

const popular = [
  { href: "/predictor", title: "VITEEE Rank Predictor", text: "Enter your marks, see your likely rank — free." },
  { href: "/courses", title: "VITEEE Crash Courses", text: "60, 45, 30 and 10-day PDF revision courses." },
  { href: "/book-a-slot", title: "Book VITEEE Counselling", text: "One-to-one call for your VIT campus and branch plan." },
  { href: "/free-resources", title: "Free Resources", text: "Free mock tests, papers and PDF guides." },
  { href: "/important-dates", title: "Important Dates", text: "VITEEE exam and VIT counselling schedule." },
  ...(siteConfig.showBlog ? [{ href: "/blog", title: "Blog", text: "VITEEE preparation and VIT counselling guides." }] : []),
];

export default function NotFound() {
  return (
    <section className="container-page py-14 sm:py-20">
      <div className="mx-auto max-w-3xl text-center">
        <div className="mb-6 flex justify-center"><BackButton /></div>
        <p className="text-6xl font-extrabold text-brand-600">404</p>
        <h1 className="mt-4 text-2xl font-extrabold text-slate-900 sm:text-3xl">Sorry, we couldn&apos;t find that page</h1>
        <p className="mt-2 text-slate-600">The link may be old or mistyped. Here are the pages students use most:</p>
      </div>
      <ul className="mx-auto mt-8 grid max-w-3xl gap-3 sm:grid-cols-2">
        {popular.map((p) => (
          <li key={p.href}>
            <Link href={p.href} className="card card-hover flex h-full items-center justify-between gap-3 p-4">
              <span>
                <span className="block font-bold text-slate-900">{p.title}</span>
                <span className="block text-sm text-slate-600">{p.text}</span>
              </span>
              <ArrowRightIcon className="h-4 w-4 shrink-0 text-brand-600" />
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-center text-sm text-slate-600">
        Still stuck? <Link href="/contact" className="font-semibold text-brand-700 underline">Contact us</Link> or go to the <Link href="/" className="font-semibold text-brand-700 underline">home page</Link>.
      </p>
    </section>
  );
}
