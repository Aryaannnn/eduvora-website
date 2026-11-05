import { siteConfig } from "@/config/site";
import CountUp from "../CountUp";
import { AwardIcon, GraduationIcon, ShieldIcon, UsersIcon } from "../Icons";
import Reveal from "../Reveal";
import SectionHeading from "../SectionHeading";

const icons = [UsersIcon, GraduationIcon, AwardIcon, ShieldIcon];

// Numbers come from src/config/site.ts → results
export default function ResultsSection() {
  return (
    <section className="section hero-bg relative overflow-hidden">
      <div className="grid-pattern absolute inset-0" aria-hidden />
      <div className="container-page relative">
        <SectionHeading center dark eyebrow="Our results" title="Numbers that speak for us" subtitle="Every number is a student who walked into counselling with confidence." />
        <div className="mt-12 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {siteConfig.results.map((r, i) => {
            const Icon = icons[i % icons.length];
            return (
              <Reveal key={r.label} delay={i * 100}>
                <div className="h-full rounded-3xl bg-white/5 p-5 text-center ring-1 ring-white/10 backdrop-blur sm:p-7">
                  <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-accent-400/15 text-accent-300"><Icon /></span>
                  <p className="mt-4 text-3xl font-extrabold text-white sm:text-5xl"><CountUp value={r.value} suffix={r.suffix} /></p>
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
