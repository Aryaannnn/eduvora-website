import Link from "next/link";
import { siteConfig } from "@/config/site";
import { formatDate, formatPrice, formatTime } from "@/lib/format";
import type { Slot } from "@/lib/types";
import { ArrowRightIcon, CalendarIcon, CheckIcon, GraduationIcon, HeadsetIcon, TargetIcon } from "../Icons";
import NoSlotsMessage from "../NoSlotsMessage";
import Reveal from "../Reveal";
import SectionHeading from "../SectionHeading";

// ✏️ The 3 steps (text + where each button goes)
const steps = [
  { icon: TargetIcon, title: "Predict your rank", text: "Enter your expected marks in the free Rank Predictor and see your likely VITEEE rank range.", href: "/predictor", cta: "Try the free predictor" },
  { icon: CalendarIcon, title: "Book a session", text: "Pick a time for a private one-to-one video call. Parents are welcome to join.", href: "/book-a-slot", cta: "Book counselling" },
  { icon: GraduationIcon, title: "Get your college plan", text: "Leave with a clear plan: which VIT campus, branch and fee category to aim for — and your choice list.", href: "/book-a-slot", cta: "" },
];

// "How it works" (3 steps) + the next open counselling slots (from Supabase → slots table)
export default function HowItWorks({ slots }: { slots: Slot[] }) {
  const minPrice = slots.length ? Math.min(...slots.map((s) => s.price)) : null;

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

        <Reveal delay={150}>
          <div className="card p-6 shadow-xl shadow-slate-200/70 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600"><HeadsetIcon /></span>
              <div>
                <p className="font-bold text-slate-900">Next available slots</p>
                <p className="flex items-center gap-1 text-sm text-slate-500">
                  <CalendarIcon className="h-4 w-4" />
                  {minPrice !== null ? `From ${formatPrice(minPrice)} per session` : "One-to-one video call"}
                </p>
              </div>
            </div>

            {slots.length > 0 ? (
              <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {slots.slice(0, 6).map((s) => (
                  <Link
                    key={s.id}
                    href="/book-a-slot"
                    className="rounded-xl bg-brand-50 px-2 py-2.5 text-center ring-1 ring-brand-100 transition hover:ring-brand-400"
                  >
                    <span className="block text-xs font-semibold text-slate-500">{formatDate(s.date)}</span>
                    <span className="block text-sm font-bold text-brand-700">{formatTime(s.start_time)}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <NoSlotsMessage className="mt-6" />
            )}

            {slots.length > 0 && (
              <Link href="/book-a-slot" className="btn-primary mt-6 w-full !py-3.5 text-base">
                Book Your Slot <ArrowRightIcon className="h-4 w-4" />
              </Link>
            )}
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-500">
              <CheckIcon className="h-4 w-4 text-green-600" /> Free reschedule up to {siteConfig.refunds.counsellingHours} hours before your slot
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
