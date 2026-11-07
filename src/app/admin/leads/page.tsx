import type { Metadata } from "next";
import { Suspense } from "react";
import LeadsManager, { type AdminLead, type LeadNote } from "@/components/admin/LeadsManager";
import { DashSkeleton } from "@/components/dashboard/ui";
import { siteConfig } from "@/config/site";
import { requireAdmin } from "@/lib/admin";
import { todayInIndia } from "@/lib/format";

export const metadata: Metadata = { title: "Leads" };

export default function LeadsPage() {
  return (
    <Suspense fallback={<DashSkeleton />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const s = await requireAdmin("/admin/leads");
  // Collect anything new since the last time (signups, enquiries, predictor, payments…)
  const sync = await s.supabase.rpc("sync_leads");
  if (sync.error && (sync.error.code === "PGRST202" || /sync_leads|function/i.test(sync.error.message))) {
    return <p className="card p-6 text-red-600">Run supabase/leads.sql in Supabase → SQL Editor to turn on Leads.</p>;
  }
  const [{ data, error }, notesRes] = await Promise.all([
    s.supabase
      .from("leads_overview")
      .select("id,user_id,email,phone,name,class_year,predicted_rank,sources,status,follow_up_on,first_seen_at,last_activity_at,status_changed_at,total_paid,notes_count")
      .order("last_activity_at", { ascending: false })
      .limit(5000),
    s.supabase.from("lead_notes").select("id,lead_id,body,created_at").order("created_at", { ascending: false }).limit(5000),
  ]);
  if (error) return <p className="card p-6 text-red-600">Could not load leads: {error.message}</p>;

  const notes: Record<string, LeadNote[]> = {};
  for (const n of (notesRes.data ?? []) as (LeadNote & { lead_id: string })[]) (notes[n.lead_id] ??= []).push(n);

  return (
    <LeadsManager
      leads={(data ?? []) as AdminLead[]}
      notes={notes}
      today={todayInIndia()}
      founderFirst={siteConfig.founder.name.split(" ")[0]}
      business={siteConfig.businessName}
    />
  );
}
