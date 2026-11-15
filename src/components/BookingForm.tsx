"use client";

// =====================================================================
//  BOOK A COUNSELLING SLOT — pay first, then booked
//   1. Pick a date   2. Pick a time   3. Your details
//   → "Pay ₹499 & Book Slot" opens Razorpay straight away.
//   Behind the scenes the server holds the slot for 10 minutes so nobody
//   else can pay for it. Only after the payment is VERIFIED is it booked
//   (then the student sees the greeting page).
//   Popup closed / payment failed → slot released, friendly message, form
//   kept so they can try again with one click.
//   Students with package SESSION CREDITS book with one credit instead
//   (no payment) — "Sessions left: 2 of 3" is shown in the summary.
//   Every slot is a 30-minute VOICE CALL: Utkarsh Sir calls the student on the
//   number they enter here. Fully booked dates are grey ("Full"), dates with free
//   times are gold; slots starting within the notice time (Admin → Settings,
//   default 60 min) can't be booked. All times are India time (IST).
// =====================================================================
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { formatDate, formatPrice, formatTime, todayInIndia } from "@/lib/format";
import { openCheckout, postJson, preloadCheckout } from "@/lib/razorpay-checkout";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadBrowserSupabase } from "@/lib/supabase/lazy";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { Slot } from "@/lib/types";
import { Spinner } from "./Spinner";
import { Field } from "./ContactForm";
import { parentsPage } from "@/content/parents";
import ContactForm from "./ContactForm";
import { siteConfig } from "@/config/site";
import { slotStartsAt } from "@/lib/slot-time";
import RefundNote from "./RefundNote";
import { CalendarIcon, CheckIcon, LockIcon, PhoneIcon, ShieldIcon, UserIcon } from "./Icons";
import { CouponBox, PriceBreakdown, useQuote } from "./checkout/Checkout";

type Credits = { total: number; used: number; remaining: number; unlimited: boolean };

const CLASS_YEARS = ["Class 11", "Class 12", "Dropper / Repeater", "Parent", "Other"];
const DRAFT_KEY = "eduvora-booking-draft";
const NOT_COMPLETED = "Payment not completed. Your slot was not booked. Please try again.";

type Form = { name: string; phone: string; email: string; classYear: string; expectedMarks: string; message: string };
type Phase = "idle" | "creating" | "paying" | "verifying";
type Notice = { kind: "retry" | "taken" | "error"; text: string } | null;
type DayInfo = { date: string; total: number; free: number };

/** "Sat, 21 Nov" + " at 5:00 PM IST" */
const when = (s: Slot) => `${formatDate(s.date)} at ${formatTime(s.start_time)} IST`;

