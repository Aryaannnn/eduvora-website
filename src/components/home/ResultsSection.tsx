import { getSiteStats } from "@/lib/data";
import CountUp from "../CountUp";
import { AwardIcon, GraduationIcon, ShieldIcon, UsersIcon } from "../Icons";
import Reveal from "../Reveal";
import SectionHeading from "../SectionHeading";

const icons = [UsersIcon, GraduationIcon, AwardIcon, ShieldIcon];

// Numbers come from the database — edit them in Admin → Settings.
// Empty numbers are hidden; with no numbers at all the whole section is hidden.
export default async function ResultsSection() {
  const stats = await getSiteStats();
  if (stats.length === 0) return null;
  const cols = stats.length === 1 ? "lg:grid-cols-1 max-w-xs mx-auto" : stats.length === 2 ? "lg:grid-cols-2 max-w-2xl mx-auto" : stats.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4";
  return (
    <section className="section hero-bg relative overflow-hidden">
      <div className="grid-pattern absolute inset-0" aria-hidden />
      <div className="container-page relative">
        <SectionHeading center dark eyebrow="Our results" title="Numbers that speak for us" subtitle="Every number is a student who walked into counselling with confidence." />
        <div className={`mt-12 grid grid-cols-2 gap-4 ${cols}`}>
          {stats.map((r, i) => {
            const Icon = icons[i % icons.length];
            return (
              <Reveal key={r.id} delay={i * 100} className={stats.length % 2 === 1 && i === stats.length - 1 ? "col-span-2 lg:col-span-1" : ""}>
                <div className="h-full rounded-3xl bg-white/5 p-5 text-center ring-1 ring-white/10 backdrop-blur sm:p-7">
                  <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-accent-400/15 text-accent-300"><Icon /></span>
                  <p className="mt-4 text-3xl font-extrabold text-white sm:text-5xl"><CountUp value={r.value ?? 0} suffix={r.suffix} /></p>
                  <p className="mt-2 text-sm font-medium text-slate-300">{r.label}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
