import type { Metadata } from "next";
import { Suspense } from "react";
import TestsManager, { type AdminQuestion, type AdminTest, type TestStats } from "@/components/admin/TestsManager";
import { DashSkeleton } from "@/components/dashboard/ui";
import { requireAdmin } from "@/lib/admin";

export const metadata: Metadata = { title: "Tests" };

export default function TestsPage() {
  return (
    <Suspense fallback={<DashSkeleton />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const s = await requireAdmin("/admin/tests");
  // Admins can read questions WITH answers (students never can — see setup.sql)
  const qCols = "id,test_id,question,options,correct_option,explanation,marks,sort_order";
  const loadQ = (c: string) => s.supabase.from("questions").select(c).order("sort_order").order("created_at").limit(5000);
  const [tests, firstQ, products, statsRes] = await Promise.all([
    s.supabase.from("tests").select("id,title,type,duration_minutes,total_marks,is_free,is_active,product_id,created_at").order("created_at", { ascending: false }),
    loadQ(`${qCols},subject,topic`),
    s.supabase.from("products").select("id,title,category").order("category").order("sort_order"),
    s.supabase.rpc("test_stats"), // average score / time + most-missed (supabase/test-analytics.sql)
  ]);
  // Before supabase/test-analytics.sql: no subject/topic columns yet
  const subjectsReady = firstQ.error?.code !== "42703";
  const questions = subjectsReady ? firstQ : await loadQ(qCols);
  const err = tests.error ?? questions.error ?? products.error;
  if (err) return <p className="card p-6 text-red-600">Could not load tests: {err.message}</p>;
  return (
    <TestsManager
      tests={(tests.data ?? []) as AdminTest[]}
      questions={(questions.data ?? []) as unknown as AdminQuestion[]}
      products={(products.data ?? []) as { id: string; title: string; category: string }[]}
      stats={statsRes.error ? [] : ((statsRes.data ?? []) as TestStats[])}
      subjectsReady={subjectsReady}
    />
  );
}
