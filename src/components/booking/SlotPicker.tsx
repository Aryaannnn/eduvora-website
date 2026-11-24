"use client";

// =====================================================================
//  SLOT PICKER — one card, used on the home page ("Next available slots")
//  and on the Book a Slot page. Students book ONLY real 30-minute slots.
//   • Date strip: the next 14 days. Gold = has a free slot, grey "Full" =
//     every slot booked (still clickable), days without slots are hidden.
//   • Times: every 30-minute slot of that day. Free = gold; booked or being
//     paid for = grey with "Booked".
//   • Tap a booked time → "This time is available on …" (the next dates
//     with a FREE slot at exactly the same start time).
//   • Tap a free time → home page: the Book a Slot form with that slot
//     chosen; Book a Slot page: the slot is chosen in the form.
//  Data: from the server (src/lib/slot-board.ts), refreshed every minute.
//  The slot is checked again on the server when the student pays.
//  All dates and times are India time (IST).
// =====================================================================
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { siteConfig } from "@/config/site";
import { formatDate, formatPrice, formatTime } from "@/lib/format";
import type { BoardSlot, SlotBoard } from "@/lib/slot-board";
import { CalendarIcon, CheckIcon, HeadsetIcon } from "../Icons";

const STRIP_DAYS = 14;

/** The slot list, refreshed from the server every minute while the page is open (and visible). */
export function useSlotBoard(initial: SlotBoard) {
  const [board, setBoard] = useState(initial);
  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/slots", { cache: "no-store" });
      if (r.ok) setBoard((await r.json()) as SlotBoard);
    } catch {
      /* offline — keep what we have */
    }
  }, []);
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refresh]);
  return [board, refresh] as const;
}

const addDays = (d: string, n: number) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

/** "10:00 – 10:30 AM" (or "11:45 AM – 12:15 PM" across noon) */
export function slotRange(start: string, end: string) {
  const a = formatTime(start), b = formatTime(end);
  const [aTime, aPart] = a.split(" "), [, bPart] = b.split(" ");
  return aPart === bPart ? `${aTime} – ${b}` : `${a} – ${b}`;
}

type Props = {
  board: SlotBoard;
  /** "link": a free time opens the Book a Slot form (home page) · "select": chooses it in the form */
  mode: "link" | "select";
  selectedId?: string;
  onSelect?: (slot: BoardSlot) => void;
  className?: string;
};

