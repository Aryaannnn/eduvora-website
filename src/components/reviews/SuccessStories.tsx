import Link from "next/link";
import { getSuccessStories, type SuccessStory } from "@/lib/data";
import { initials } from "@/lib/format";
import { ArrowRightIcon, AwardIcon, VideoIcon } from "../Icons";
import MobileViewAll, { hideOnPhone } from "../MobileViewAll";
import Reveal from "../Reveal";
import SectionHeading from "../SectionHeading";

// Success stories — real students, added with their consent in Admin → Success Stories.
// Hidden completely when there are none. Never add sample stories.

function StoryCard({ s }: { s: SuccessStory }) {
  return (
    <figure className="card flex h-full flex-col p-6">
      <div className="flex items-center gap-3">
        {s.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.photo_url} alt={`${s.student_name}`} width={56} height={56} loading="lazy" decoding="async" className="h-14 w-14 shrink-0 rounded-full object-cover ring-2 ring-accent-400" />
        ) : (
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-lg font-bold text-white">{initials(s.student_name)}</span>
        )}
        <figcaption className="min-w-0">
          <p className="font-extrabold text-slate-900">{s.student_name}{s.year ? <span className="ml-1.5 text-xs font-bold text-slate-500">· {s.year}</span> : null}</p>
          <p className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-extrabold text-emerald-800 ring-1 ring-emerald-200">
            <AwardIcon className="h-3.5 w-3.5" /> {s.achievement}
          </p>
        </figcaption>
      </div>
      <blockquote className="mt-4 flex-1 leading-relaxed text-slate-700">&ldquo;{s.quote}&rdquo;</blockquote>
      {s.video_url && (
        <a href={s.video_url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-brand-700 hover:underline">
          <VideoIcon className="h-4 w-4" /> Watch {s.student_name.split(" ")[0]}&apos;s video
        </a>
      )}
    </figure>
  );
}

/** Home page section: up to 6 stories (3 on phones) + "View all". */
export default async function SuccessStoriesSection({ className = "" }: { className?: string }) {
  const stories = await getSuccessStories();
  if (stories.length === 0) return null;
  const shown = stories.slice(0, 6);
  return (
    <section className={`section ${className}`} id="success-stories">
      <div className="container-page">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <SectionHeading eyebrow="Success stories" title="Students who found their VIT college" subtitle="Real students, shared with their permission." />
          {stories.length > 3 && (
            <Link href="/success-stories" className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-brand-700 hover:underline">
              All success stories <ArrowRightIcon className="h-4 w-4" />
            </Link>
          )}
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((s, i) => (
            <Reveal key={s.id} delay={(i % 3) * 80} className={`h-full ${hideOnPhone(i)}`}><StoryCard s={s} /></Reveal>
          ))}
        </div>
        <MobileViewAll total={stories.length} href="/success-stories" label="View all success stories" />
      </div>
    </section>
  );
}

/** Full list for /success-stories */
export function SuccessStoriesGrid({ stories }: { stories: SuccessStory[] }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {stories.map((s) => <StoryCard key={s.id} s={s} />)}
    </div>
  );
}
