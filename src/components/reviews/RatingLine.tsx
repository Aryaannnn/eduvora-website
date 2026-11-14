import Link from "next/link";
import { getReviewSummary } from "@/lib/data";
import Stars from "../Stars";

// "★★★★★ Rating: 4.8/5 from 23 reviews" — near the Buy / Book buttons.
// Real, approved reviews only, and only once there are at least 5 of them.
export const MIN_REVIEWS_FOR_RATING = 5;

export default async function RatingLine({ className = "", tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  const { avg, count } = await getReviewSummary();
  if (count < MIN_REVIEWS_FOR_RATING) return null;
  return (
    <Link href="/reviews" className={`flex items-center justify-center gap-1.5 text-xs font-semibold hover:underline ${tone === "dark" ? "text-slate-200" : "text-slate-600"} ${className}`}>
      <Stars rating={avg} className="h-3.5 w-3.5" />
      <span>Rating: <strong className={tone === "dark" ? "text-white" : "text-slate-900"}>{avg.toFixed(1)}/5</strong> from {count} reviews</span>
    </Link>
  );
}
