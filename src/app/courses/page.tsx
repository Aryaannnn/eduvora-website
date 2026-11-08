import type { Metadata } from "next";
import JsonLd from "@/components/seo/JsonLd";
import { pageMeta, breadcrumbLd } from "@/lib/seo";
import CourseCard from "@/components/cards/CourseCard";
import CtaBanner from "@/components/CtaBanner";
import EmptyState from "@/components/EmptyState";
import PageHero from "@/components/PageHero";
import Reveal from "@/components/Reveal";
import { getProducts } from "@/lib/data";

export const metadata: Metadata = pageMeta({ title: "VITEEE Crash Courses & Online Coaching", description: "VITEEE crash courses with live classes, mock tests and doubt support — focused revision plans to improve your VITEEE rank before the exam.", path: "/courses" });

export default async function CoursesPage() {
  const courses = await getProducts("crash_course");
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Crash Courses", path: "/courses" }])} />
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
