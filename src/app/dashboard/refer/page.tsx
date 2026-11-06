import type { Metadata } from "next";
import { Suspense } from "react";
import { DashSkeleton, PageHeader, Panel } from "@/components/dashboard/ui";
import ReferShare from "@/components/dashboard/ReferShare";
import { GiftIcon } from "@/components/Icons";
import { siteConfig } from "@/config/site";
import { requireUser } from "@/lib/dashboard";
import { formatDateTime } from "@/lib/format";
import { getReferralSettings } from "@/lib/referrals";
import { SITE_URL } from "@/lib/site-url";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Refer & Earn" };

export default function ReferPage() {
  return (
    <Suspense fallback={<DashSkeleton />}>
      <Content />
    </Suspense>
  );
}

const STATUS: Record<string, { label: string; style: string }> = {
  joined: { label: "Signed up — waiting for first payment", style: "bg-amber-50 text-amber-800 ring-amber-200" },
  rewarded: { label: "Paid — reward earned", style: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  cancelled: { label: "Refunded — reward cancelled", style: "bg-slate-100 text-slate-600 ring-slate-200" },
};
const KIND: Record<string, string> = { referral: "Friend's first payment", spent: "Used at checkout", reversed: "Friend's payment refunded", restored: "Refunded payment — credit returned", adjustment: "Adjusted by EDUVORA" };

async function Content() {
  const s = await requireUser("/dashboard/refer");
  const db = getAdminSupabase();
  const settings = await getReferralSettings();
  const { data: code, error } = db ? await db.rpc("ensure_referral_code", { p_user: s.user.id }) : { data: null, error: { message: "not configured" } };

  if (error || !code || !settings) {
    return (
      <>
        <PageHeader title="Refer & Earn" subtitle="Invite friends to EDUVORA." />
        <p className="card p-8 text-center text-slate-600">Referrals are coming soon.</p>
      </>
    );
  }

  // Own rows only (Row Level Security)
  const [refs, ledger] = await Promise.all([
    s.supabase.from("referrals").select("id,referred_id,status,referrer_reward,created_at,rewarded_at").eq("referrer_id", s.user.id).order("created_at", { ascending: false }),
    s.supabase.from("reward_ledger").select("id,amount,kind,created_at").eq("user_id", s.user.id).order("created_at", { ascending: false }).limit(50),
  ]);
  const friends = (refs.data ?? []) as { id: string; referred_id: string; status: string; referrer_reward: number; created_at: string }[];
  // Friends' first names only (server key; never their contact details)
  const names = new Map<string, string>();
  if (db && friends.length) {
    const { data: p } = await db.from("profiles").select("id,full_name").in("id", friends.map((f) => f.referred_id));
    for (const r of (p ?? []) as { id: string; full_name: string | null }[]) names.set(r.id, (r.full_name || "Student").split(" ")[0]);
  }
  const entries = (ledger.data ?? []) as { id: string; amount: number; kind: string; created_at: string }[];
  const balance = Math.max(0, entries.reduce((t, e) => t + e.amount, 0));
  const earned = friends.filter((f) => f.status === "rewarded").reduce((t, f) => t + f.referrer_reward, 0);
  const link = `${SITE_URL}/r/${code}`;
  const off = settings.referred_discount;
  const reward = settings.referrer_reward;
  const message = `Hi! I'm using ${siteConfig.businessName} for VITEEE counselling with ${siteConfig.founder.name.split(" ")[0]} Sir. Sign up with my link and get ₹${off} off your first payment: ${link}`;

  return (
    <>
      <PageHeader title="Refer & Earn" subtitle={`Invite friends: they get ₹${off} off, you get ₹${reward} reward credit.`} />

      {!settings.enabled && <p className="mb-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">Referral rewards are paused right now. Your code still works for later.</p>}

      <section className="hero-bg relative overflow-hidden rounded-3xl p-6 text-white sm:p-8">
        <div className="grid-pattern absolute inset-0" aria-hidden />
        <div className="relative grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent-400 text-brand-950"><GiftIcon className="h-6 w-6" /></span>
            <h2 className="mt-4 text-2xl font-extrabold sm:text-3xl">Give ₹{off}, get ₹{reward}</h2>
            <ol className="mt-3 space-y-1.5 text-sm text-slate-200">
              <li>1. Share your link with a friend preparing for VITEEE.</li>
              <li>2. They sign up with it and get <strong className="text-white">₹{off} off</strong> their first payment.</li>
              <li>3. When their payment succeeds, you get <strong className="text-white">₹{reward} reward credit</strong> — used automatically on your next purchase.</li>
            </ol>
          </div>
          <ReferShare code={code as string} link={link} message={message} />
        </div>
      </section>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Your reward credit" value={`₹${balance.toLocaleString("en-IN")}`} hint="Used automatically at checkout" />
        <Stat label="Friends joined" value={String(friends.length)} hint={`${friends.filter((f) => f.status === "rewarded").length} have paid`} />
        <Stat label="Total earned" value={`₹${earned.toLocaleString("en-IN")}`} hint="From friends' first payments" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Friends you invited">
          {friends.length === 0 ? (
            <p className="text-sm text-slate-500">No friends yet. Share your link to get started!</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {friends.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <div>
                    <p className="font-semibold text-slate-900">{names.get(f.referred_id) ?? "Student"}</p>
                    <p className="text-xs text-slate-500">Joined {formatDateTime(f.created_at)}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${STATUS[f.status]?.style ?? ""}`}>{STATUS[f.status]?.label ?? f.status}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Reward credit history">
          {entries.length === 0 ? (
            <p className="text-sm text-slate-500">Rewards you earn and use will show here.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {entries.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 py-3 text-sm">
                  <div>
                    <p className="font-semibold text-slate-900">{KIND[e.kind] ?? e.kind}</p>
                    <p className="text-xs text-slate-500">{formatDateTime(e.created_at)}</p>
                  </div>
                  <span className={`font-extrabold ${e.amount > 0 ? "text-emerald-700" : "text-slate-500"}`}>{e.amount > 0 ? "+" : "−"} ₹{Math.abs(e.amount).toLocaleString("en-IN")}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <p className="mt-6 text-xs text-slate-500">
        Rules: only new students who sign up with your link count. You can&apos;t refer yourself. Rewards are given only after your friend&apos;s payment succeeds and are taken back if that payment is refunded. Reward credit can&apos;t be withdrawn as cash.
      </p>
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="card p-5">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}
