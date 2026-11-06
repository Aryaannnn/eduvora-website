"use client";

import { useActionState, useState } from "react";
import { submitMyReview, type ReviewState } from "@/lib/review-actions";
import { CheckIcon, StarIcon } from "../Icons";

type Initial = { name: string; type: "student" | "parent"; rating: number; comment: string };

export default function ReviewForm({ initial, editing }: { initial: Initial; editing: boolean }) {
  const [state, action, pending] = useActionState<ReviewState, FormData>(submitMyReview, null);
  const [rating, setRating] = useState(initial.rating);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState(initial.comment);

  if (state?.ok) {
    return (
      <div className="py-6 text-center" role="status">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-500 text-white"><CheckIcon className="h-7 w-7" /></span>
        <p className="mt-4 font-bold text-emerald-800">{state.message}</p>
      </div>
    );
  }

  const labels = ["", "Poor", "Okay", "Good", "Very good", "Excellent"];
  const shown = hover || rating;

  return (
    <form action={action} className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-slate-700">I am a *</legend>
        <div className="flex gap-3">
          {(["student", "parent"] as const).map((t) => (
            <label key={t} className="flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2.5 ring-1 ring-slate-300 has-[:checked]:bg-brand-50 has-[:checked]:ring-2 has-[:checked]:ring-brand-600">
              <input type="radio" name="type" value={t} defaultChecked={initial.type === t} className="accent-brand-600" />
              <span className="font-semibold capitalize text-slate-800">{t}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-slate-700">Your rating *</legend>
        <input type="hidden" name="rating" value={rating || ""} />
        <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
              aria-pressed={rating === n}
              className="rounded-lg p-1 transition hover:scale-110"
            >
              <StarIcon className={`h-8 w-8 ${n <= shown ? "fill-accent-400 text-accent-400" : "fill-slate-200 text-slate-200"}`} />
            </button>
          ))}
          <span className="ml-2 text-sm font-semibold text-slate-600">{labels[shown]}</span>
        </div>
      </fieldset>

      <div>
        <label htmlFor="rv-comment" className="mb-1.5 block text-sm font-semibold text-slate-700">Your review *</label>
        <textarea
          id="rv-comment"
          name="comment"
          rows={5}
          required
          minLength={20}
          maxLength={1000}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="input"
          placeholder="How did the counselling / course / material help you? What did you like?"
        />
        <p className={`mt-1 text-right text-xs ${comment.trim().length < 20 ? "text-slate-400" : "text-emerald-600"}`}>{comment.trim().length}/1000 (at least 20)</p>
      </div>

      <div>
        <label htmlFor="rv-name" className="mb-1.5 block text-sm font-semibold text-slate-700">Name to show with your review *</label>
        <input id="rv-name" name="name" required minLength={2} maxLength={60} defaultValue={initial.name} className="input" placeholder="e.g. Rahul S." autoComplete="name" />
        <p className="mt-1 text-xs text-slate-500">Tip: you can use just your first name and initial.</p>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-700 ring-1 ring-slate-200">
        <input type="checkbox" name="consent" required className="mt-0.5 h-4 w-4 accent-brand-600" />
        <span>I allow EDUVORA to show my review on the website.</span>
      </label>

      {state && !state.ok && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-200">{state.message}</p>}

      <button type="submit" disabled={pending || !rating} className="btn-primary w-full !py-3.5 text-base disabled:opacity-60">
        {pending ? "Sending…" : editing ? "Update my review" : "Submit review"}
      </button>
      <p className="text-center text-xs text-slate-500">Your review is checked by our team before it appears on the website.</p>
    </form>
  );
}
