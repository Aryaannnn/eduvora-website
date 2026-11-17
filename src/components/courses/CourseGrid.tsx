import CourseCard from "@/components/cards/CourseCard";
import EmptyState from "@/components/EmptyState";
import Reveal from "@/components/Reveal";
import { getFileSummary } from "@/lib/file-summary";
import type { Product } from "@/lib/types";

// The four crash courses: 2 columns on phones, 4 on large screens.
export default async function CourseGrid({ courses, className = "" }: { courses: Product[]; className?: string }) {
  if (!courses.length) return <div className={className}><EmptyState what="courses" /></div>;
  const summaries = await Promise.all(courses.map((c) => getFileSummary(c.id)));
  return (
    <div className={`grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4 ${className}`}>
      {courses.map((c, i) => (
        <Reveal key={c.id} delay={i * 80}>
          <CourseCard course={c} files={summaries[i]} />
        </Reveal>
      ))}
    </div>
  );
}
