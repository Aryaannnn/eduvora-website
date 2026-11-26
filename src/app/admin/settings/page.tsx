import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import CommunitySettingsForm from "@/components/admin/CommunitySettingsForm";
import ExportDataCard from "@/components/admin/ExportDataCard";
import ClaimWatcher from "@/components/admin/ClaimWatcher";
import GoogleCalendarCard from "@/components/admin/GoogleCalendarCard";
import MaintenanceCard, { type MaintenanceState } from "@/components/admin/MaintenanceCard";
import ReferralSettingsForm from "@/components/admin/ReferralSettingsForm";
import StatsManager from "@/components/admin/StatsManager";
import WhySettingsForm from "@/components/admin/WhySettingsForm";
import PriceLabelsCard from "@/components/admin/PriceLabelsCard";
import SearchConsoleCard from "@/components/admin/SearchConsoleCard";
import InvoiceSettingsCard from "@/components/admin/InvoiceSettingsCard";
import LeadCaptureCard, { type LeadCaptureState } from "@/components/admin/LeadCaptureCard";
import PdfLimitCard from "@/components/admin/PdfLimitCard";
import StorageCard, { type StorageKind } from "@/components/admin/StorageCard";
import ContactModeCard from "@/components/admin/ContactModeCard";
import BookingNoticeCard from "@/components/admin/BookingNoticeCard";
import { DashSkeleton } from "@/components/dashboard/ui";
import { siteConfig } from "@/config/site";
import { requireAdmin } from "@/lib/admin";
import { getCalendarConnection } from "@/lib/google-calendar";
import type { SiteStat } from "@/lib/types";
import { DEFAULT_WHY, WHY_LIMITS, cleanWhyCards, type WhySettings } from "@/lib/why-shared";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <Suspense fallback={<DashSkeleton />}>
      {/* warns if "live class", "recorded", "lecture", "doubt" or "batch" is typed (courses are PDF-only) */}
      <ClaimWatcher>
        <Content />
      </ClaimWatcher>
    </Suspense>
  );
}

