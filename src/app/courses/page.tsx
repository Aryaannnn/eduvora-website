import type { Metadata } from "next";
import CourseCard from "@/components/cards/CourseCard";
import CtaBanner from "@/components/CtaBanner";
import EmptyState from "@/components/EmptyState";
import PageHero from "@/components/PageHero";
import Reveal from "@/components/Reveal";
import { getProducts } from "@/lib/data";

export const metadata: Metadata = {
  title: "VITEEE Crash Courses",
  description: "VITEEE crash courses with live classes, mock tests and doubt support.",
};

export default async function CoursesPage() {
  const courses = await getProducts("crash_course");
  return (
    <>
      <PageHero eyebrow="Courses" title="VITEEE Crash Courses" subtitle="Focused programmes to revise the full syllabus, practise in the real pattern and walk into the exam confident." />
      <section className="container-page py-14 sm:py-20">
        {courses.length ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {courses.map((c, i) => <Reveal key={c.id} delay={i * 80}><CourseCard course={c} /></Reveal>)}
          </div>
        ) : <EmptyState what="courses" />}
      </section>
      <CtaBanner title="Need help picking a course?" text="Tell us your class, preparation level and target — we'll suggest the right batch." />
    </>
  );
}
