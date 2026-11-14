"use client";

// =====================================================================
//  VIDEO TESTIMONIALS — click to play
//  Only the thumbnail picture loads at first. The YouTube player is added
//  ONLY when the student presses play, so the page stays fast.
//  Videos are added in Admin → Reviews → Video testimonials (with consent).
//  The whole section hides itself when there are no videos.
// =====================================================================
import MobileViewAll, { hideOnPhone } from "../MobileViewAll";
import Image from "next/image";
import { useState } from "react";
import type { VideoTestimonial } from "@/lib/data";
import { youtubeEmbed, youtubeThumb } from "@/lib/youtube";
import Reveal from "../Reveal";
import SectionHeading from "../SectionHeading";

export default function VideoTestimonials({ videos, heading = true, className = "", mobileShort = false }: { videos: VideoTestimonial[]; heading?: boolean; className?: string; mobileShort?: boolean }) {
  if (videos.length === 0) return null;
  return (
    <section className={`section ${className}`} aria-labelledby={heading ? "video-testimonials-title" : undefined}>
      <div className="container-page">
        {heading && (
          <div id="video-testimonials-title">
            <SectionHeading center eyebrow="Video testimonials" title="Hear it from our students" subtitle="Real students share how EDUVORA helped them get their VIT campus and branch." />
          </div>
        )}
        <div className={`grid gap-6 sm:grid-cols-2 lg:grid-cols-3 ${heading ? "mt-10" : ""} ${videos.length === 1 ? "mx-auto max-w-md sm:grid-cols-1 lg:grid-cols-1" : ""}`}>
          {videos.map((v, i) => (
            <Reveal key={v.id} delay={(i % 3) * 80} className={mobileShort ? hideOnPhone(i) : ""}>
              <VideoCard v={v} />
            </Reveal>
          ))}
        </div>
        {mobileShort && <MobileViewAll total={videos.length} href="/reviews" label="View all videos" />}
      </div>
    </section>
  );
}

function VideoCard({ v }: { v: VideoTestimonial }) {
  const [playing, setPlaying] = useState(false);
  const label = `Play video testimonial by ${v.student_name}`;

  return (
    <article className="card card-hover overflow-hidden">
      <div className="relative aspect-video bg-slate-900">
        {playing ? (
          <iframe
            src={youtubeEmbed(v.youtube_id)}
            title={`Video testimonial by ${v.student_name}`}
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button type="button" onClick={() => setPlaying(true)} aria-label={label} className="group absolute inset-0 block w-full">
            <Image src={youtubeThumb(v.youtube_id)} alt="" fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover transition duration-500 group-hover:scale-105" />
            <span className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/10 to-transparent" aria-hidden />
            <span className="absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-accent-400 text-brand-950 shadow-2xl shadow-black/40 ring-8 ring-white/25 transition group-hover:scale-110" aria-hidden>
              <svg viewBox="0 0 24 24" className="ml-1 h-7 w-7" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5Z" /></svg>
            </span>
            <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-bold text-white" aria-hidden>▶ Watch</span>
          </button>
        )}
      </div>
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="truncate font-extrabold text-slate-900">{v.student_name}</p>
          {v.achievement && <p className="mt-0.5 text-sm font-semibold text-brand-700">{v.achievement}</p>}
        </div>
        {v.year && <span className="shrink-0 rounded-full bg-accent-100 px-2.5 py-1 text-xs font-bold text-accent-800">{v.year}</span>}
      </div>
    </article>
  );
}
