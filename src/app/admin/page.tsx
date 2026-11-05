import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { StatusBadge, DashSkeleton } from "@/components/dashboard/ui";
import { CalendarIcon, ReceiptIcon, UsersIcon, ZapIcon } from "@/components/Icons";
import { requireAdmin } from "@/lib/admin";
import { personLabel, profilesById } from "@/lib/admin-data";
import { formatDate, formatDateTime, formatPrice, formatTime, todayInIndia } from "@/lib/format";
import { after } from "next/server";
import { sendDueReminders } from "@/lib/email/notify";

export const metadata: Metadata = { title: "Overview" };

export default function AdminOverview() {
  return (
    <Suspense fallback={<DashSkeleton />}>
      <Overview />
    </Suspense>
  );
}

type Purchase = { id: string; user_id: string; amount: number; status: string; created_at: string; products: { title: string } | null };
type Booking = { id: string; user_id: string; name: string; status: string; created_at: string; slots: { date: string; start_time: string } | null };

async function Overview() {
  const s = await requireAdmin("/admin");
  after(() => sendDueReminders().catch(() => {})); // session reminders also go out whenever the admin opens the dashboard
  const today = todayInIndia();

  const [paidRes, paidBookingsRes, studentsRes, recentP, recentB, upcomingRes] = await Promise.all([
    s.supabase.from("purchases").select("amount,created_at").eq("status", "paid").limit(10000),
    // Online counselling payments (Razorpay) also count as revenue
    s.supabase.from("bookings").select("amount,paid_at,created_at").eq("payment_status", "paid").not("amount", "is", null).limit(10000),
    s.supabase.from("profiles").select("id", { count: "exact", head: true }).neq("role", "admin"),
    s.supabase.from("purchases").select("id,user_id,amount,status,created_at,products(title)").in("status", ["paid", "failed"]).order("created_at", { ascending: false }).limit(6),
    s.supabase.from("bookings").select("id,user_id,name,status,created_at,slots(date,start_time)").not("status", "in", "(awaiting_payment,expired)").order("created_at", { ascending: false }).limit(6),
    s.supabase.from("bookings").select("id,slots!inner(date)", { count: "exact", head: true }).in("status", ["pending", "confirmed"]).gte("slots.date", today),
  ]);

  const paid = [
    ...((paidRes.data ?? []) as { amount: number; created_at: string }[]),
    ...((paidBookingsRes.data ?? []) as { amount: number; paid_at: string | null; created_at: string }[]).map((b) => ({ amount: b.amount, created_at: b.paid_at ?? b.created_at })),
  ];
  const revenue = paid.reduce((sum, p) => sum + p.amount, 0);
  const purchases = (recentP.data ?? []) as unknown as Purchase[];
  const bookings = (recentB.data ?? []) as unknown as Booking[];
  const people = await profilesById(s, [...purchases.map((p) => p.user_id), ...bookings.map((b) => b.user_id)]);

  const days = revenueLast30Days(paid);
  const last30 = days.reduce((s2, d) => s2 + d.total, 0);

  const stats = [
    { label: "Total revenue", value: formatPrice(revenue).replace("Free", "₹0"), icon: ZapIcon, color: "bg-emerald-600", href: "/admin/payments" },
    { label: "Total students", value: String(studentsRes.count ?? 0), icon: UsersIcon, color: "bg-brand-600", href: "/admin/students" },
    { label: "Paid purchases", value: String(paid.length), icon: ReceiptIcon, color: "bg-amber-500", href: "/admin/payments" },
    { label: "Upcoming bookings", value: String(upcomingRes.count ?? 0), icon: CalendarIcon, color: "bg-rose-500", href: "/admin/bookings" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Overview</h1>
        <p className="mt-1 text-slate-600">Your business at a glance.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats.map((c) => (
          <Link key={c.label} href={c.href} className="card card-hover p-5">
            <span className={`grid h-10 w-10 place-items-center rounded-xl text-white ${c.color}`}><c.icon className="h-5 w-5" /></span>
            <p className="mt-3 text-sm font-semibold text-slate-500">{c.label}</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-900 sm:text-3xl">{c.value}</p>
          </Link>
        ))}
      </div>

      <section className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-extrabold text-slate-900">Revenue — last 30 days</h2>
          <p className="text-sm text-slate-600">Total: <strong className="text-slate-900">{formatPrice(last30).replace("Free", "₹0")}</strong></p>
        </div>
        <RevenueChart days={days} />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card p-5 sm:p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-slate-900">Recent purchases</h2>
            <Link href="/admin/payments" className="text-sm font-semibold text-brand-700 hover:underline">All →</Link>
          </div>
          {purchases.length === 0 ? <p className="text-slate-500">No purchases yet.</p> : (
            <ul className="divide-y divide-slate-100">
              {purchases.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{p.products?.title ?? "Product"}</p>
                    <p className="truncate text-xs text-slate-500">{personLabel(people.get(p.user_id))} · {formatDateTime(p.created_at)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-bold text-slate-900">{formatPrice(p.amount)}</span>
                    <StatusBadge status={p.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5 sm:p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-slate-900">Recent bookings</h2>
            <Link href="/admin/bookings" className="text-sm font-semibold text-brand-700 hover:underline">All →</Link>
          </div>
          {bookings.length === 0 ? <p className="text-slate-500">No bookings yet.</p> : (
            <ul className="divide-y divide-slate-100">
              {bookings.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{b.name}</p>
                    <p className="text-xs text-slate-500">{b.slots ? `${formatDate(b.slots.date)} · ${formatTime(b.slots.start_time)}` : "—"}</p>
                  </div>
                  <StatusBadge status={b.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

/** Revenue per day for the last 30 days (India time) */
function revenueLast30Days(paid: { amount: number; created_at: string }[]) {
  const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
  const now = Date.now();
  const days: { key: string; total: number }[] = [];
  for (let i = 29; i >= 0; i--) days.push({ key: dayKey(new Date(now - i * 86400000)), total: 0 });
  const index = new Map(days.map((d, i) => [d.key, i]));
  for (const p of paid) {
    const i = index.get(dayKey(new Date(p.created_at)));
    if (i !== undefined) days[i].total += p.amount;
  }
  return days;
}

// Simple bar chart (no extra library)
function RevenueChart({ days }: { days: { key: string; total: number }[] }) {
  const max = Math.max(...days.map((d) => d.total), 1);
  const W = 600, H = 180, gap = 4, bw = (W - gap * (days.length - 1)) / days.length;
  const label = (key: string) => {
    const [, m, d] = key.split("-").map(Number);
    return `${d} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]}`;
  };
  return (
    <figure className="mt-4">
      <svg viewBox={`0 0 ${W} ${H + 24}`} className="h-56 w-full" role="img" aria-label="Revenue per day for the last 30 days">
        <line x1="0" x2={W} y1={H} y2={H} stroke="currentColor" className="text-slate-200" />
        {days.map((d, i) => {
          const h = d.total ? Math.max((d.total / max) * (H - 10), 3) : 0;
          const x = i * (bw + gap);
          return (
            <g key={d.key}>
              <rect x={x} y={H - h} width={bw} height={h} rx="3" className="fill-brand-500">
                <title>{`${label(d.key)}: ₹${d.total.toLocaleString("en-IN")}`}</title>
              </rect>
              {(i % 5 === 0 || i === days.length - 1) && (
                <text x={x + bw / 2} y={H + 16} textAnchor="middle" className="fill-slate-400 text-[10px]">{label(d.key)}</text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="sr-only">Hover a bar to see that day&apos;s revenue.</figcaption>
    </figure>
  );
}
