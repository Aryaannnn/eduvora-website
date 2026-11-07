import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import CommunitySettingsForm from "@/components/admin/CommunitySettingsForm";
import ExportDataCard from "@/components/admin/ExportDataCard";
import GoogleCalendarCard from "@/components/admin/GoogleCalendarCard";
import ReferralSettingsForm from "@/components/admin/ReferralSettingsForm";
import StatsManager from "@/components/admin/StatsManager";
import { DashSkeleton } from "@/components/dashboard/ui";
import { siteConfig } from "@/config/site";
import { requireAdmin } from "@/lib/admin";
import { getCalendarConnection } from "@/lib/google-calendar";
import type { SiteStat } from "@/lib/types";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <Suspense fallback={<DashSkeleton />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const s = await requireAdmin("/admin/settings");
  const [{ data, error }, ref, wc, cal] = await Promise.all([
    s.supabase.from("site_stats").select("id,label,value,suffix,sort_order").order("sort_order"),
    s.supabase.from("referral_settings").select("enabled,referred_discount,referrer_reward").eq("id", 1).maybeSingle(),
    s.supabase.from("community_settings").select("whatsapp_link").eq("id", 1).maybeSingle(),
    getCalendarConnection(),
  ]);
  const calendar = (
    <>
      <GoogleCalendarCard status={cal} expectedEmail={siteConfig.email} />
      <Link href="/admin/settings/fees" className="card card-hover mb-8 flex items-center justify-between gap-4 p-5 sm:p-6">
        <span>
          <span className="block text-lg font-extrabold text-slate-900">💰 Fees &amp; Campuses</span>
          <span className="block text-sm text-slate-500">Fee data by year, campus and fee category, and campus details for the public Fee Calculator &amp; Campus Comparison page.</span>
        </span>
        <span className="btn-light shrink-0">Open →</span>
      </Link>
    </>
  );
  const community = <CommunitySettingsForm initial={(wc.data?.whatsapp_link as string | null) ?? ""} setupMissing={!!wc.error} />;
  const referral = <ReferralSettingsForm initial={ref.error ? null : (ref.data as { enabled: boolean; referred_discount: number; referrer_reward: number } | null)} />;
  if (error) {
    const missing = error.code === "42P01" || error.code === "PGRST205";
    return (
      <>
        <ExportDataCard />
        {calendar}
        {community}
        {referral}
        <p className="card p-6 text-red-600">{missing ? "Run supabase/stats-reviews.sql in Supabase → SQL Editor to turn on editable stats." : `Could not load settings: ${error.message}`}</p>
      </>
    );
  }
  return (
    <>
      <ExportDataCard />
      {calendar}
      {community}
      {referral}
      <StatsManager stats={(data ?? []) as SiteStat[]} />
    </>
  );
}
