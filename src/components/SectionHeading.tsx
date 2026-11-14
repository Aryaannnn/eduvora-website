import Reveal from "./Reveal";

export default function SectionHeading({
  eyebrow,
  title,
  subtitle,
  center = false,
  dark = false,
  id,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  center?: boolean;
  dark?: boolean;
  /** id of the heading (for aria-labelledby) */
  id?: string;
}) {
  return (
    <Reveal className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      {eyebrow && (
        <p className={`inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] ${dark ? "text-accent-300" : "text-accent-700"}`}>
          <span className="h-1.5 w-6 rounded-full bg-accent-400" />
          {eyebrow}
        </p>
      )}
      <h2 id={id} className={`mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl ${dark ? "text-white" : "text-slate-900"}`}>{title}</h2>
      {subtitle && <p className={`mt-3 text-base sm:text-lg ${dark ? "text-slate-300" : "text-slate-600"}`}>{subtitle}</p>}
    </Reveal>
  );
}
