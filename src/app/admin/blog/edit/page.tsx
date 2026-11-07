import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import BlogEditor, { type EditablePost } from "@/components/admin/BlogEditor";
import { DashSkeleton } from "@/components/dashboard/ui";
import { requireAdmin } from "@/lib/admin";

export const metadata: Metadata = { title: "Edit post" };

// /admin/blog/edit          → new post
// /admin/blog/edit?id=<id>  → edit that post
export default function EditPostPage(props: PageProps<"/admin/blog/edit">) {
  return (
    <Suspense fallback={<DashSkeleton />}>
      <Content searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: { searchParams: PageProps<"/admin/blog/edit">["searchParams"] }) {
  const sp = await searchParams;
  const id = typeof sp.id === "string" ? sp.id : "";
  const s = await requireAdmin(id ? `/admin/blog/edit?id=${id}` : "/admin/blog/edit");
  if (!id) return <BlogEditor key="new" post={null} />;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data } = await s.supabase
    .from("blog_posts")
    .select("id,title,slug,excerpt,category,cover_image_url,content_html,seo_title,seo_description,status,published_at,is_sample")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  return <BlogEditor key={id} post={data as EditablePost} />;
}
