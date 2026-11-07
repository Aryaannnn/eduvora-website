import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import BlogPostRowActions from "@/components/admin/BlogPostRowActions";
import { AdminHeader, Notice } from "@/components/admin/ui";
import { DashSkeleton } from "@/components/dashboard/ui";
import { EditIcon, PlusIcon } from "@/components/Icons";
import { requireAdmin } from "@/lib/admin";
import { CATEGORY_NAME, type BlogCategory } from "@/lib/blog-shared";
import { formatDayIST } from "@/lib/format";

export const metadata: Metadata = { title: "Blog" };

const nowISO = () => new Date().toISOString();

export default function AdminBlogPage() {
  return (
    <Suspense fallback={<DashSkeleton />}>
      <Content />
    </Suspense>
  );
}

type Row = { id: string; slug: string; title: string; category: BlogCategory; status: "draft" | "published"; published_at: string | null; updated_at: string; reading_minutes: number; is_sample: boolean };

async function Content() {
  const s = await requireAdmin("/admin/blog");
  const { data, error } = await s.supabase.from("blog_posts").select("id,slug,title,category,status,published_at,updated_at,reading_minutes,is_sample").order("updated_at", { ascending: false });
  const rows = (data ?? []) as Row[];
  const now = nowISO();

  return (
    <>
      <AdminHeader title="Blog" subtitle={`${rows.filter((r) => r.status === "published").length} published · ${rows.filter((r) => r.status === "draft").length} drafts`}>
        <a href="/blog" target="_blank" rel="noopener noreferrer" className="btn-light">View blog</a>
        <Link href="/admin/blog/edit" className={`btn-primary ${error ? "pointer-events-none opacity-50" : ""}`}><PlusIcon className="h-4 w-4" /> New post</Link>
      </AdminHeader>
      {error && <div className="mb-4"><Notice kind="error">Run supabase/blog.sql in Supabase → SQL Editor first.</Notice></div>}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr><th className="px-4 py-3">Title</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Updated</th><th className="px-4 py-3 text-right">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && !error && <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">No posts yet. Click “New post”.</td></tr>}
            {rows.map((r) => {
              const scheduled = r.status === "published" && r.published_at && r.published_at > now;
              return (
                <tr key={r.id}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/blog/edit?id=${r.id}`} className="font-bold text-slate-900 hover:text-brand-600">{r.title}</Link>
                    {r.is_sample && <span className="ml-2 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-extrabold text-rose-700">SAMPLE</span>}
                    <p className="text-xs text-slate-500">/blog/{r.slug} · {r.reading_minutes} min read</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{CATEGORY_NAME[r.category]}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${r.status === "draft" ? "bg-slate-100 text-slate-600" : scheduled ? "bg-sky-50 text-sky-700" : "bg-emerald-50 text-emerald-700"}`}>
                      {r.status === "draft" ? "Draft" : scheduled ? `Scheduled · ${formatDayIST(r.published_at!)}` : "Published"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{formatDayIST(r.updated_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Link href={`/admin/blog/edit?id=${r.id}`} className="btn-light !px-2.5 !py-1.5" aria-label={`Edit ${r.title}`}><EditIcon /></Link>
                      <BlogPostRowActions id={r.id} title={r.title} slug={r.slug} published={r.status === "published" && !scheduled} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
