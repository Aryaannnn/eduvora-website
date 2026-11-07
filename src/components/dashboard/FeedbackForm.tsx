"use client";

// Post-session feedback form — used on /dashboard/feedback (email link)
// and inside My Bookings for completed sessions.
import Link from "next/link";
import { useActionState, useState } from "react";
import { submitFeedback, type FeedbackState } from "@/lib/feedback-actions";

export type MyFeedback = { rating: number; helped_most: string | null; improve: string | null; allow_public: boolean };

const LABELS = ["", "Poor", "Okay", "Good", "Very good", "Excellent"];

export default function FeedbackForm({ bookingId, initial, startRating }: { bookingId: string; initial?: MyFeedback | null; startRating?: number }) {
  const [state, action, pending] = useActionState<FeedbackState, FormData>(submitFeedback, null);
  const [rating, setRating] = useState(initial?.rating ?? (startRating && startRating >= 1 && startRating <= 5 ? startRating : 0));
  const [hover, setHover] = useState(0);
  const shown = hover || rating;
  const id = bookingId.slice(0, 8);

  if (state?.ok) {
    return (
      <div className="rounded-2xl bg-emerald-50 p-5 text-center ring-1 ring-emerald-200" role="status">
        <p className="text-lg font-extrabold text-emerald-800">{state.message}</p>
        <p className="mt-2 text-sm text-slate-600">
          Questions after your session? <Link href="/dashboard/help" className="font-semibold text-brand-700 underline">We&apos;re here to help</Link>.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="booking_id" value={bookingId} />
      <input type="hidden" name="rating" value={rating || ""} />

      <fieldset>
        <legend className="text-sm font-bold text-slate-800">How would you rate your session? <span className="text-red-600">*</span></legend>
        <div className="mt-2 flex items-center gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              aria-label={`${n} star${n === 1 ? "" : "s"} — ${LABELS[n]}`}
              aria-pressed={rating === n}
              className={`text-4xl leading-none transition hover:scale-110 ${n <= shown ? "text-amber-400" : "text-slate-300"}`}
            >
              ★
            </button>
          ))}
          <span className="ml-2 text-sm font-semibold text-slate-600" aria-live="polite">{shown ? LABELS[shown] : "Tap a star"}</span>
        </div>
      </fieldset>

      <div>
        <label htmlFor={`fb-helped-${id}`} className="text-sm font-bold text-slate-800">What helped you most?</label>
        <textarea id={`fb-helped-${id}`} name="helped_most" rows={3} maxLength={1000} defaultValue={initial?.helped_most ?? ""} className="input mt-1" placeholder="e.g. the campus and branch plan for my rank, the fee category advice…" />
      </div>
      <div>
        <label htmlFor={`fb-improve-${id}`} className="text-sm font-bold text-slate-800">What can we improve?</label>
        <textarea id={`fb-improve-${id}`} name="improve" rows={3} maxLength={1000} defaultValue={initial?.improve ?? ""} className="input mt-1" placeholder="Anything we could do better (only our team sees this)" />
      </div>

      <label className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700 ring-1 ring-slate-200">
        <input type="checkbox" name="allow_public" defaultChecked={initial?.allow_public ?? false} className="mt-0.5 h-4 w-4 accent-brand-600" />
        <span>
          <strong>You can show my feedback as a review on the website.</strong>
          <span className="block text-xs text-slate-500">Only your first name, rating and &ldquo;What helped you most?&rdquo; would be shown. &ldquo;What can we improve?&rdquo; is never shown.</span>
        </span>
      </label>

      {state && !state.ok && <p role="alert" className="text-sm font-semibold text-red-600">{state.message}</p>}
      <button type="submit" disabled={pending || !rating} className="btn-primary w-full disabled:opacity-50 sm:w-auto">
        {pending ? "Sending…" : initial ? "Update feedback" : "Send feedback"}
      </button>
    </form>
  );
}
