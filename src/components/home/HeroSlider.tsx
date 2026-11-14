"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { siteConfig } from "@/config/site";
import {
  ArrowRightIcon,
  BookIcon,
  CalendarIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardIcon,
  GraduationIcon,
  RocketIcon,
  TargetIcon,
} from "../Icons";

// =====================================================================
//  ⏱️ SLIDE SPEED — how long each slide stays on screen (milliseconds).
//  3000 = 3 seconds. Change this number to make the slideshow faster/slower.
// =====================================================================
const AUTO_SLIDE_MS = 3000;

// ---------- Edit slide text here (the order here = the order on the website) ----------
type Slide = {
  brandLine?: boolean; // shows "EDUVORA — Discover Your Path, Build Your Future."
  visual?: "predictor"; // special "Marks → Rank → College" picture
  eyebrow: string;
  title: string;
  text: string;
  cta: { label: string; href: string }; // the ONE main button
  link?: { label: string; href: string }; // optional small text link next to it
  icon: typeof CalendarIcon;
  color: string;
  points: string[];
};

// 4 slides, ONE main button each (a second, quieter text link is optional)
const slides: Slide[] = [
  {
    brandLine: true,
    eyebrow: "One-to-one counselling",
    title: "Book Your Counselling Slot",
    text: "Get personal guidance on VIT campus, branch and fee category choices — based on your rank and budget.",
    cta: { label: "Book Counselling", href: "/book-a-slot" },
    link: { label: "Try the free predictor", href: "/predictor" },
    icon: CalendarIcon,
    color: "from-brand-500 to-brand-700",
    points: ["Rank-based campus plan", "Fee category guidance", "Parents can join"],
  },
  {
    visual: "predictor",
    eyebrow: "Free rank predictor · college list with counselling",
    title: "Predict Your VITEEE Rank & College",
    text: "Enter your expected marks and see your predicted VITEEE rank range for free. Book counselling to see the VIT campus and branch you can get.",
    cta: { label: "Predict My Rank — Free", href: "/predictor" },
    icon: TargetIcon,
    color: "from-accent-400 to-accent-600",
    points: [],
  },
  {
    eyebrow: "Campus-wise guides",
    title: "Purchase Study Material",
    text: "Admission kits for VIT Vellore, Chennai, AP and Bhopal with rank trends, fees and choice-filling checklists.",
    cta: { label: "Buy Study Material", href: "/study-material" },
    icon: BookIcon,
    color: "from-sky-500 to-cyan-600",
    points: ["PDF + printed", "Branch-wise rank trends", "Instant download"],
  },
  {
    eyebrow: "Score higher, faster",
    title: "VITEEE Crash Courses",
    text: "Focused live classes, smart shortcuts and daily practice to revise the full syllabus before exam day.",
    cta: { label: "Explore Courses", href: "/courses" },
    icon: RocketIcon,
    color: "from-accent-400 to-accent-600",
    points: ["Live + recorded classes", "Daily doubt solving", "Weekly mock tests"],
  },
];

const arrowBtn =
  "grid h-12 w-12 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/25 backdrop-blur transition " +
  "hover:bg-accent-400 hover:text-brand-950 hover:ring-accent-400 hover:shadow-lg hover:shadow-accent-400/30 " +
  "focus-visible:bg-accent-400 focus-visible:text-brand-950 active:scale-95 sm:h-14 sm:w-14";

