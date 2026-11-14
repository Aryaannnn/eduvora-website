"use client";

import MobileViewAll, { hideOnPhone } from "../MobileViewAll";
import { useState } from "react";
import { initials } from "@/lib/format";
import type { Review } from "@/lib/types";
import EmptyState from "../EmptyState";
import Reveal from "../Reveal";
import SectionHeading from "../SectionHeading";
import Stars from "../Stars";
import { CheckIcon } from "../Icons";

const tabs: { id: Review["type"]; label: string }[] = [
  { id: "student", label: "Student Reviews" },
  { id: "parent", label: "Parent Reviews" },
];

// Reviews come from Supabase (only approved ones are shown)
/** mobileShort: on phones show only 3 reviews + "View all reviews" (home page) */
export default function ReviewsSection({ reviews, showHeading = true, mobileShort = false, showSummary = true }: { reviews: Review[]; showHeading?: boolean; mobileShort?: boolean; showSummary?: boolean }) {
  const [tab, setTab] = useState<Review["type"]>("student");
  const list = reviews.filter((r) => r.type === tab);
  const avg = reviews.length ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10 : 0;

  return (
    <section className="section">
      <div className="container-page">
        {showHeading && (
          <SectionHeading center eyebrow="Reviews" title="Loved by students & parents" subtitle="Real feedback from the families we have guided." />
        )}

        {reviews.length === 0 ? (
          <div className="mx-auto mt-10 max-w-xl"><EmptyState what="reviews" /></div>
        ) : (
          <>
            {showSummary && <Reveal className="mx-auto mt-10 flex max-w-md flex-col items-center gap-2 rounded-3xl bg-gradient-to-br from-accent-100 to-white p-6 text-center ring-1 ring-accent-300/50">
              <p className="text-5xl font-extrabold text-slate-900">{avg.toFixed(1)}<span className="text-2xl text-slate-400">/5</span></p>
              <Stars rating={avg} className="h-6 w-6" />
              <p className="text-sm text-slate-600">Average rating from {reviews.length} review{reviews.length === 1 ? "" : "s"}</p>
            </Reveal>}

            <div className="mt-10 flex justify-center">
              <div role="tablist" aria-label="Review type" className="inline-flex rounded-2xl bg-slate-100 p-1.5">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    role="tab"
                    type="button"
                    id={`tab-${t.id}`}
                    aria-selected={tab === t.id}
                    aria-controls="review-panel"
                    onClick={() => setTab(t.id)}
                    className={`rounded-xl px-4 py-2.5 text-sm font-bold transition sm:px-6 ${
                      tab === t.id ? "bg-white text-brand-700 shadow" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div id="review-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="mt-8 grid gap-5 md:grid-cols-3">
              {list.length === 0 && <p className="text-center text-slate-500 md:col-span-3">No {tab} reviews yet.</p>}
              {list.map((r, i) => (
                <figure key={r.id} style={{ animationDelay: `${i * 90}ms` }} className={`card animate-fade-up flex flex-col p-6 ${mobileShort ? hideOnPhone(i, "md") : ""}`}>
                  <div className="flex items-center gap-3">
                    {r.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.photo_url} alt="" width={48} height={48} loading="lazy" decoding="async" className="h-12 w-12 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full font-bold text-white ${tab === "student" ? "bg-gradient-to-br from-brand-500 to-brand-700" : "bg-gradient-to-br from-accent-400 to-accent-600"}`}>
                        {initials(r.name)}
                      </span>
                    )}
                    <figcaption className="min-w-0">
                      <p className="font-bold text-slate-900">{r.name}</p>
                      <p className="text-xs capitalize text-slate-500">{r.type}</p>
                    </figcaption>
                    {r.is_verified && (
                      <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200" title="Written by a student who paid for counselling, a course or material">
                        <CheckIcon className="h-3.5 w-3.5" /> Verified Student
                      </span>
                    )}
                  </div>
                  <div className="mt-4"><Stars rating={r.rating} /></div>
                  <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-slate-700">&ldquo;{r.comment}&rdquo;</blockquote>
                </figure>
              ))}
            </div>
            {mobileShort && <MobileViewAll total={list.length} href="/reviews" label="View all reviews" bp="md" />}
          </>
        )}
      </div>
    </section>
  );
}
