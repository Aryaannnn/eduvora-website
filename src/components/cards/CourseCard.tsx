import Link from "next/link";
import { discountPercent, formatPrice } from "@/lib/format";
import type { Product } from "@/lib/types";
import BuyButton, { SecurePaymentNote } from "../BuyButton";
import { CalendarIcon, CheckIcon, ClockIcon, MonitorIcon } from "../Icons";

export default function CourseCard({ course }: { course: Product }) {
  const d = course.details;
  const off = discountPercent(course.price, course.original_price);
  const chips = [
    d.duration && { icon: ClockIcon, text: d.duration },
    d.mode && { icon: MonitorIcon, text: d.mode },
    d.start_date && { icon: CalendarIcon, text: d.start_date },
  ].filter(Boolean) as { icon: typeof ClockIcon; text: string }[];

  return (
    <article className="card card-hover relative flex h-full flex-col p-6">
      {d.badge && (
        <span className="absolute -top-3 right-5 rounded-full bg-accent-400 px-3 py-1 text-xs font-bold text-slate-900 shadow">{d.badge}</span>
      )}
      <h3 className="text-xl font-extrabold text-slate-900">
        <Link href={`/courses/${course.slug}`} className="hover:text-brand-700">{course.title}</Link>
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{d.short ?? course.description}</p>

      {chips.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-700">
          {chips.map((c) => (
            <span key={c.text} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1"><c.icon className="h-3.5 w-3.5" />{c.text}</span>
          ))}
        </div>
      )}

      {d.features && (
        <ul className="mt-5 space-y-2 text-sm text-slate-700">
          {d.features.map((f) => (
            <li key={f} className="flex items-start gap-2"><CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />{f}</li>
          ))}
        </ul>
      )}

      <div className="mt-auto pt-6">
        <div className="flex items-baseline gap-2 border-t border-slate-100 pt-5">
          <span className="text-3xl font-extrabold text-slate-900">{formatPrice(course.price)}</span>
          {course.original_price && <span className="text-sm text-slate-400 line-through">{formatPrice(course.original_price)}</span>}
          {off > 0 && <span className="rounded-md bg-green-100 px-1.5 py-0.5 text-xs font-bold text-green-700">{off}% off</span>}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link href={`/courses/${course.slug}`} className="btn-light !px-3">Details</Link>
          <BuyButton productId={course.id} label={course.price > 0 ? "Enroll Now" : "Enroll Free"} className="btn-primary w-full !px-3" trust={false} />
        </div>
        {course.price > 0 && <SecurePaymentNote className="mt-3" />}
      </div>
    </article>
  );
}
