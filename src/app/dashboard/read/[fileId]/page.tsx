import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import SecureReader from "@/components/reader/SecureReader";
import { DashSkeleton } from "@/components/dashboard/ui";
import { requireUser } from "@/lib/dashboard";
import { unlockFreeProduct } from "@/lib/free-resources";
import { canRead, loadOriginal, makeToken, pageInfo } from "@/lib/reader";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Read", robots: { index: false, follow: false } };

// One placeholder address so the page shell (dashboard menu) can be built ahead;
// every real file id is rendered on request (access is checked per student).
export async function generateStaticParams() {
  return [{ fileId: "start" }];
}

// /dashboard/read/<file id> — the secure reader. Course material is read online
// only: one watermarked page at a time, no download / print / save.
export default function ReadPage(props: PageProps<"/dashboard/read/[fileId]">) {
  return (
    <Suspense fallback={<DashSkeleton />}>
      <Content params={props.params} />
    </Suspense>
  );
}

async function Content({ params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await params;
  const s = await requireUser(`/dashboard/read/${fileId}`);
  const db = getAdminSupabase();
  if (!db) return <Message title="Reading is not available right now" text="Please try again in a little while." />;

  const isAdmin = s.profile?.role === "admin";
  const access = await canRead(db, { id: s.user.id, isAdmin }, fileId);
  if ("error" in access) {
    if (access.error === "zip") return <Message title="This file can't be read online" text="Please contact us — we'll make it available as a PDF." />;
    if (access.error === "not-found") return <Message title="File not found" text="It may have been removed or replaced. Please check My Courses & Material." />;
    return <Message title="This file is locked" text="You need to buy this item to read it. If you already paid, please contact us." />;
  }
  // Free item opened from a link → also add it to My Courses
  if (!isAdmin) {
    const { data: p } = await db.from("products").select("is_free").eq("id", access.file.product_id).maybeSingle();
    if (p?.is_free) await unlockFreeProduct(db, s.user.id, access.file.product_id);
  }

  // Fast mode: the pages were turned into WebP pictures when the admin uploaded the PDF.
  // Not ready yet (just uploaded, or SQL not run) → the slower page-by-page PDF mode.
  const info = await pageInfo(db, fileId);
  let pages = info?.ready ? info.pages : 0;
  if (!pages) {
    try {
      pages = (await loadOriginal(db, access.file)).pages;
    } catch {
      return <Message title="This file couldn't be opened" text="Please try again in a moment. If it keeps happening, contact us." />;
    }
  }
  const { token, expiresAt } = makeToken(s.user.id, fileId);
  const name = s.profile?.full_name || s.user.email?.split("@")[0] || "Student";
  const phone = s.profile?.phone ? `+${String(s.profile.phone).replace(/^\+/, "")}` : s.user.phone ? `+${s.user.phone}` : "";
  return (
    <SecureReader
      fileId={fileId}
      title={access.file.display_name}
      pages={pages}
      mode={info?.ready ? "images" : "pdf"}
      token={token}
      expiresAt={expiresAt}
      reader={name}
      watermark={{ name, phone, email: s.profile?.email || s.user.email || "" }}
    />
  );
}

function Message({ title, text }: { title: string; text: string }) {
  return (
    <div className="card mx-auto max-w-lg p-8 text-center">
      <p className="text-lg font-extrabold text-slate-900">{title}</p>
      <p className="mt-2 text-sm text-slate-600">{text}</p>
      <Link href="/dashboard/courses" className="btn-primary mt-5">Back to My Courses</Link>
    </div>
  );
}
