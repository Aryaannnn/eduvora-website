import Link from "next/link";
import { siteConfig } from "@/config/site";
import { formatDate, formatPrice, formatTime } from "@/lib/format";
import type { Slot } from "@/lib/types";
import { ArrowRightIcon, CalendarIcon, CheckIcon, HeadsetIcon } from "../Icons";
import NoSlotsMessage from "../NoSlotsMessage";
import Reveal from "../Reveal";
import SectionHeading from "../SectionHeading";

const steps = [
  "Pick a date and time that suits you",
  "Pay securely and get confirmation",
  "Get a one-to-one call with our counsellor (parents welcome)",
  "Receive your personal campus & branch plan",
];

// Slots come from Supabase → slots table
export default function BookCallSection({ slots }: { slots: Slot[] }) {
  const minPrice = slots.length ? Math.min(...slots.map((s) => s.price)) : null;

  return (
    <section className="section bg-slate-50">
      <div className="container-page grid gap-12 lg:grid-cols-2 lg:items-center">
        <div>
          <SectionHeading
            eyebrow="Book a call"
            title="One-to-one counselling, made simple"
            subtitle="A private call where we look at your rank, budget and interests, and build a clear plan for VIT counselling — no confusion, no pressure."
          />
          <Reveal delay={100}>
            <ol className="mt-8 space-y-4">
              {steps.map((s, i) => (
                <li key={s} className="flex items-start gap-4">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">{i + 1}</span>
                  <span className="pt-1 text-slate-700">{s}</span>
                </li>
              ))}
            </ol>
          </Reveal>
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