export default function HeroSlider() {
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1); // 1 = moving forward, -1 = back
  const [hovering, setHovering] = useState(false); // mouse over (desktop)
  const [touching, setTouching] = useState(false); // finger on screen (mobile)
  const [keyboardFocus, setKeyboardFocus] = useState(false); // tabbing with the keyboard
  // Paused by the visitor (Pause button, or a tap on the slideshow) — stays paused until "Play"
  const [userPaused, setUserPaused] = useState(false);
  // The first slide appears instantly (no slide-in) — animations only once slides change
  const [moved, setMoved] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const n = slides.length;
  const paused = hovering || touching || keyboardFocus || userPaused;

  // "Reduce motion" turned on in the phone/computer settings → start paused
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      const t = setTimeout(() => setUserPaused(true), 0);
      return () => clearTimeout(t);
    }
  }, []);

  const go = (i: number, direction: 1 | -1) => {
    setMoved(true);
    setDir(direction);
    setIndex((i + n) % n);
  };
  const next = () => go(index + 1, 1);
  const prev = () => go(index - 1, -1);

  // Auto-slide every AUTO_SLIDE_MS. Any change of slide (Next, Previous, dot, swipe)
  // restarts the timer, because `index` changes. Paused while hovering/touching.
  useEffect(() => {
    if (paused) return;
    const id = setTimeout(() => {
      setMoved(true);
      setDir(1);
      setIndex((i) => (i + 1) % n);
    }, AUTO_SLIDE_MS);
    return () => clearTimeout(id);
  }, [index, paused, n]);

  return (
    <section
      className="hero-bg relative touch-pan-y overflow-hidden text-white"
      aria-roledescription="carousel"
      aria-label="EDUVORA highlights"
      // Only a real mouse counts as "hover" (phones fake mouse events after a tap)
      onPointerEnter={(e) => e.pointerType === "mouse" && setHovering(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setHovering(false)}
      onFocusCapture={(e) => (e.target as HTMLElement).matches(":focus-visible") && setKeyboardFocus(true)}
      onBlurCapture={() => setKeyboardFocus(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") next();
        if (e.key === "ArrowLeft") prev();
      }}
      onTouchStart={(e) => {
        touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        setTouching(true);
        setUserPaused(true); // a tap pauses the slideshow (press Play to continue)
      }}
      onTouchEnd={(e) => {
        setTouching(false);
        const start = touchStart.current;
        touchStart.current = null;
        if (!start) return;
        const dx = e.changedTouches[0].clientX - start.x;
        const dy = e.changedTouches[0].clientY - start.y;
        // A sideways swipe of 40px+ that is more sideways than up/down
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) (dx < 0 ? next : prev)();
      }}
      onTouchCancel={() => setTouching(false)}
    >
      <div className="grid-pattern absolute inset-0" aria-hidden />
      <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand-500/30 blur-3xl" aria-hidden />

      <div className="container-page relative pb-8 pt-10 sm:pt-16 lg:!px-24 lg:pb-12 lg:pt-20">
        {/* All slides share one grid cell, so the height fits the tallest slide */}
        <div className="grid">
          {slides.map((s, i) => {
            const active = i === index;
            return (
              <div
                key={s.title}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${n}: ${s.title}`}
                aria-hidden={!active}
                inert={!active}
                className={`grid items-center gap-8 [grid-area:1/1] lg:grid-cols-[1.15fr_1fr] lg:gap-10 ${
                  active
                    ? `visible ${moved ? (dir === 1 ? "animate-slide-in-right" : "animate-slide-in-left") : ""}`
                    : "invisible opacity-0 transition-[opacity,visibility] duration-200"
                }`}
              >
                <div>
                  {s.brandLine && (
                    <p className="mb-4 text-sm font-bold tracking-wide sm:text-lg">
                      <span className="font-extrabold text-white">{siteConfig.businessName}</span>
                      <span className="mx-2 text-accent-400">—</span>
                      <span className="text-accent-300">{siteConfig.tagline}</span>
                    </p>
                  )}
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-100 ring-1 ring-white/15">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-accent-400" /> {s.eyebrow}
                  </span>
                  {/* one <h1> per page (SEO): the first slide; the others look the same but are <h2> */}
                  {i === 0 ? (
                    <h1 className="mt-4 text-[2rem] font-extrabold leading-[1.1] tracking-tight [text-wrap:balance] sm:mt-5 sm:text-5xl lg:text-6xl">{s.title}</h1>
                  ) : (
                    <h2 className="mt-4 text-[2rem] font-extrabold leading-[1.1] tracking-tight [text-wrap:balance] sm:mt-5 sm:text-5xl lg:text-6xl">{s.title}</h2>
                  )}
                  <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-200 sm:mt-5 sm:text-lg">{s.text}</p>

                  {/* Small "Marks → Rank → College" strip on phones/tablets */}
                  {s.visual === "predictor" && <PredictorFlowCompact />}

                  <div className="mt-7 flex flex-col items-start gap-4 sm:mt-8 sm:flex-row sm:items-center sm:gap-6">
                    <Link href={s.cta.href} className="btn-accent w-full !px-7 !py-3.5 text-base sm:w-auto" tabIndex={active ? 0 : -1}>
                      {s.cta.label} <ArrowRightIcon className="h-4 w-4" />
                    </Link>
                    {s.link && (
                      <Link href={s.link.href} className="inline-flex items-center gap-1 self-center text-sm font-bold text-accent-300 underline decoration-accent-400/50 underline-offset-4 hover:text-accent-200 sm:self-auto" tabIndex={active ? 0 : -1}>
                        {s.link.label} <ArrowRightIcon className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>
                </div>

                {/* Right-hand picture (desktop) */}
                <div className="hidden lg:block">
                  {s.visual === "predictor" ? (
                    <PredictorFlow active={active && moved} />
                  ) : (
                    <div className={`relative mx-auto max-w-sm ${active ? "animate-float" : ""}`}>
                      <div className={`absolute -inset-4 rounded-[2rem] bg-gradient-to-br ${s.color} opacity-40 blur-2xl`} />
                      <div className="relative rounded-[1.75rem] bg-white/10 p-7 ring-1 ring-white/20 backdrop-blur-xl">
                        <div className={`grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br ${s.color} shadow-lg`}>
                          <s.icon className="h-8 w-8 text-white" />
                        </div>
                        <p className="mt-5 text-xl font-bold">{s.title}</p>
                        <ul className="mt-4 space-y-3">
                          {s.points.map((p) => (
                            <li key={p} className="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3 text-sm ring-1 ring-white/10">
                              <CheckIcon className="h-4 w-4 text-accent-400" /> {p}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Dots — click to jump to any slide. The active one fills with gold over 3 seconds.
            + Pause / Play button (always visible) */}
        <div className="mt-8 flex justify-center px-16 lg:mt-10 lg:px-0">
          <div className="flex flex-wrap items-center justify-center gap-1">
            <button
              type="button"
              onClick={() => setUserPaused((p) => !p)}
              aria-pressed={userPaused}
              aria-label={userPaused ? "Play slideshow" : "Pause slideshow"}
              className="mr-1 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/25 transition hover:bg-white/20"
            >
              {userPaused ? (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden><path d="M8 5v14l11-7z" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden><path d="M7 5h4v14H7zM13 5h4v14h-4z" /></svg>
              )}
            </button>
            {slides.map((s, i) => (
              <button
                key={s.title}
                type="button"
                onClick={() => go(i, i >= index ? 1 : -1)}
                aria-label={`Go to slide ${i + 1}: ${s.title}`}
                aria-current={i === index}
                className="group grid h-11 min-w-8 place-items-center px-1"
              >
                <span
                  className={`relative block h-2.5 overflow-hidden rounded-full transition-all duration-300 ${
                    i === index ? "w-9 bg-white/30" : "w-2.5 bg-white/40 group-hover:bg-accent-300"
                  }`}
                >
                  {i === index && (
                    <span
                      key={`${index}-${paused}`}
                      className="absolute inset-0 origin-left rounded-full bg-accent-400"
                      style={{
                        animation: paused ? "none" : `dot-progress ${AUTO_SLIDE_MS}ms linear forwards`,
                        transform: paused ? "scaleX(1)" : undefined,
                      }}
                    />
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Previous / Next — at the bottom corners on phones, on the left/right sides on desktop */}
        <button type="button" onClick={prev} aria-label="Previous slide" className={`${arrowBtn} absolute bottom-6 left-4 lg:bottom-auto lg:left-4 lg:top-1/2 lg:-translate-y-1/2`}>
          <ChevronLeftIcon className="h-6 w-6" />
        </button>
        <button type="button" onClick={next} aria-label="Next slide" className={`${arrowBtn} absolute bottom-6 right-4 lg:bottom-auto lg:right-4 lg:top-1/2 lg:-translate-y-1/2`}>
          <ChevronRightIcon className="h-6 w-6" />
        </button>
      </div>
    </section>
  );
}

// ---------- "Marks → Rank → College & Branch" picture (desktop) ----------
const flowSteps = [
  { icon: ClipboardIcon, label: "Your marks", value: "95 / 125" },
  { icon: TargetIcon, label: "Predicted rank", value: "~2,750" },
  { icon: GraduationIcon, label: "College & branch", value: "VIT Vellore · CSE" },
];

function PredictorFlow({ active }: { active: boolean }) {
  return (
    <div className="relative mx-auto max-w-sm">
      <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-accent-400 to-brand-500 opacity-30 blur-2xl" />
      <div className="relative rounded-[1.75rem] bg-white/10 p-6 ring-1 ring-white/20 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-accent-300">How it works</p>
          {/* These numbers are only an illustration, not a real prediction */}
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white ring-1 ring-white/30">Example</span>
        </div>
        <ol className="mt-4" aria-label="Example: marks, predicted rank, then college and branch">
          {flowSteps.map((step, i) => (
            <li key={step.label}>
              <div
                className={`flex items-center gap-4 rounded-2xl bg-white p-3.5 text-brand-700 shadow-lg ${active ? "animate-slide-in-right" : ""}`}
                style={{ animationDelay: active ? `${150 + i * 140}ms` : undefined }}
              >
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${i === 1 ? "bg-accent-400 text-brand-950" : "bg-brand-600 text-white"}`}>
                  <step.icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-slate-500">{step.label}</span>
                  <span className="block truncate text-lg font-extrabold text-brand-700">{step.value}</span>
                </span>
                {i === 2 && <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">High chance</span>}
              </div>
              {i < flowSteps.length - 1 && (
                <div className="flex justify-center py-1.5 text-accent-400" aria-hidden>
                  <ArrowRightIcon className="h-5 w-5 rotate-90" />
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

// ---------- Compact version for phones and tablets ----------
function PredictorFlowCompact() {
  const items = [
    { icon: ClipboardIcon, label: "Marks" },
    { icon: TargetIcon, label: "Rank" },
    { icon: GraduationIcon, label: "College & Branch" },
  ];
  return (
    <div className="mt-5 flex flex-wrap items-center gap-1 sm:gap-1.5 lg:hidden" aria-label="Marks, then rank, then college and branch">
      {items.map((it, i) => (
        <span key={it.label} className="flex items-center gap-1 sm:gap-1.5">
          <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1.5 text-[11px] font-bold sm:gap-1.5 sm:px-3 sm:text-xs ${i === 1 ? "bg-accent-400 text-brand-950" : "bg-white text-brand-700"}`}>
            <it.icon className="h-3.5 w-3.5" /> {it.label}
          </span>
          {i < items.length - 1 && <ArrowRightIcon className="h-3.5 w-3.5 text-accent-400" />}
        </span>
      ))}
    </div>
  );
}
