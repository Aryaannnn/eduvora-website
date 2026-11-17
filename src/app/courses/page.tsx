import type { Metadata } from "next";
import JsonLd from "@/components/seo/JsonLd";
import { pageMeta, breadcrumbLd } from "@/lib/seo";
import CourseGrid from "@/components/courses/CourseGrid";
import { SUBJECT_KEYS, SUBJECT_UI } from "@/components/courses/SubjectIcon";
import CtaBanner from "@/components/CtaBanner";
import { LockIcon, ShieldIcon, ZapIcon } from "@/components/Icons";
import PageHero from "@/components/PageHero";
import { getCourses } from "@/lib/data";

export const metadata: Metadata = pageMeta({
  title: "VITEEE Crash Courses (60, 45, 30 & 10 Days)",
  description: "VITEEE crash courses for Physics, Chemistry and Mathematics in 60, 45, 30 and 10 days, with chapter-wise PDFs in your EDUVORA dashboard.",
  path: "/courses",
});

const trust = [
  { icon: ZapIcon, title: "Instant access", text: "Your PDFs appear in your dashboard right after payment." },
  { icon: LockIcon, title: "Your personal copy", text: "Every PDF is watermarked with your name." },
  { icon: ShieldIcon, title: "Secure payment", text: "Pay safely with Razorpay — UPI, cards or net banking." },
];

// ✏️ The four courses, their prices and text: Admin → Products. "Most Popular": in the course's "Course page" section.
export default async function CoursesPage() {
  const courses = await getCourses();
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Crash Courses", path: "/courses" }])} />
      <PageHero eyebrow="Courses" title="VITEEE Crash Courses" subtitle="Pick the plan that fits the time you have left, or the Formula Book. Each covers Physics, Chemistry and Mathematics." />
      <section className="container-page py-10 sm:py-16">
        <div className="mb-6 flex flex-wrap items-center justify-center gap-2 text-xs font-semibold sm:mb-8 sm:text-sm">
          {SUBJECT_KEYS.map((k) => {
            const ui = SUBJECT_UI[k];
            return (
              <span key={k} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ring-1 ${ui.chip}`}><ui.Icon className="h-4 w-4" /> {ui.label}</span>
            );
          })}
        </div>
        <CourseGrid courses={courses} />
        <ul className="mt-10 grid gap-3 sm:grid-cols-3">
          {trust.map((t) => (
            <li key={t.title} className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-600 text-white"><t.icon className="h-5 w-5" /></span>
              <span><span className="block font-bold text-slate-900">{t.title}</span><span className="text-sm text-slate-600">{t.text}</span></span>
            </li>
          ))}
        </ul>
      </section>
      <CtaBanner title="Need help picking a course?" text="Tell us how much time you have and where you stand — we'll suggest the right plan." />
    </>
  );
}