export default function SlotPicker({ board, mode, selectedId = "", onSelect, className = "" }: Props) {
  const [picked, setPicked] = useState(""); // date the student tapped
  const [tapped, setTapped] = useState(""); // booked slot the student tapped

  const slots = board.slots;
  const free = slots.filter((s) => !s.booked);
  const selected = free.find((s) => s.id === selectedId);
  const prices = [...new Set((free.length ? free : slots).map((s) => s.price))];
  const priceText = prices.length === 0 ? "" : prices.length === 1 ? `${formatPrice(prices[0])} per slot` : `From ${formatPrice(Math.min(...prices))} per slot`;

  const header = (
    <div className="flex items-center gap-3">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600"><HeadsetIcon /></span>
      <div className="min-w-0">
        <p className="font-extrabold text-slate-900">30-minute one-to-one voice call</p>
        <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-slate-500">
          {priceText && <strong className="text-slate-800">{priceText}</strong>}
          {priceText && <span aria-hidden>·</span>}
          <span>All times IST</span>
        </p>
      </div>
    </div>
  );
  const footer = (
    <p className="mt-5 flex items-center justify-center gap-1.5 border-t border-slate-100 pt-4 text-center text-xs text-slate-500">
      <CheckIcon className="h-4 w-4 shrink-0 text-green-600" /> Free reschedule up to {siteConfig.refunds.counsellingHours} hours before your slot
    </p>
  );

  // Nothing free in the next 60 days → only this message (no form)
  if (free.length === 0) {
    return (
      <div className={`card min-w-0 max-w-full p-5 shadow-xl shadow-slate-200/70 sm:p-7 ${className}`}>
        {header}
        <p className="mt-5 rounded-2xl bg-slate-50 p-5 text-center font-semibold text-slate-700 ring-1 ring-slate-200">{siteConfig.noSlotsMessage}</p>
      </div>
    );
  }

  // Dates: the next 14 days that have slots (+ a later date if the student jumped there)
  const lastDay = addDays(board.today, STRIP_DAYS - 1); // "today" comes from the server (India date)
  const allDates = [...new Set(slots.map((s) => s.date))];
  const freeDates = new Set(free.map((s) => s.date));
  const active = [picked, selected?.date, free[0].date].find((d) => d && allDates.includes(d))!;
  const dates = allDates.filter((d) => d <= lastDay || d === active).sort();
  const daySlots = slots.filter((s) => s.date === active);

  const choose = (s: BoardSlot) => {
    setTapped("");
    setPicked(s.date);
    onSelect?.(s);
  };

  return (
    <div className={`card min-w-0 max-w-full p-5 shadow-xl shadow-slate-200/70 sm:p-7 ${className}`}>
      {header}

      {/* Date strip (scrolls sideways on phones) */}
      <p className="mt-6 flex items-center gap-1.5 text-sm font-bold text-slate-800"><CalendarIcon className="h-4 w-4 text-brand-600" /> Choose a date</p>
      <div className="-mx-1 mt-2 flex snap-x gap-2 overflow-x-auto overscroll-x-contain px-1 pb-2 pt-1" role="group" aria-label="Dates">
        {dates.map((d) => {
          const full = !freeDates.has(d);
          const on = d === active;
          const [wd, dm] = formatDate(d).split(", ");
          const [day, month] = dm.split(" ");
          return (
            <button
              key={d}
              type="button"
              onClick={() => { setPicked(d); setTapped(""); }}
              aria-pressed={on}
              aria-label={`${formatDate(d, true)}${full ? " — fully booked" : " — times available"}`}
              className={`min-w-[4.25rem] shrink-0 snap-start rounded-2xl px-3 py-2 text-center ring-1 transition-colors ${
                on
                  ? full ? "bg-slate-600 text-white ring-slate-600" : "bg-brand-600 text-white ring-brand-600"
                  : full ? "bg-slate-100 text-slate-500 ring-slate-200 hover:bg-slate-200" : "bg-accent-400/20 text-slate-900 ring-accent-400/70 hover:bg-accent-400/35"
              }`}
            >
              <span className="block text-xs font-semibold uppercase opacity-80">{wd}</span>
              <span className="block text-lg font-extrabold leading-tight">{day}</span>
              <span className="block text-xs font-semibold opacity-80">{month}</span>
              {full && <span className={`mt-0.5 block text-[10px] font-extrabold uppercase tracking-wider ${on ? "text-white/90" : "text-slate-500"}`}>Full</span>}
            </button>
          );
        })}
      </div>

      {/* Times of the chosen date */}
      <p className="mt-4 text-sm font-bold text-slate-800">
        {formatDate(active, true)} <span className="font-semibold text-slate-500">· 30 minutes · IST</span>
      </p>
      <div className="mt-2 grid grid-flow-row-dense grid-cols-2 gap-2 sm:grid-cols-3">
        {daySlots.map((s) => {
          const label = slotRange(s.start_time, s.end_time);
          if (s.booked) {
            return [
              <button
                key={s.id}
                type="button"
                onClick={() => setTapped(tapped === s.id ? "" : s.id)}
                aria-expanded={tapped === s.id}
                aria-label={`${label}, booked — see other dates at this time`}
                className={`min-h-[3.25rem] rounded-xl px-2 py-2 text-center text-sm ring-1 transition ${tapped === s.id ? "bg-slate-200 ring-slate-400" : "bg-slate-100 ring-slate-200 hover:bg-slate-200"}`}
              >
                <span className="block font-semibold text-slate-500">{label}</span>
                <span className="block text-xs font-bold uppercase tracking-wide text-slate-500">Booked</span>
              </button>,
              tapped === s.id && <BookedNote key={`${s.id}-note`} slot={s} free={free} mode={mode} onChoose={choose} onClose={() => setTapped("")} />,
            ];
          }
          const on = s.id === selectedId;
          const cls = `flex min-h-[3.25rem] flex-col items-center justify-center rounded-xl px-2 py-2 text-center text-sm font-bold ring-1 transition ${
            on ? "bg-brand-600 text-white ring-brand-600" : "bg-accent-400/20 text-slate-900 ring-accent-400/70 hover:bg-accent-400/40"
          }`;
          const inner = (
            <>
              <span>{label}</span>
              <span className={`text-xs font-semibold ${on ? "text-white/85" : "text-slate-600"}`}>{on ? "Selected" : formatPrice(s.price)}</span>
            </>
          );
          return mode === "link" ? (
            <Link key={s.id} href={`/book-a-slot?slot=${s.id}#book`} className={cls} aria-label={`Book ${formatDate(s.date)} at ${label}`}>{inner}</Link>
          ) : (
            <button key={s.id} type="button" onClick={() => choose(s)} aria-pressed={on} className={cls}>{inner}</button>
          );
        })}
      </div>

      {footer}
    </div>
  );
}

