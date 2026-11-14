import Link from "next/link";
import BackButton from "./BackButton";
import { HomeIcon } from "./Icons";

// The coloured title band at the top of inner pages.
export default function PageHero({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="hero-bg relative overflow-hidden text-white">
      <div className="grid-pattern absolute inset-0 opacity-40" aria-hidden />
      <div className="container-page relative animate-fade-up py-12 sm:py-16">
        {/* "← Back" (previous page) + "Home" link */}
        <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-2 text-sm">
          <BackButton tone="dark" />
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20"
          >
            <HomeIcon className="h-4 w-4" /> Home
          </Link>
          {eyebrow && (
            <>
              <span className="text-slate-400" aria-hidden>›</span>
              <span className="font-medium text-slate-300">{eyebrow}</span>
            </>
          )}
        </nav>
        {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.15em] text-accent-300">{eyebrow}</p>}
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-5xl">{title}</h1>
        {subtitle && <p className="mt-4 max-w-2xl text-base text-slate-300 sm:text-lg">{subtitle}</p>}
        {children}
      </div>
    </section>
  );
}
