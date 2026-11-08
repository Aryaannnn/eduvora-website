import Link from "next/link";
import { getMyParentShare } from "@/lib/parent-share";
import type { Session } from "@/lib/dashboard";
import { Suspense } from "react";
import { DashSkeleton } from "@/components/dashboard/ui";
import SessionCreditsCard from "@/components/packages/SessionCreditsCard";
import CommunityBanner from "@/components/CommunityBanner";
import { ArrowRightIcon, BookIcon, CalendarIcon, ClipboardIcon, GiftIcon, RocketIcon, TargetIcon } from "@/components/Icons";
import { displayName, getMyAttempts, getMyBookings, getMyPurchases, nextBooking, paidOnly, requireUser } from "@/lib/dashboard";
import { formatDate, formatTime } from "@/lib/format";
import { welcomeIfNew } from "@/lib/email/notify";
import { getCredits } from "@/lib/packages";
import { getNextDates } from "@/lib/important-dates";
import { NextDatesList, OFFICIAL_NOTE } from "@/components/dates/DateBits";
import { claimReferralFromCookie } from "@/lib/pricing";
import { getAdminSupabase } from "@/lib/supabase/admin";

export default function DashboardHome() {
  return (
    <Suspense fallback={<DashSkeleton />}>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  const s = await requireUser("/dashboard");
  welcomeIfNew(s.user.id); // new students get a welcome email (once)
  await claimReferralFromCookie(getAdminSupabase(), s.user.id); // joined through a friend's link?
  const [purchases, bookings, attempts, credits, nextDates] = await Promise.all([getMyPurchases(s), getMyBookings(s), getMyAttempts(s, 1, true), getCredits(s.supabase), getNextDates(3)]);
  const paidCount = paidOnly(purchases).length;
  const upcoming = nextBooking(bookings);
  const latest = attempts[0];
  const first = displayName(s).split(" ")[0];

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <section className="hero-bg relative overflow-hidden rounded-3xl p-6 text-white sm:p-8">
        <div className="grid-pattern absolute inset-0" aria-hidden />
        <div className="relative">
          <p className="text-sm font-semibold text-accent-300">Welcome back 👋</p>
          <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">Hi, {first}!</h1>
          <p className="mt-2 max-w-lg text-sm text-slate-300 sm:text-base">Here&apos;s everything for your VITEEE journey in one place.</p>
          {s.profile?.role === "admin" && (
            <Link href="/admin" className="mt-4 inline-flex rounded-full bg-accent-400 px-3 py-1 text-xs font-bold text-slate-900">Admin · Open Admin Panel →</Link>
          )}
          {s.profile?.role === "counsellor" && (
            <Link href="/admin/bookings" className="mt-4 inline-flex rounded-full bg-accent-400 px-3 py-1 text-xs font-bold text-slate-900">Counsellor · Open Staff Panel →</Link>
          )}
        </div>
      </section>

      {/* Parent progress link */}
      <Suspense fallback={null}><ParentLinkBadge s={s} /></Suspense>

      {/* WhatsApp community (only when a link is set) */}
      <CommunityBanner from="dashboard" compact className="bg-white" />

      {/* Counselling package: "Sessions left: 2 of 3" */}
      <SessionCreditsCard credits={credits} />

      {/* Quick cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <QuickCard href="/dashboard/courses" icon={BookIcon} color="bg-brand-600" label="Purchased items" value={String(paidCount)} hint={paidCount ? "Open your material" : "Nothing bought yet"} />
        <QuickCard
          href="/dashboard/bookings"
          icon={CalendarIcon}
          color="bg-emerald-600"
          label="Upcoming slot"
          value={upcoming?.slots ? formatDate(upcoming.slots.date) : "None"}
          hint={upcoming?.slots ? `${formatTime(upcoming.slots.start_time)} · ${upcoming.status}` : "Book a counselling call"}
        />
        <QuickCard
          href="/dashboard/tests"
          icon={ClipboardIcon}
          color="bg-amber-500"
          label="Latest test score"
          value={latest ? `${latest.score}/${latest.tests?.total_marks ?? "?"}` : "—"}
          hint={latest?.tests?.title ?? "Take a free test"}
        />
      </div>

      {/* Next 3 important dates */}
      {nextDates.length > 0 && (
        <section className="card p-5 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">Important dates</h2>
              <p className="text-xs text-slate-500">{OFFICIAL_NOTE}</p>
            </div>
            <Link href="/important-dates" className="text-sm font-semibold text-brand-700 hover:underline">All dates →</Link>
          </div>
          <div className="mt-4"><NextDatesList dates={nextDates} /></div>
        </section>
      )}

      {/* Shortcuts */}
      <section className="card p-5 sm:p-6">
        <h2 className="text-lg font-extrabold text-slate-900">Quick actions</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            { href: "/courses", label: "Browse courses", icon: RocketIcon },
            { href: "/mock-tests", label: "Take a test", icon: TargetIcon },
            { href: "/book-a-slot", label: "Book a slot", icon: CalendarIcon },
            { href: "/dashboard/predictor", label: "Rank predictor", icon: TargetIcon },
            { href: "/dashboard/refer", label: "Refer & earn", icon: GiftIcon },
          ].map((a) => (
            <Link key={a.href} href={a.href} className="flex flex-col items-center gap-2 rounded-2xl bg-slate-50 p-4 text-center text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-brand-50 hover:text-brand-700 hover:ring-brand-200">
              <a.icon className="h-6 w-6" /> {a.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function QuickCard(props: { href: string; icon: typeof BookIcon; color: string; label: string; value: string; hint: string }) {
  return (
    <Link href={props.href} className="card card-hover group flex flex-col p-5">
      <span className={`grid h-11 w-11 place-items-center rounded-xl text-white ${props.color}`}><props.icon className="h-5 w-5" /></span>
      <p className="mt-4 text-sm font-semibold text-slate-500">{props.label}</p>
      <p className="mt-1 text-2xl font-extrabold text-slate-900">{props.value}</p>
      <p className="mt-1 flex items-center gap-1 truncate text-sm capitalize text-slate-500">
        {props.hint} <ArrowRightIcon className="h-3.5 w-3.5 shrink-0 transition group-hover:translate-x-0.5" />
      </p>
    </Link>
  );
}

/** "Parent link active" (or a nudge to share) */
async function ParentLinkBadge({ s }: { s: Session }) {
  const share = await getMyParentShare(s);
  if (share.status === "active") {
    return (
      <Link href="/dashboard/parent" className="card card-hover flex items-center justify-between gap-3 p-4 ring-1 ring-emerald-200">
        <span className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-50 text-lg" aria-hidden>👪</span>
          <span>
            <span className="block text-sm font-extrabold text-emerald-700">● Parent link active</span>
            <span className="block text-xs text-slate-500">Until {formatDate(share.expires_at!.slice(0, 10))}{share.view_count ? ` · opened ${share.view_count}×` : ""}</span>
          </span>
        </span>
        <span className="text-xs font-semibold text-brand-700">Manage →</span>
      </Link>
    );
  }
  return (
    <Link href="/dashboard/parent" className="card card-hover flex items-center justify-between gap-3 p-4">
      <span className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-lg" aria-hidden>👪</span>
        <span className="text-sm text-slate-700"><strong>Share your progress with your parents</strong>{share.status === "expired" ? " — your link expired" : ""}</span>
      </span>
      <span className="text-xs font-semibold text-brand-700">Share →</span>
    </Link>
  );
}
