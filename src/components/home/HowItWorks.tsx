import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getSlotBoard } from "@/lib/slot-board";
import HomeSlotPicker from "../booking/HomeSlotPicker";
import { SlotPickerSkeleton } from "../booking/SlotPicker";
import { ArrowRightIcon, CalendarIcon, GraduationIcon, TargetIcon } from "../Icons";
import Reveal from "../Reveal";
import SectionHeading from "../SectionHeading";

// ✏️ The 3 steps (text + where each button goes)
const steps = [
  { icon: TargetIcon, title: "Predict your rank", text: "Enter your expected marks in the free Rank Predictor and see your likely VITEEE rank range.", href: "/predictor", cta: "Try the free predictor" },
  { icon: CalendarIcon, title: "Book a session", text: "Pick a time for a private 30-minute one-to-one voice call. Utkarsh Sir calls you on your phone — parents are welcome to join on speaker.", href: "/book-a-slot", cta: "Book counselling" },
  { icon: GraduationIcon, title: "Get your college plan", text: "Leave with a clear plan: which VIT campus, branch and fee category to aim for — and your choice list.", href: "/book-a-slot", cta: "" },
];

/** The slot picker card, loaded on the server for each visit (never a stale list). */
async function HomeSlots() {
  await connection();
  return <HomeSlotPicker initial={await getSlotBoard()} />;
}

// "How it works" (3 steps) + the next open counselling slots
export default function HowItWorks() {
  return (
    <section className="section bg-slate-50" id="how-it-works">
      <div className="container-page grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-12">
        <div>
          <SectionHeading eyebrow="How it works" title="From marks to the right VIT college in 3 steps" />
          <ol className="mt-8 space-y-4">
            {steps.map((s, i) => (
              <li key={s.title}>
                <Reveal delay={i * 80} className="flex items-start gap-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:p-5">
                  <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-600 text-white">
                    <s.icon className="h-6 w-6" />
                    <span className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-accent-400 text-xs font-black text-brand-950 ring-2 ring-white">{i + 1}</span>
                  </span>
                  <span className="min-w-0">
                    <span className="block text-lg font-extrabold text-slate-900">{s.title}</span>
                    <span className="mt-0.5 block text-sm leading-relaxed text-slate-600">{s.text}</span>
                    {s.cta && (
                      <Link href={s.href} className="mt-1.5 inline-flex items-center gap-1 text-sm font-bold text-brand-700 hover:underline">
                        {s.cta} <ArrowRightIcon className="h-4 w-4" />
                      </Link>
                    )}
                  </span>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>

        {/* Next available slots — the shared slot picker (fresh from the database, every minute) */}
        <Reveal delay={150} className="min-w-0">
          <p className="mb-3 text-lg font-extrabold text-slate-900">Next available slots</p>
          <Suspense fallback={<SlotPickerSkeleton />}>
            <HomeSlots />
          </Suspense>
        </Reveal>
      </div>
    </section>
  );
}
