/** Green "FREE" pill shown on every free item (cards, My Courses, admin). */
export default function FreeBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full bg-emerald-500 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-white shadow-sm ${className}`}>
      Free
    </span>
  );
}
