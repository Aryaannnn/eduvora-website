import { founder, type FounderHighlightIcon } from "@/content/founder";
import { CalendarIcon, GraduationIcon, UsersIcon } from "./Icons";

const icons: Record<FounderHighlightIcon, typeof UsersIcon> = {
  students: UsersIcon,
  years: CalendarIcon,
  college: GraduationIcon,
};

// "1,000+ Students Guided" · "2+ Years of Counselling" · "VIT Vellore, Mechanical Engineering"
export default function FounderHighlights({ className = "" }: { className?: string }) {
  return (
    <ul className={`grid gap-3 sm:grid-cols-3 ${className}`}>
      {founder.highlights.map((h) => {
        const Icon = icons[h.icon];
        return (
          <li key={h.label} className="flex items-center gap-3 rounded-2xl bg-white p-3.5 text-sm font-bold leading-snug text-brand-700 shadow-sm ring-1 ring-slate-200 sm:flex-col sm:items-start sm:p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-400 text-brand-950"><Icon className="h-5 w-5" /></span>
            {h.label}
          </li>
        );
      })}
    </ul>
  );
}