/** Shown right under a booked time: the next dates with a FREE slot at exactly that start time. */
function BookedNote({ slot, free, mode, onChoose, onClose }: { slot: BoardSlot; free: BoardSlot[]; mode: "link" | "select"; onChoose: (s: BoardSlot) => void; onClose: () => void }) {
  const same = free.filter((f) => f.start_time === slot.start_time && f.date !== slot.date);
  // Later dates first, then earlier ones
  const options = [...same.filter((f) => f.date > slot.date), ...same.filter((f) => f.date < slot.date).reverse()].slice(0, 3);
  const label = slotRange(slot.start_time, slot.end_time);
  const time = formatTime(slot.start_time);
  const [first, ...more] = options;

  const go = (s: BoardSlot, primary: boolean, text: string) =>
    mode === "link" ? (
      <Link key={s.id} href={`/book-a-slot?slot=${s.id}#book`} className={primary ? "btn-primary mt-3 min-h-11 w-full !py-2.5 text-sm sm:w-auto" : "inline-flex min-h-11 items-center rounded-full bg-white px-3.5 text-sm font-bold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50"}>{text}</Link>
    ) : (
      <button key={s.id} type="button" onClick={() => onChoose(s)} className={primary ? "btn-primary mt-3 min-h-11 w-full !py-2.5 text-sm sm:w-auto" : "inline-flex min-h-11 items-center rounded-full bg-white px-3.5 text-sm font-bold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50"}>{text}</button>
    );

  return (
    <div role="status" className="relative col-span-full rounded-xl bg-amber-50 p-3 pr-11 text-[15px] leading-relaxed text-amber-950 ring-1 ring-amber-200 sm:text-sm">
      <button type="button" onClick={onClose} aria-label="Close" className="absolute right-0 top-0 grid h-11 w-11 place-items-center rounded-lg text-xl leading-none text-amber-900/70 hover:bg-amber-100">×</button>
      {first ? (
        <>
          <p>
            <strong>{label}</strong> is booked on {formatDate(slot.date)}. This time is available on <strong>{formatDate(first.date)}</strong>.
          </p>
          {go(first, true, `Book ${formatDate(first.date)} at ${time}`)}
          {more.length > 0 && (
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-amber-900">
              Also free at {time}: {more.map((m) => go(m, false, formatDate(m.date)))}
            </p>
          )}
        </>
      ) : (
        <p>This time isn&apos;t available in the coming days. Please choose another time.</p>
      )}
    </div>
  );
}

/** Placeholder while the slots load from the server. */
export function SlotPickerSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`card min-w-0 max-w-full p-5 shadow-xl shadow-slate-200/70 sm:p-7 ${className}`} aria-busy="true" aria-label="Loading available slots">
      <div className="flex items-center gap-3">
        <span className="h-12 w-12 animate-pulse rounded-2xl bg-slate-100" />
        <span className="space-y-2"><span className="block h-4 w-48 animate-pulse rounded bg-slate-100" /><span className="block h-3 w-32 animate-pulse rounded bg-slate-100" /></span>
      </div>
      <div className="mt-6 flex gap-2 overflow-hidden">{Array.from({ length: 5 }, (_, i) => <span key={i} className="h-[4.5rem] w-[4.25rem] shrink-0 animate-pulse rounded-2xl bg-slate-100" />)}</div>
      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <span key={i} className="h-[3.25rem] animate-pulse rounded-xl bg-slate-100" />)}</div>
    </div>
  );
}
