"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteBlogPost } from "@/app/admin/actions";
import { ExternalIcon, TrashIcon } from "../Icons";

export default function BlogPostRowActions({ id, title, slug, published }: { id: string; title: string; slug: string; published: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <>
      {published && (
        <a href={`/blog/${slug}`} target="_blank" rel="noopener noreferrer" className="btn-light !px-2.5 !py-1.5" aria-label={`View ${title}`}><ExternalIcon /></a>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          confirm(`Delete "${title}"? This can't be undone.`) &&
          start(async () => {
            const res = await deleteBlogPost(id);
            if (!res.ok) alert(res.error);
            router.refresh();
          })
        }
        className="btn-light !px-2.5 !py-1.5 !text-red-600 disabled:opacity-50"
        aria-label={`Delete ${title}`}
      >
        <TrashIcon />
      </button>
    </>
  );
}
