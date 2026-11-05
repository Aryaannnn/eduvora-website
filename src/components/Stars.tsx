import { StarIcon } from "./Icons";

export default function Stars({ rating, className = "h-4 w-4" }: { rating: number; className?: string }) {
  const full = Math.round(rating);
  return (
    <span className="inline-flex gap-0.5" role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <StarIcon key={i} className={`${className} ${i <= full ? "text-accent-500" : "text-slate-300"}`} />
      ))}
    </span>
  );
}
