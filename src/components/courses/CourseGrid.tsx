import CourseCard from "@/components/cards/CourseCard";
import EmptyState from "@/components/EmptyState";
import Reveal from "@/components/Reveal";
import { getFileSummary } from "@/lib/file-summary";
import type { Product } from "@/lib/types";

// The four crash courses + Formula Book: 2 columns on phones, 3 on tablets, one row of 5 on wide screens.
export default async function CourseGrid({ courses, className = "" }: { courses: Product[]; className?: string }) {
  if (!courses.length) return <div className={className}><EmptyState what="courses" /></div>;
  const summaries = await Promise.all(courses.map((c) => getFileSummary(c.id)));
  return (
    <div className={`grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 ${courses.length >= 5 ? "xl:grid-cols-5" : "xl:grid-cols-4"} ${className}`}>
      {courses.map((c, i) => (
        <Reveal key={c.id} delay={i * 80}>
          <CourseCard course={c} files={summaries[i]} />
        </Reveal>
      ))}
    </div>
  );
}
