import type { Metadata } from "next";
import JsonLd from "@/components/seo/JsonLd";
import { pageMeta, breadcrumbLd, personLd } from "@/lib/seo";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import FounderHighlights from "@/components/FounderHighlights";
import FounderPhoto from "@/components/FounderPhoto";
import { CalendarIcon, HomeIcon, InstagramIcon, YouTubeIcon } from "@/components/Icons";
import Reveal from "@/components/Reveal";
import { siteConfig } from "@/config/site";
import { founder } from "@/content/founder";

export const metadata: Metadata = pageMeta({ title: "Utkarsh Shrivastava – VIT Counselling Mentor", description: "Utkarsh Shrivastava, founder of EDUVORA, guides VITEEE students and parents through VIT counselling: rank, campus, branch and fee category decisions.", path: "/founder", image: { url: founder.photo, alt: founder.photoAlt }, type: "profile" });

// Full founder story. ✏️ Edit the text in src/content/founder.ts
export default function FounderPage() {
  const firstName = founder.name.split(" ")[0];
  return (
    <>
      <JsonLd data={[breadcrumbLd([{ name: "Founder", path: "/founder" }]), personLd({ name: founder.name, jobTitle: founder.shortTitle, description: founder.summary, image: founder.photo, path: "/founder" })]} />
      {/* Header band */}
      <section className="hero-bg relative overflow-hidden text-white">
        <div className="grid-pattern absolute inset-0 opacity-40" aria-hidden />
        <div className="container-page relative py-8 sm:py-10">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm">
            <BackButton tone="dark" />
            <Link href="/" className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20">
              <HomeIcon className="h-4 w-4" /> Home
            </Link>
            <span className="text-slate-400" aria-hidden>›</span>
            <span className="font-medium text-slate-300">Founder story</span>
          </nav>
        </div>
      </section>

      <article className="bg-slate-50">
        {/* Photo + name */}
        <div className="container-page grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[0.8fr_1.2fr]">
          <Reveal><FounderPhoto size="lg" eager /></Reveal>
          <Reveal delay={100}>
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-accent-700">
              <span className="h-1.5 w-6 rounded-full bg-accent-400" /> The founder&apos;s story
            </p>
            <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-brand-700 sm:text-5xl">{founder.name}</h1>
            <p className="mt-3 text-base font-semibold leading-relaxed text-accent-700 sm:text-lg">{founder.title}</p>
            <FounderHighlights className="mt-8" />
          </Reveal>
        </div>

        {/* The story — comfortable reading width and spacing */}
        <div className="bg-white">
          <div className="container-page py-12 sm:py-16">
            <div className="mx-auto max-w-2xl space-y-6 text-[1.075rem] leading-[1.85] text-slate-700 sm:text-lg">
              {founder.story.map((p, i) => (
                <Reveal key={i}>
                  <p className={i === 0 ? "text-lg leading-[1.8] text-slate-800 sm:text-xl first-letter:float-left first-letter:mr-2 first-letter:text-6xl first-letter:font-extrabold first-letter:leading-[0.9] first-letter:text-accent-500" : ""}>{p}</p>
                </Reveal>
              ))}

              {/* Vision — highlighted gold quote */}
              <Reveal>
                <figure className="my-10 rounded-3xl bg-brand-700 p-7 text-center shadow-xl shadow-brand-900/20 sm:p-10">
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent-300">{founder.visionIntro}</p>
                  <blockquote className="mt-4 text-xl font-extrabold leading-snug text-accent-400 sm:text-2xl">
                    &ldquo;{founder.vision}&rdquo;
                  </blockquote>
                  <figcaption className="mt-4 text-sm font-semibold text-slate-300">— {founder.name}</figcaption>
                </figure>
              </Reveal>

              <Reveal>
                <p className="border-l-4 border-accent-400 pl-5 text-lg font-semibold italic leading-relaxed text-brand-700 sm:text-xl">{founder.closing}</p>
              </Reveal>
            </div>

            <Reveal className="mx-auto mt-12 max-w-2xl rounded-3xl bg-slate-50 p-6 text-center ring-1 ring-slate-200 sm:p-8">
              <p className="text-lg font-extrabold text-brand-700">Want personal guidance for VITEEE and VIT admissions?</p>
              <p className="mt-1 text-slate-600">Talk to {firstName} one-to-one about your rank, campus and branch choices.</p>
              <Link href="/book-a-slot" className="btn-accent mt-6 !px-7 !py-3.5 text-base">
                <CalendarIcon className="h-5 w-5" /> Book a Counselling Call with {firstName}
              </Link>
              <p className="mt-8 text-sm font-semibold text-slate-500">Follow {firstName} for free tips &amp; updates</p>
              <div className="mt-3 flex flex-wrap justify-center gap-3">
                <a href={siteConfig.instagram} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-fuchsia-500 to-orange-400 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:scale-105">
                  <InstagramIcon className="h-5 w-5" /> Instagram
                </a>
                <a href={siteConfig.youtube} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:scale-105">
                  <YouTubeIcon className="h-5 w-5" /> YouTube
                </a>
              </div>
            </Reveal>
          </div>
        </div>
      </article>
    </>
  );
}
