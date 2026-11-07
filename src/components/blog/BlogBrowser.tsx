"use client";

// Search box + category tabs for /blog (filters the list in the browser).
// /blog?category=counselling opens with that category selected.
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { BLOG_CATEGORIES, CATEGORY_NAME, type BlogCategory } from "@/lib/blog-shared";
import { SearchIcon } from "../Icons";
import PostCard, { type PostCardData } from "./PostCard";

export default function BlogBrowser({ posts }: { posts: PostCardData[] }) {
  const sp = useSearchParams();
  const initial = sp.get("category");
  const [category, setCategory] = useState<"all" | BlogCategory>(BLOG_CATEGORIES.includes(initial as BlogCategory) ? (initial as BlogCategory) : "all");
  const [q, setQ] = useState("");

  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return posts.filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      const text = `${p.title} ${p.excerpt ?? ""} ${CATEGORY_NAME[p.category]}`.toLowerCase();
      return words.every((w) => text.includes(w));
    });
  }, [posts, category, q]);

  function pick(c: "all" | BlogCategory) {
    setCategory(c);
    const url = new URL(window.location.href);
    if (c === "all") url.searchParams.delete("category");
    else url.searchParams.set("category", c);
    window.history.replaceState(null, "", url.pathname + url.search);
  }

  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div role="tablist" aria-label="Categories" className="-mx-1 -my-1 flex gap-2 overflow-x-auto px-1 py-1">
          {(["all", ...BLOG_CATEGORIES] as const).map((c) => (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={category === c}
              onClick={() => pick(c)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ring-1 transition ${category === c ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-slate-700 ring-slate-300 hover:ring-brand-400"}`}
            >
              {c === "all" ? "All posts" : CATEGORY_NAME[c]}
            </button>
          ))}
        </div>
        <div className="relative md:w-80">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search articles…" className="input !pl-9" aria-label="Search articles" />
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="mt-10 rounded-3xl bg-slate-50 p-10 text-center text-slate-600 ring-1 ring-slate-200">
          {posts.length === 0 ? "New articles are coming soon." : "No articles match your search."}
        </p>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((p) => <PostCard key={p.slug} post={p} />)}
        </div>
      )}
    </>
  );
}
