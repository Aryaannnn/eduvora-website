import type { Metadata } from "next";
import { Suspense } from "react";
import EmailLogs, { type EmailLog } from "@/components/admin/EmailLogs";
import { DashSkeleton } from "@/components/dashboard/ui";
import { requireAdmin } from "@/lib/admin";

export const metadata: Metadata = { title: "Email Logs" };

export default function EmailLogsPage() {
  return (
    <Suspense fallback={<DashSkeleton />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const s = await requireAdmin("/admin/emails");
  const { data, error } = await s.supabase
    .from("email_logs")
    .select("id,kind,ref_id,to_email,subject,status,error,attempts,created_at,updated_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) {
    const missing = error.code === "42P01" || error.code === "PGRST205";
    return <p className="card p-6 text-red-600">{missing ? "Run supabase/emails-invoices.sql in Supabase → SQL Editor to turn on email logs." : `Could not load email logs: ${error.message}`}</p>;
  }
  return <EmailLogs logs={(data ?? []) as EmailLog[]} />;
}
