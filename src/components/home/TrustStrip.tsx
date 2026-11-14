import { getSiteStats } from "@/lib/data";
import { GraduationIcon, HeadsetIcon, ShieldIcon, UsersIcon } from "../Icons";

// Thin strip right under the slideshow:
// "1,000+ students guided • Guided by a current VIT student • Secure payments by Razorpay • Parents welcome on calls"
// ✏️ The number comes from Admin → Settings → "Our results" (the stat whose label
//    mentions "student", e.g. "Students guided" = 1000 + "+"). Empty number → that item is hidden.
export default async function TrustStrip() {
  const stats = await getSiteStats();
  const students = stats.find((s) => /student/i.test(s.label));
  const items = [
    ...(students?.value != null
      ? [{ icon: UsersIcon, text: `${Number(students.value).toLocaleString("en-IN")}${students.suffix ?? ""} ${students.label.toLowerCase()}` }]
      : []),
    { icon: GraduationIcon, text: "Guided by a current VIT student" },
    { icon: ShieldIcon, text: "Secure payments by Razorpay" },
    { icon: HeadsetIcon, text: "Parents welcome on calls" },
  ];
  return (
    <section aria-label="Why families trust EDUVORA" className="border-b border-slate-200 bg-white">
      <ul className="container-page grid grid-cols-2 gap-x-3 gap-y-3 py-4 sm:py-5 lg:flex lg:items-center lg:justify-between lg:gap-6">
        {items.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-2.5 text-[13px] font-bold leading-snug text-slate-800 sm:text-sm">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-400/15 text-accent-700 ring-1 ring-accent-400/30">
              <Icon className="h-[18px] w-[18px]" />
            </span>
            {text}
          </li>
        ))}
      </ul>
    </section>
  );
}
