import Link from "next/link";
import { durationBadge, isFormulaBook } from "@/lib/courses";
import type { FileSummary } from "@/lib/file-summary";
import { discountPercent, formatPrice } from "@/lib/format";
import type { Product } from "@/lib/types";
import BuyButton, { SecurePaymentNote } from "../BuyButton";
import { SUBJECT_KEYS, SUBJECT_UI } from "../courses/SubjectIcon";
import FreeBadge from "../FreeBadge";
import { StarIcon } from "../Icons";

// One crash course card: duration badge · name · short description · Physics /
// Chemistry / Mathematics with their PDF counts · price · Details + Enroll Now.
// Compact enough for TWO cards side by side on a phone.
export default function CourseCard({ course, files }: { course: Product; files?: FileSummary | null }) {
  const d = course.details;
  const popular = d.popular === true;
  const free = course.is_free || course.price <= 0;
  const hasOriginal = !!course.original_price && course.original_price > course.price;
  const off = hasOriginal ? discountPercent(course.price, course.original_price) : 0;
  const badge = durationBadge(course.slug, d.duration);

  return (
    <article className={`card card-hover relative flex h-full flex-col overflow-hidden ${popular ? "ring-2 ring-accent-400" : ""}`}>
      <div className="relative bg-gradient-to-br from-brand-800 to-brand-600 p-3 text-white sm:p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          {badge && <span className="rounded-full bg-accent-400 px-2 py-0.5 text-[11px] font-extrabold text-brand-950 sm:px-2.5 sm:text-xs">{badge}</span>}
          {popular && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-brand-800 sm:text-[11px]">
              <StarIcon className="h-3 w-3 text-accent-500" /> Most Popular
            </span>
          )}
          {free && <FreeBadge />}
        </div>
        <h3 className="mt-2.5 text-sm font-extrabold leading-snug sm:text-lg">
          <Link href={`/courses/${course.slug}`} className="hover:underline">{course.title}</Link>
        </h3>
      </div>

      <div className="flex flex-1 flex-col p-3 sm:p-5">
        {(d.short ?? course.description) && <p className="text-xs leading-relaxed text-slate-600 sm:text-sm">{d.short ?? course.description}</p>}

        <ul className="mt-3 space-y-1.5" aria-label="Subjects">
          {SUBJECT_KEYS.map((k) => {
            const ui = SUBJECT_UI[k];
            const n = files?.bySubject[k] ?? 0;
            return (
              <li key={k} className={`flex items-center justify-between gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold ring-1 sm:text-xs ${ui.chip}`}>
                <span className="flex min-w-0 items-center gap-1.5"><ui.Icon className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{ui.label}</span></span>
                <span className="shrink-0 tabular-nums">{n ? `${n} PDF${n === 1 ? "" : "s"}` : "Soon"}</span>
              </li>
            );
          })}
        </ul>

        <div className="mt-auto pt-4">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-t border-slate-100 pt-3">
            <span className="text-xl font-extrabold text-slate-900 sm:text-2xl">{free ? "Free" : formatPrice(course.price)}</span>
            {hasOriginal && <span className="text-xs text-slate-500 line-through sm:text-sm">{formatPrice(course.original_price!)}</span>}
            {off > 0 && <span className="rounded-md bg-green-100 px-1.5 py-0.5 text-[11px] font-bold text-green-700">{off}% off</span>}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Link href={`/courses/${course.slug}`} className="btn-light !px-2 !py-2 text-xs sm:text-sm">Details</Link>
            <BuyButton productId={course.id} label={free ? (isFormulaBook(course.slug) ? "Get it Free" : "Enroll Free") : isFormulaBook(course.slug) ? "Buy Now" : "Enroll Now"} className="btn-primary w-full !px-2 !py-2 text-xs sm:text-sm" trust={false} free={course.is_free} />
          </div>
          {!free && <SecurePaymentNote className="mt-2.5" refundKind="digital" />}
        </div>
      </div>
    </article>
  );
}
