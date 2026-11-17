import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DashSkeleton, EmptyBox, PageHeader, Panel } from "@/components/dashboard/ui";
import FreeBadge from "@/components/FreeBadge";
import { LockIcon } from "@/components/Icons";
import SubjectFiles from "@/components/files/SubjectFiles";
import { requireUser } from "@/lib/dashboard";
import { formatPrice } from "@/lib/format";
import { subjectLabel } from "@/lib/product-files";
import { accessibleProducts, byProduct, loadStudentFiles } from "@/lib/student-files";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Question Bank" };

// Physics / Chemistry / Mathematics question banks. Each one is open when the
// student bought it (or the PCM bundle, or a crash course that includes the
// Question Bank), or when it is free. Every PDF: Open PDF + Download, as their
// personal watermarked copy — access is checked again on every click.
export default function QuestionBankPage() {
  return (
    <Suspense fallback={<DashSkeleton />}>
      <Content />
    </Suspense>
  );
}

type QB = { id: string; title: string; slug: string; subject: string | null; price: number; is_free: boolean; is_active: boolean; sort_order: number };
const ORDER = ["physics", "chemistry", "mathematics"];

async function Content() {
  const s = await requireUser("/dashboard/question-bank");
  const db = getAdminSupabase();
  const { data, error } = db
    ? await db.from("products").select("id,title,slug,subject,price,is_free,is_active,sort_order").eq("category", "question_bank").order("sort_order")
    : { data: null, error: { message: "no database" } };
  const all = (error ? [] : (data ?? [])) as QB[];
  const subjects = all.filter((p) => ORDER.includes(p.subject ?? "")).sort((a, b) => ORDER.indexOf(a.subject!) - ORDER.indexOf(b.subject!) || a.sort_order - b.sort_order);
  const bundle = all.find((p) => p.subject === "pcm" && p.is_active);
  const open = await accessibleProducts(s.supabase, s.user.id, subjects.map((p) => p.id));
  const shown = subjects.filter((p) => p.is_active || open?.has(p.id)); // hidden ones only for people who have them
  const filesOf = byProduct(await loadStudentFiles(s.supabase, shown.filter((p) => open?.has(p.id)).map((p) => p.id)));
  const locked = shown.filter((p) => !open?.has(p.id));

  return (
    <>
      <PageHeader title="Question Bank" subtitle="Physics, Chemistry and Mathematics questions, chapter-wise — open in your browser or download." />
      {shown.length === 0 ? (
        <EmptyBox text="The Question Bank is coming soon." href="/dashboard/courses" cta="Back to My Courses" />
      ) : (
        <div className="space-y-6">
          {shown.map((p) =>
            open?.has(p.id) ? (
              <Panel key={p.id} title={`${subjectLabel(p.subject)} Question Bank`}>
                <SubjectFiles files={filesOf.get(p.id)} title={p.title} empty="Questions are being added — check back soon." />
              </Panel>
            ) : null,
          )}

          {locked.length > 0 && (
            <Panel title="Unlock more subjects">
              <ul className="grid gap-3 sm:grid-cols-3">
                {locked.map((p) => (
                  <li key={p.id} className="flex flex-col rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                    <p className="flex items-center gap-2 font-bold text-slate-900"><LockIcon className="h-4 w-4 text-slate-400" /> {subjectLabel(p.subject)}</p>
                    <p className="mt-1 text-sm text-slate-600">{p.is_free || p.price === 0 ? <FreeBadge /> : formatPrice(p.price)}</p>
                    <Link href="/question-bank" className="btn-primary mt-3 !px-4 !py-2 text-sm">{p.is_free || p.price === 0 ? "Get it free" : "Unlock"}</Link>
                  </li>
                ))}
              </ul>
              {bundle && locked.length > 1 && (
                <p className="mt-3 text-sm text-slate-600">
                  Or get all three with the <Link href="/question-bank" className="font-semibold text-brand-700 underline">{bundle.title}</Link> for {formatPrice(bundle.price)}.
                </p>
              )}
            </Panel>
          )}
        </div>
      )}
    </>
  );
}
