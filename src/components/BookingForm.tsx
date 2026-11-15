"use client";

// =====================================================================
//  BOOK A COUNSELLING SLOT — pay first, then booked
//   1. Pick a date + time in the slot picker (only real 30-minute slots)
//   2. Your details
//   → "Pay ₹499 & Book Slot" opens Razorpay straight away.
//   Behind the scenes the server holds the slot for 10 minutes so nobody
//   else can pay for it. Only after the payment is VERIFIED is it booked
//   (then the student sees the greeting page).
//   Popup closed / payment failed → slot released, friendly message, form
//   kept so they can try again with one click.
//   Students with package SESSION CREDITS book with one credit instead
//   (no payment) — "Sessions left: 2 of 3" is shown in the summary.
//   Every slot is a 30-minute VOICE CALL: Utkarsh Sir calls the student on the
//   number they enter here. The slot picker (components/booking/SlotPicker.tsx)
//   shows free and booked slots from the server, refreshed every minute; slots
//   starting within the notice time (Admin → Settings) are not shown. The slot is
//   checked again on the server when paying. All times are India time (IST).
// =====================================================================
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { formatDate, formatPrice } from "@/lib/format";
import { openCheckout, postJson, preloadCheckout } from "@/lib/razorpay-checkout";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadBrowserSupabase } from "@/lib/supabase/lazy";
import type { SlotBoard } from "@/lib/slot-board";
import { Spinner } from "./Spinner";
import { Field } from "./ContactForm";
import { parentsPage } from "@/content/parents";
import SlotPicker, { slotRange, useSlotBoard } from "./booking/SlotPicker";
import RefundNote from "./RefundNote";
import { CheckIcon, LockIcon, PhoneIcon, ShieldIcon, UserIcon } from "./Icons";
import { CouponBox, PriceBreakdown, useQuote } from "./checkout/Checkout";

type Credits = { total: number; used: number; remaining: number; unlimited: boolean };

const CLASS_YEARS = ["Class 11", "Class 12", "Dropper / Repeater", "Parent", "Other"];
const DRAFT_KEY = "eduvora-booking-draft";
const NOT_COMPLETED = "Payment not completed. Your slot was not booked. Please try again.";

type Form = { name: string; phone: string; email: string; classYear: string; expectedMarks: string; message: string };
type Phase = "idle" | "creating" | "paying" | "verifying";
type Notice = { kind: "retry" | "taken" | "error"; text: string } | null;
export default function BookingForm({ initialBoard }: { initialBoard: SlotBoard }) {
  const router = useRouter();
  const params = useSearchParams();
  // The Supabase library is loaded in the background (not part of this page's first download)
  const sbRef = useRef<SupabaseClient | null>(null);
  const getSb = async () => (sbRef.current ??= await loadBrowserSupabase());
  // Free + booked slots from the server, refreshed every minute
  const [board, refreshBoard] = useSlotBoard(initialBoard);
  const [user, setUser] = useState<User | null>(null);
  // ?slot=<id> → a time tapped on the home page is chosen straight away
  const [slotId, setSlotId] = useState(() => params.get("slot") ?? "");
  // From the "For Parents" page (/book-a-slot?with=parents): note that parents will join.
  const [form, setForm] = useState<Form>(() => ({
    name: "", phone: "", email: "", classYear: "Class 12", expectedMarks: "",
    message: params.get("with") === "parents" ? parentsPage.buttons.bookingNote : "",
  }));
  const detailsRef = useRef<HTMLFieldSetElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [notice, setNotice] = useState<Notice>(null);
  const [formError, setFormError] = useState("");
  const [credits, setCredits] = useState<Credits | null>(null);
  const [useCredit, setUseCredit] = useState(true);

  // The logged-in user (pre-fill their details) + any saved draft
  useEffect(() => {
    void getSb().then((supabase) => {
    if (!supabase) return;
    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user);
      let draft: (Form & { slotId?: string }) | null = null;
      try {
        draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? "null");
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {
        /* private mode */
      }
      if (draft) {
        const { slotId: savedSlot, ...fields } = draft;
        setForm((f) => ({ ...f, ...fields }));
        if (savedSlot) setSlotId(savedSlot);
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
  }, []);

  // Came from a time on the home page → show the details form
  useEffect(() => {
    if (params.get("slot")) setTimeout(() => detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Razorpay's script is loaded once a slot is picked (so "Pay" opens instantly, but
  // visitors who only look at the page don't download it)
  useEffect(() => {
    if (slotId) void preloadCheckout();
  }, [slotId]);

  // The chosen slot — only while it is still free (the list refreshes every minute)
  const selected = board.slots.find((s) => s.id === slotId && !s.booked);
  const lostSlot = !!slotId && !selected && board.slots.some((s) => s.id === slotId); // booked by someone else meanwhile
  const hasFree = board.slots.some((s) => !s.booked);
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
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ ...form, slotId }));
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
      // Checked on the server: someone else got this slot first (or it starts too soon)
      setPhase("idle");
      setSlotId("");
      void refreshBoard();
      const why = /too soon/i.test(String(d.error ?? "")) ? String(d.error) : "This time was just booked by another student.";
      setNotice({ kind: "taken", text: `${why} Please choose another time.` });
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
      void refreshBoard();
    } catch (e) {
      await postJson("/api/bookings/release", { bookingId, reason: "dismissed" });
      setPhase("idle");
      setNotice({ kind: "error", text: (e as Error).message });
      void refreshBoard();
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void pay();
  }

  // No free slot in the next 60 days → only "New slots open soon" (no form)
  if (!hasFree) return <SlotPicker board={board} mode="select" className="mx-auto max-w-2xl" />;

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
      <div className="min-w-0 space-y-8">
        {!user && (
          <div className="flex flex-col gap-3 rounded-2xl bg-brand-50 p-4 ring-1 ring-brand-100 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-sm font-semibold text-brand-800"><UserIcon className="h-4 w-4" /> Please sign in to book a slot — it takes 30 seconds. Your choices are saved.</p>
            <Link href="/login?next=/book-a-slot" className="btn-primary !py-2.5">Sign In / Sign Up</Link>
          </div>
        )}

        {/* Step 1: date + time (only real 30-minute slots) */}
        {/* min-w-0: a fieldset is as wide as its content by default — this lets the date strip scroll on phones */}
        <fieldset disabled={busy} className="min-w-0">
          <legend className="mb-3 text-lg font-extrabold text-slate-900">1. Pick a date and time</legend>
          <SlotPicker
            board={board}
            mode="select"
            selectedId={selected?.id ?? ""}
            onSelect={(s) => {
              setSlotId(s.id);
              setFormError("");
              if (notice?.kind === "taken") setNotice(null);
              // Phones: bring the details form into view
              const box = detailsRef.current?.getBoundingClientRect();
              if (box && box.top > window.innerHeight - 120) detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          />
          {lostSlot && <p role="alert" className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 ring-1 ring-amber-200">The time you chose was just booked by another student. Please choose another time.</p>}
        </fieldset>

        {/* Step 2: details */}
        <fieldset ref={detailsRef} disabled={busy} className="scroll-mt-24">
          <legend className="text-lg font-extrabold text-slate-900">2. Your details</legend>
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
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Time</dt><dd className="font-semibold text-slate-900">{selected ? `${slotRange(selected.start_time, selected.end_time)} IST` : "—"}</dd></div>
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
