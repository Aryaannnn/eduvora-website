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
  const tCols = "id,title,type,duration_minutes,total_marks,is_free,is_active,product_id,created_at";
  const loadTests = (c: string) => s.supabase.from("tests").select(c).order("created_at", { ascending: false });
  const [firstT, firstQ, products, statsRes] = await Promise.all([
    loadTests(`${tCols},subjects,marks_per_correct,negative_marks,max_attempts,instructions,is_sample`),
    loadQ(`${qCols},subject,topic,image_url`),
    s.supabase.from("products").select("id,title,category").order("category").order("sort_order"),
    s.supabase.rpc("test_stats"), // average score / time + most-missed (supabase/test-analytics.sql)
  ]);
  // Before supabase/test-system.sql (image_url, marking scheme) / test-analytics.sql (subject, topic)
  const systemReady = firstT.error?.code !== "42703" && firstQ.error?.code !== "42703";
  const tests = firstT.error?.code === "42703" ? await loadTests(tCols) : firstT;
  let questions = firstQ;
  if (firstQ.error?.code === "42703") questions = await loadQ(`${qCols},subject,topic`);
  const subjectsReady = questions.error?.code !== "42703";
  if (!subjectsReady) questions = await loadQ(qCols);
  const err = tests.error ?? questions.error ?? products.error;
  if (err) return <p className="card p-6 text-red-600">Could not load tests: {err.message}</p>;
  return (
    <TestsManager
      tests={(tests.data ?? []) as unknown as AdminTest[]}
      questions={(questions.data ?? []) as unknown as AdminQuestion[]}
      products={(products.data ?? []) as { id: string; title: string; category: string }[]}
      stats={statsRes.error ? [] : ((statsRes.data ?? []) as TestStats[])}
      subjectsReady={subjectsReady}
      systemReady={systemReady}
    />
  );
}