async function Content() {
  const s = await requireAdmin("/admin/settings");
  const [{ data, error }, ref, wc, cal, mt, wy, ds, gs, fp, bn, cm, pl, sr, gsv] = await Promise.all([
    s.supabase.from("site_stats").select("id,label,value,suffix,sort_order").order("sort_order"),
    s.supabase.from("referral_settings").select("enabled,referred_discount,referrer_reward").eq("id", 1).maybeSingle(),
    s.supabase.from("community_settings").select("whatsapp_link").eq("id", 1).maybeSingle(),
    getCalendarConnection(),
    s.supabase.from("maintenance_settings").select("enabled,message,updated_at").eq("id", 1).maybeSingle(),
    s.supabase.from("why_settings").select("enabled,title,cards").eq("id", 1).maybeSingle(),
    s.supabase.from("display_settings").select("show_original_price").eq("id", 1).maybeSingle(),
    s.supabase.from("growth_settings").select("guide_enabled,guide_product_id,abandoned_reminders").eq("id", 1).maybeSingle(),
    s.supabase.from("products").select("id,title,file_path,product_files(id)").eq("is_free", true).order("sort_order"),
    s.supabase.from("booking_settings").select("min_notice_minutes").eq("id", 1).maybeSingle(),
    s.supabase.from("contact_settings").select("mode,open_note,private_note").eq("id", 1).maybeSingle(),
    s.supabase.from("pdf_settings").select("daily_limit").eq("id", 1).maybeSingle(),
    s.supabase.rpc("storage_report"), // supabase/storage-cleanup.sql
    s.supabase.from("display_settings").select("google_site_verification").eq("id", 1).maybeSingle(), // supabase/search-console.sql
  ]);
  const searchConsole = <SearchConsoleCard initial={(gsv.data?.google_site_verification as string | null) ?? ""} setupMissing={!!gsv.error || !gsv.data} />;
  const storage = <StorageCard kinds={sr.error ? null : ((sr.data ?? []) as StorageKind[]).map((k) => ({ ...k, bytes: Number(k.bytes), files: k.files === null ? null : Number(k.files) }))} setupMissing={!!sr.error} />;
  const pdfLimit = siteConfig.inWebsiteReader ? null : <PdfLimitCard initial={pl.error || !pl.data ? null : Number(pl.data.daily_limit)} />;
  const contactMode = (
    <ContactModeCard
      setupMissing={!!cm.error || !cm.data}
      initial={{
        mode: cm.data?.mode === "private" ? "private" : "open",
        openNote: (cm.data?.open_note as string | undefined) ?? siteConfig.contactTexts.openNote,
        privateNote: (cm.data?.private_note as string | undefined) ?? siteConfig.contactTexts.privateNote,
      }}
    />
  );
  const bookingNotice = <BookingNoticeCard initial={bn.error || !bn.data ? null : Number(bn.data.min_notice_minutes)} />;
  const freeProducts = ((fp.data ?? []) as unknown as { id: string; title: string; file_path: string | null; product_files: { id: string }[] | null }[]).map((p) => ({
    id: p.id,
    title: p.title,
    hasFile: !!p.file_path || (p.product_files ?? []).length > 0,
  }));
  const leadCapture = <LeadCaptureCard initial={gs.error || !gs.data ? null : (gs.data as LeadCaptureState)} freeProducts={freeProducts} />;
  const priceLabels = <PriceLabelsCard initial={ds.data?.show_original_price !== false} setupMissing={!!ds.error || !ds.data} />;
  const whyCards = wy.data ? cleanWhyCards(wy.data.cards) : null;
  const whyInitial: WhySettings = wy.data
    ? { enabled: wy.data.enabled !== false, title: String(wy.data.title || DEFAULT_WHY.title).slice(0, WHY_LIMITS.heading), cards: whyCards?.ok ? whyCards.cards : DEFAULT_WHY.cards }
    : DEFAULT_WHY;
  const why = <WhySettingsForm initial={whyInitial} setupMissing={!!wy.error || !wy.data} />;
  const maintenance = <MaintenanceCard state={mt.error || !mt.data ? null : (mt.data as MaintenanceState)} />;
  const calendar = (
    <>
      <GoogleCalendarCard status={cal} expectedEmail={siteConfig.email} />
      {siteConfig.showFeeCalculator && (
      <Link href="/admin/settings/fees" className="card card-hover mb-8 flex items-center justify-between gap-4 p-5 sm:p-6">
        <span>
          <span className="block text-lg font-extrabold text-slate-900">💰 Fees &amp; Campuses</span>
          <span className="block text-sm text-slate-500">Fee data by year, campus and fee category, and campus details for the public Fee Calculator &amp; Campus Comparison page.</span>
        </span>
        <span className="btn-light shrink-0">Open →</span>
      </Link>
      )}
    </>
  );
  const community = <CommunitySettingsForm initial={(wc.data?.whatsapp_link as string | null) ?? ""} setupMissing={!!wc.error} />;
  const referral = <ReferralSettingsForm initial={ref.error ? null : (ref.data as { enabled: boolean; referred_discount: number; referrer_reward: number } | null)} />;
  if (error) {
    const missing = error.code === "42P01" || error.code === "PGRST205";
    return (
      <>
        {maintenance}
        {contactMode}
        {bookingNotice}
        {pdfLimit}
        {storage}
        {leadCapture}
        <ExportDataCard />
        {calendar}
        {community}
        {why}
        {priceLabels}
        {searchConsole}
        <InvoiceSettingsCard />
        {referral}
        <p className="card p-6 text-red-600">{missing ? "Run supabase/stats-reviews.sql in Supabase → SQL Editor to turn on editable stats." : `Could not load settings: ${error.message}`}</p>
      </>
    );
  }
  return (
    <>
      {maintenance}
      {contactMode}
      {bookingNotice}
      {pdfLimit}
      {storage}
      {leadCapture}
      <ExportDataCard />
      {calendar}
      {community}
      {why}
      {priceLabels}
      {searchConsole}
      <InvoiceSettingsCard />
      {referral}
      <StatsManager stats={(data ?? []) as SiteStat[]} />
    </>
  );
}
