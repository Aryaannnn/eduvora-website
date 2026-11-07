import Image from "next/image";
import Link from "next/link";
import { CATEGORY_NAME, CATEGORY_STYLE, type BlogCategory } from "@/lib/blog-shared";
import { formatDayIST } from "@/lib/format";
import { BookIcon, ClockIcon } from "../Icons";

export type PostCardData = {
  slug: string; title: string; excerpt: string | null; category: BlogCategory; cover_image_url: string | null;
  reading_minutes: number; published_at: string; is_sample: boolean;
};

export function CategoryBadge({ category }: { category: BlogCategory }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${CATEGORY_STYLE[category]}`}>{CATEGORY_NAME[category]}</span>;
}

/** Cover picture, or a branded placeholder when there is none */
export function Cover({ src, title, sizes, priority = false }: { src: string | null; title: string; sizes: string; priority?: boolean }) {
  return (
    <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-brand-600 via-brand-500 to-brand-700">
      {src ? (
        <Image src={src} alt={title} fill sizes={sizes} priority={priority} className="object-cover transition duration-500 group-hover:scale-105" />
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          <span className="grid h-16 w-16 place-items-center rounded-2xl bg-white/10 text-accent-300 ring-1 ring-white/20"><BookIcon className="h-8 w-8" /></span>
        </div>
      )}
    </div>
  );
}

export default function PostCard({ post }: { post: PostCardData }) {
  return (
    <article className="group card card-hover flex h-full flex-col overflow-hidden">
      <Link href={`/blog/${post.slug}`} className="flex h-full flex-col" aria-label={post.title}>
        <Cover src={post.cover_image_url} title={post.title} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" />
        <div className="flex flex-1 flex-col p-5">
          <div className="flex flex-wrap items-center gap-2">
            <CategoryBadge category={post.category} />
            {post.is_sample && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-extrabold text-rose-700">SAMPLE</span>}
          </div>
          <h3 className="mt-3 text-lg font-extrabold leading-snug text-slate-900 group-hover:text-brand-600">{post.title}</h3>
          {post.excerpt && <p className="mt-2 line-clamp-3 text-sm text-slate-600">{post.excerpt}</p>}
          <p className="mt-auto flex items-center gap-3 pt-4 text-xs font-semibold text-slate-500">
            <span>{formatDayIST(post.published_at)}</span>
            <span className="inline-flex items-center gap-1"><ClockIcon className="h-3.5 w-3.5" /> {post.reading_minutes} min read</span>
          </p>
        </div>
      </Link>
    </article>
  );
}
