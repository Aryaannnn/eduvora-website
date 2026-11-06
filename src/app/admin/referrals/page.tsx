import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminHeader, Notice } from "@/components/admin/ui";
import ReferralsTable, { type AdminReferral } from "@/components/admin/ReferralsTable";
import { DashSkeleton } from "@/components/dashboard/ui";
import { requireAdmin } from "@/lib/admin";

export const metadata: Metadata = { title: "Referrals" };

export default function ReferralsPage() {
  return (
    <Suspense fallback={<DashSkeleton />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const s = await requireAdmin("/admin/referrals");
  const [refs, ledger, settings] = await Promise.all([
    s.supabase.from("referrals").select("id,referrer_id,referred_id,code,status,referred_discount,referrer_reward,created_at,rewarded_at,cancelled_at,cancel_reason,purchases(amount,products(title)),bookings(amount)").order("created_at", { ascending: false }).limit(5000),
    s.supabase.from("reward_ledger").select("user_id,amount").limit(50000),
    s.supabase.from("referral_settings").select("enabled,referred_discount,referrer_reward").eq("id", 1).maybeSingle(),
  ]);
  if (refs.error) {
    return (
      <>
        <AdminHeader title="Referrals" />
        <Notice kind="error">Run supabase/coupons-referrals.sql in Supabase → SQL Editor first.</Notice>
      </>
    );
  }
  const rows = (refs.data ?? []) as unknown as (Omit<AdminReferral, "referrer" | "referred" | "firstPayment" | "referrerBalance"> & {
    referrer_id: string; referred_id: string; purchases: { amount: number; products: { title: string } | null } | null; bookings: { amount: number } | null;
  })[];
  const ids = [...new Set(rows.flatMap((r) => [r.referrer_id, r.referred_id]))];
  const { data: people } = ids.length ? await s.supabase.from("profiles").select("id,full_name,email,phone").in("id", ids) : { data: [] };
  const who = new Map(((people ?? []) as { id: string; full_name: string | null; email: string | null; phone: string | null }[]).map((p) => [p.id, p]));
  const balance = new Map<string, number>();
  for (const l of (ledger.data ?? []) as { user_id: string; amount: number }[]) balance.set(l.user_id, (balance.get(l.user_id) ?? 0) + l.amount);
  const person = (id: string) => ({ name: who.get(id)?.full_name || "Student", email: who.get(id)?.email ?? "", phone: who.get(id)?.phone ?? "" });

  const list: AdminReferral[] = rows.map((r) => ({
    id: r.id,
    code: r.code,
    status: r.status,
    referred_discount: r.referred_discount,
    referrer_reward: r.referrer_reward,
    created_at: r.created_at,
    rewarded_at: r.rewarded_at,
    cancelled_at: r.cancelled_at,
    cancel_reason: r.cancel_reason,
    referrer: person(r.referrer_id),
    referred: person(r.referred_id),
    firstPayment: r.purchases ? `${r.purchases.products?.title ?? "Purchase"} · ₹${r.purchases.amount}` : r.bookings ? `Counselling slot · ₹${r.bookings.amount}` : null,
    referrerBalance: Math.max(0, balance.get(r.referrer_id) ?? 0),
  }));
  const st = settings.data as { enabled: boolean; referred_discount: number; referrer_reward: number } | null;
  const outstanding = [...balance.values()].reduce((t, v) => t + Math.max(0, v), 0);

  return (
    <>
      <AdminHeader
        title="Referrals"
        subtitle={`${list.length} joined · ${list.filter((r) => r.status === "rewarded").length} rewarded · ₹${outstanding.toLocaleString("en-IN")} reward credit not yet used`}
      >
        <Link href="/admin/settings#referrals" className="btn-light">Referral settings</Link>
      </AdminHeader>
      {st && (
        <p className="mb-4 rounded-2xl bg-white px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-200">
          {st.enabled ? "✅ Referrals are ON" : "⏸️ Referrals are OFF"} · New student gets <strong>₹{st.referred_discount}</strong> off · Referrer gets <strong>₹{st.referrer_reward}</strong> credit (after the friend&apos;s payment succeeds).
        </p>
      )}
      <ReferralsTable rows={list} />
    </>
  );
}