export default function BookingForm() {
  const router = useRouter();
  // The Supabase library is loaded in the background (not part of this page's first download)
  const sbRef = useRef<SupabaseClient | null>(null);
  const getSb = async () => (sbRef.current ??= await loadBrowserSupabase());
  const [slots, setSlots] = useState<Slot[] | null>(isSupabaseConfigured ? null : []);
  const [user, setUser] = useState<User | null>(null);
  const [date, setDate] = useState("");
  const [slotId, setSlotId] = useState("");
  // From the "For Parents" page (/book-a-slot?with=parents): note that parents will join.
  // (The form only appears after the slots load in the browser, so reading the address here is safe.)
  const [form, setForm] = useState<Form>(() => ({
    name: "", phone: "", email: "", classYear: "Class 12", expectedMarks: "",
    message: typeof window !== "undefined" && new URLSearchParams(window.location.search).get("with") === "parents" ? parentsPage.buttons.bookingNote : "",
  }));
  const [phase, setPhase] = useState<Phase>("idle");
  const [notice, setNotice] = useState<Notice>(null);
  const [formError, setFormError] = useState("");
  const [credits, setCredits] = useState<Credits | null>(null);
  const [useCredit, setUseCredit] = useState(true);
  // Per date: how many slots exist and how many are free (for "Full" dates); null = not set up yet
  const [calendar, setCalendar] = useState<DayInfo[] | null>(null);
  // The slot that was just taken → offer the closest free times
  const [alternatives, setAlternatives] = useState<Slot[]>([]);

  async function loadSlots(): Promise<Slot[]> {
    const supabase = await getSb();
    if (!supabase) return [];
    // Free any 10-minute holds that ran out, so their slots show again
    await supabase.rpc("release_expired_holds").then(() => undefined, () => undefined);
    const [list, cal, notice] = await Promise.all([
      supabase.from("slots").select("id,date,start_time,end_time,price").eq("is_available", true).gte("date", todayInIndia()).order("date").order("start_time"),
      supabase.rpc("slot_calendar", { p_days: 60 }),
      supabase.rpc("booking_notice_minutes"),
    ]);
    if (list.error) setNotice({ kind: "error", text: "Could not load slots. Please refresh the page." });
    // Slots that start sooner than the notice time can't be booked (the database checks this too)
    const noticeMin = typeof notice.data === "number" ? notice.data : 60;
    const cutoff = Date.now() + noticeMin * 60_000;
    const bookable = ((list.data ?? []) as Slot[]).filter((x) => slotStartsAt(x.date, x.start_time).getTime() > cutoff);
    setCalendar(cal.error ? null : ((cal.data ?? []) as DayInfo[]).map((d) => ({ ...d, date: String(d.date).slice(0, 10) })));
    setSlots(bookable);
    return bookable;
  }

  // Load slots + the logged-in user (pre-fill their details) + any saved draft
  useEffect(() => {
    void getSb().then((supabase) => {
    if (!supabase) return setSlots([]);
    void loadSlots();
    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user);
      let draft: (Form & { date?: string; slotId?: string }) | null = null;
      try {
        draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? "null");
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {
        /* private mode */
      }
      if (draft) {
        setForm((f) => ({ ...f, ...draft }));
        if (draft.date) setDate(draft.date);
        if (draft.slotId) setSlotId(draft.slotId);
      }
      if (!data.user) return;
      // Session credits from a counselling package (checked again on the server)
      fetch("/api/bookings/credits", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { credits?: Credits | null } | null) => setCredits(d?.credits ?? null))
        .catch(() => undefined);
      const { data: p } = await supabase.from("profiles").select("full_name,phone,email").eq("id", data.user.id).maybeSingle();
      setForm((f) => ({
        ...f,
        name: f.name || p?.full_name || "",
        phone: f.phone || (p?.phone ? String(p.phone).replace(/^91/, "") : ""),
        email: f.email || p?.email || data.user?.email || "",
      }));
    });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Razorpay's script is loaded once a slot is picked (so "Pay" opens instantly, but
  // visitors who only look at the page don't download it)
  useEffect(() => {
    if (slotId) void preloadCheckout();
  }, [slotId]);

  // Dates with at least one bookable time (gold) …
  const freeDates = useMemo(() => [...new Set((slots ?? []).map((s) => s.date))], [slots]);
  // … plus fully booked dates in the next 60 days (grey "Full")
  const dates = useMemo(() => {
    const all = new Set(freeDates);
    for (const d of calendar ?? []) if (d.total > 0) all.add(d.date);
    return [...all].sort();
  }, [freeDates, calendar]);
  const isFull = (d: string) => !freeDates.includes(d);
  const activeDate = date && dates.includes(date) ? date : freeDates[0] || dates[0] || "";
  const daySlots = (slots ?? []).filter((s) => s.date === activeDate);
  const nextSlot = (slots ?? [])[0];
  // The first free time AFTER a fully booked date (or the earliest one)
  const nextAfter = (d: string) => (slots ?? []).find((s) => s.date > d) ?? nextSlot;
  const nextFreeDates = (after: string) => freeDates.filter((d) => d > after).slice(0, 3);
  const selected = (slots ?? []).find((s) => s.id === slotId);
  const busy = phase !== "idle";
  const hasCredit = !!credits && (credits.unlimited || credits.remaining > 0);
  const payingWithCredit = hasCredit && useCredit;
  // Price breakdown from the server (coupon, referral ₹ off, reward credit)
  const paid = !!user && !!selected && selected.price > 0 && !payingWithCredit;
  const checkout = useQuote(paid ? { slotId: selected!.id } : null);
  const q = paid ? checkout.quote : null;

  const update = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [e.target.name]: e.target.value });

  async function pay() {
    setNotice(null);
    setFormError("");
    if (!(await getSb())) return setFormError("Booking will work once Supabase is connected.");
    if (!selected) return setFormError("Please choose a date and time first.");
    if (!user) {
      try {
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ ...form, date: activeDate, slotId }));
      } catch {
        /* ignore */
      }
      return router.push("/login?next=/book-a-slot");
    }

    setPhase("creating");
    const res = await postJson("/api/bookings/start", {
      useCredit: payingWithCredit,
      coupon: payingWithCredit ? "" : checkout.code,
      slotId: selected.id,
      name: form.name,
      phone: form.phone,
      email: form.email,
      classYear: form.classYear,
      expectedMarks: form.expectedMarks,
      message: form.message,
    });
    const d = res.data as Record<string, unknown>;

    if (res.status === 401) {
      setPhase("idle");
      return router.push("/login?next=/book-a-slot");
    }
    if (res.status === 409 || d.slotTaken) {
      setPhase("idle");
      setSlotId("");
      const taken = selected;
      const fresh = await loadSlots();
      // The free times closest to the one that was taken
      const target = slotStartsAt(taken.date, taken.start_time).getTime();
      const closest = [...fresh].sort((a, b) => Math.abs(slotStartsAt(a.date, a.start_time).getTime() - target) - Math.abs(slotStartsAt(b.date, b.start_time).getTime() - target)).slice(0, 3);
      setAlternatives(closest);
      const why = /too soon/i.test(String(d.error ?? "")) ? String(d.error) : "This slot was just booked.";
      setNotice({ kind: "taken", text: fresh[0] ? `${why} Next available: ${when(fresh[0])}.` : `${why} ${siteConfig.noSlotsMessage}` });
      return;
    }
    if (!res.ok) {
      setPhase("idle");
      return setNotice({ kind: "error", text: String(d.error ?? "Something went wrong. Please try again.") });
    }
    if (typeof d.redirect === "string") return router.push(d.redirect); // free slot or session credit → booked

    const bookingId = String(d.bookingId);
    setPhase("paying");
    try {
      const result = await openCheckout(d as unknown as Parameters<typeof openCheckout>[0], {
        verifyUrl: "/api/payments/booking-verify",
        timeoutSeconds: Math.max(60, Number(d.holdSeconds ?? 600) - 60), // popup closes before the hold ends
        onVerifying: () => setPhase("verifying"),
      });

      if (result.kind === "paid") return router.push(result.redirect); // 🎉 greeting page
      if (result.kind === "verify_error") return router.push(`/booking-confirmed?id=${bookingId}`); // page re-checks with Razorpay

      // Closed or failed → release the slot right away (server checks Razorpay first)
      const rel = await postJson("/api/bookings/release", { bookingId, reason: result.kind === "failed" ? "failed" : "dismissed" });
      if (rel.data.status === "paid" && typeof rel.data.redirect === "string") return router.push(rel.data.redirect);
      setPhase("idle");
      setNotice({ kind: "retry", text: NOT_COMPLETED + (result.kind === "failed" && result.reason ? ` (${result.reason})` : "") });
      void loadSlots();
    } catch (e) {
      await postJson("/api/bookings/release", { bookingId, reason: "dismissed" });
      setPhase("idle");
      setNotice({ kind: "error", text: (e as Error).message });
      void loadSlots();
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void pay();
  }

  if (slots === null) {
    return <p className="py-16 text-center text-slate-500" aria-busy="true">Loading available slots…</p>;
  }
  // Nothing free in the next 60 days → leave your details (free enquiry form)
  if (slots.length === 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl bg-amber-50 p-5 text-center ring-1 ring-amber-200">
          <p className="text-lg font-extrabold text-amber-950">No free counselling slots right now</p>
          <p className="mt-1 text-sm text-amber-900">{siteConfig.noSlotsMessage}</p>
        </div>
        <div className="card mt-5 p-6 sm:p-8">
          <ContactForm defaultMessage="Please call me when a counselling slot opens." />
        </div>
      </div>
    );
  }

  const price = selected ? formatPrice(selected.price) : "";
  const buttonLabel =
    phase === "creating" ? (
      <><Spinner /> {payingWithCredit ? "Booking your session…" : "Starting secure payment…"}</>
    ) : phase === "paying" ? (
      "Complete payment in the Razorpay window"
    ) : phase === "verifying" ? (
      <><Spinner /> Confirming your payment…</>
    ) : !user ? (
      "Sign In to Book"
    ) : selected ? (
      payingWithCredit ? "Book with 1 Session Credit" : selected.price > 0 ? `Pay ${q ? `₹${q.final.toLocaleString("en-IN")}` : price} & Book Slot` : "Book Free Slot"
    ) : (
      "Choose a time slot"
    );

  return (
    <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-8">
        {nextSlot && (
          <p className="flex flex-wrap items-center gap-2 rounded-2xl bg-accent-400/15 px-4 py-3 text-sm text-slate-800 ring-1 ring-accent-400/40">
            <CalendarIcon className="h-4 w-4 text-accent-700" />
            <span>Next available slot: <strong>{when(nextSlot)}</strong></span>
            {activeDate !== nextSlot.date && (
              <button type="button" onClick={() => { setDate(nextSlot.date); setSlotId(nextSlot.id); setNotice(null); }} className="ml-auto font-bold text-brand-700 underline">Choose it</button>
            )}
          </p>
        )}
        {!user && (
          <div className="flex flex-col gap-3 rounded-2xl bg-brand-50 p-4 ring-1 ring-brand-100 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-sm font-semibold text-brand-800"><UserIcon className="h-4 w-4" /> Please sign in to book a slot — it takes 30 seconds. Your choices are saved.</p>
            <Link href="/login?next=/book-a-slot" className="btn-primary !py-2.5">Sign In / Sign Up</Link>
          </div>
        )}

        {/* Step 1: date */}
        <fieldset disabled={busy}>
          <legend className="text-lg font-extrabold text-slate-900">1. Pick a date</legend>
          <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-2 pt-1">
            {dates.map((d) => {
              const full = isFull(d);
              const on = activeDate === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => { setDate(d); setSlotId(""); setNotice(null); setAlternatives([]); }}
                  aria-pressed={on}
                  aria-label={`${formatDate(d, true)}${full ? " — fully booked" : " — times available"}`}
                  className={`relative shrink-0 rounded-2xl px-4 py-3 text-center ring-1 transition-colors ${
                    on
                      ? full ? "bg-slate-600 text-white ring-slate-600" : "bg-brand-600 text-white ring-brand-600"
                      : full ? "bg-slate-100 text-slate-500 ring-slate-200" : "bg-accent-400/15 text-slate-900 ring-accent-400/60 hover:bg-accent-400/25"
                  }`}
                >
                  <span className="block text-xs font-semibold opacity-80">{formatDate(d).split(",")[0]}</span>
                  <span className="block text-base font-extrabold">{formatDate(d).split(", ")[1]}</span>
                  <span className={`mt-0.5 block text-[10px] font-extrabold uppercase tracking-wider ${on ? "text-white/90" : full ? "text-slate-500" : "text-accent-800"}`}>{full ? "Full" : "Free"}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Step 2: time */}
        <fieldset disabled={busy}>
          <legend className="text-lg font-extrabold text-slate-900">2. Pick a time <span className="text-sm font-semibold text-slate-500">(30 minutes · India time)</span></legend>
          {activeDate && isFull(activeDate) && (
            <div className="mt-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <p className="font-extrabold text-slate-900">Fully booked on {formatDate(activeDate, true)}</p>
              {nextAfter(activeDate) && (
                <>
                  <p className="mt-1 text-sm text-slate-700">Next available: <strong>{formatDate(nextAfter(activeDate)!.date, true)} at {formatTime(nextAfter(activeDate)!.start_time)} IST</strong></p>
                  <button type="button" onClick={() => { const n = nextAfter(activeDate)!; setDate(n.date); setSlotId(n.id); }} className="btn-primary mt-3 !py-2.5 text-sm">
                    Go to {formatDate(nextAfter(activeDate)!.date)}
                  </button>
                  {nextFreeDates(activeDate).length > 0 && (
                    <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                      Other free dates:
                      {nextFreeDates(activeDate).map((d) => (
                        <button key={d} type="button" onClick={() => { setDate(d); setSlotId(""); }} className="min-h-11 rounded-full bg-accent-400/15 px-3 py-1 font-bold text-slate-900 ring-1 ring-accent-400/60">{formatDate(d)}</button>
                      ))}
                    </p>
                  )}
                </>
              )}
            </div>
          )}
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {daySlots.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => { setSlotId(s.id); setFormError(""); if (notice?.kind === "taken") setNotice(null); }}
                aria-pressed={slotId === s.id}
                className={`rounded-xl px-2 py-3 text-sm font-semibold ring-1 transition ${slotId === s.id ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-slate-700 ring-slate-300 hover:ring-brand-400"}`}
              >
                {formatTime(s.start_time)} – {formatTime(s.end_time)}
                <span className="block text-xs opacity-75">IST · {formatPrice(s.price)}</span>
              </button>
            ))}
          </div>
        </fieldset>

        {/* Step 3: details */}
        <fieldset disabled={busy}>
          <legend className="text-lg font-extrabold text-slate-900">3. Your details</legend>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Student name *" htmlFor="name">
              <input id="name" name="name" required minLength={2} maxLength={80} value={form.name} onChange={update} className="input" autoComplete="name" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Number we should call you on *" htmlFor="phone">
                <input id="phone" name="phone" type="tel" inputMode="numeric" required pattern="(\+?91[ \-]?|0)?[6-9][0-9]{4}[ \-]?[0-9]{5}" maxLength={16} value={form.phone} onChange={update} className="input" autoComplete="tel-national" placeholder="10-digit mobile, e.g. 98765 43210" aria-describedby="phone-note" />
              </Field>
              <p id="phone-note" className="mt-1.5 flex items-start gap-1.5 text-sm text-slate-600">
                <PhoneIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                You will receive a call on this number at your booked time. Please keep your phone available.
              </p>
            </div>
            <Field label="Email (for invoice)" htmlFor="email">
              <input id="email" name="email" type="email" maxLength={120} value={form.email} onChange={update} className="input" autoComplete="email" />
            </Field>
            <Field label="Class / Year" htmlFor="classYear">
              <select id="classYear" name="classYear" value={form.classYear} onChange={update} className="input">
                {CLASS_YEARS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Expected VITEEE marks (out of 125)" htmlFor="expectedMarks">
              <input id="expectedMarks" name="expectedMarks" type="number" inputMode="decimal" min={0} max={125} step={0.5} value={form.expectedMarks} onChange={update} className="input" placeholder="e.g. 85" />
            </Field>
            <Field label="Message" htmlFor="message">
              <textarea id="message" name="message" rows={1} maxLength={1000} value={form.message} onChange={update} className="input" placeholder="e.g. Want CSE at Vellore, rank ~15,000" />
            </Field>
          </div>
        </fieldset>
      </div>

      {/* Summary + pay */}
      <aside>
        <div className="card p-6 shadow-xl shadow-slate-200/70 lg:sticky lg:top-24">
          <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">Booking summary</p>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Session</dt><dd className="text-right font-semibold text-slate-900">30-minute voice call</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Date</dt><dd className="font-semibold text-slate-900">{selected ? formatDate(selected.date) : "—"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Time</dt><dd className="font-semibold text-slate-900">{selected ? `${formatTime(selected.start_time)} – ${formatTime(selected.end_time)} IST` : "—"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-500">We call you on</dt><dd className="text-right font-semibold text-slate-900">{form.phone.trim() || "—"}</dd></div>
          </dl>
          {hasCredit && (
            <div className="mt-5 rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
              <p className="flex items-center gap-1.5 text-sm font-extrabold text-emerald-800">
                <CheckIcon className="h-4 w-4" /> {credits!.unlimited ? "Unlimited sessions (until admission)" : `Sessions left: ${credits!.remaining} of ${credits!.total}`}
              </p>
              <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-emerald-900">
                <input type="checkbox" checked={useCredit} onChange={(e) => setUseCredit(e.target.checked)} className="h-4 w-4 accent-emerald-600" />
                Use 1 session credit from my package
              </label>
            </div>
          )}
          {q ? (
            <div className="mt-5 space-y-4 border-t border-slate-100 pt-5">
              <CouponBox applied={checkout.code} error={checkout.couponError} loading={checkout.loading} onApply={checkout.apply} onRemove={checkout.remove} disabled={busy} />
              <PriceBreakdown q={q} />
            </div>
          ) : (
            <div className="mt-5 flex items-baseline justify-between border-t border-slate-100 pt-5">
              <span className="font-semibold text-slate-700">Total</span>
              <span className="text-3xl font-extrabold text-slate-900">{selected ? (payingWithCredit ? "₹0" : price) : "—"}</span>
            </div>
          )}
          {payingWithCredit && <p className="mt-1 text-right text-xs font-semibold text-emerald-700">1 session credit · no payment needed</p>}

          {notice && (
            <div role="alert" className={`mt-4 rounded-xl p-3 text-sm ring-1 ${notice.kind === "taken" ? "bg-amber-50 text-amber-900 ring-amber-200" : "bg-red-50 text-red-800 ring-red-200"}`}>
              <p className="font-semibold">{notice.text}</p>
              {notice.kind === "taken" && alternatives.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {alternatives.map((a) => (
                    <button key={a.id} type="button" onClick={() => { setDate(a.date); setSlotId(a.id); setNotice(null); setAlternatives([]); }} className="min-h-11 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-brand-700 ring-1 ring-brand-200">
                      {formatDate(a.date)}, {formatTime(a.start_time)}
                    </button>
                  ))}
                </div>
              )}
              {notice.kind !== "taken" && selected && (
                <button type="button" onClick={() => void pay()} className="mt-2 font-bold text-brand-700 underline">Try Again</button>
              )}
            </div>
          )}
          {formError && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200">{formError}</p>}

          <button type="submit" disabled={busy || (!!user && !selected)} className="btn-accent mt-5 w-full !py-3.5 text-base disabled:cursor-not-allowed disabled:opacity-70">
            {buttonLabel}
          </button>
          {payingWithCredit ? (
            <p className="mt-3 text-center text-xs font-semibold text-slate-500">Your session is confirmed straight away.</p>
          ) : (
            <>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs font-semibold text-slate-500">
                <ShieldIcon className="h-3.5 w-3.5 text-emerald-600" /> 100% Secure Payments by Razorpay
              </p>
              <p className="mt-1 flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-500">
                <LockIcon className="h-3 w-3" /> Your slot is booked only after the payment succeeds.
              </p>
              {user && !hasCredit && (
                <p className="mt-2 text-center text-xs text-slate-500">
                  Need more than one session? <a href="#packages" className="font-semibold text-brand-700 underline">Save with a package</a>
                </p>
              )}
            </>
          )}
          <RefundNote kind="counselling" className="mt-3 border-t border-slate-100 pt-3" />
        </div>
      </aside>
    </form>
  );
}
