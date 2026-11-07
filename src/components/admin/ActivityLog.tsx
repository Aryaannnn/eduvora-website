"use client";

// Admin → Activity Log: every admin action (read-only — nobody can edit or delete it).
import { useMemo, useState } from "react";
import { csvDateTimeIST, formatDateTime } from "@/lib/format";
import { SearchIcon } from "../Icons";
import { AdminHeader, Notice, downloadCsv } from "./ui";

export type ActivityRow = { id: number; admin_name: string; action: string; entity: string | null; summary: string; details: Record<string, unknown>; created_at: string };

const GROUPS: Record<string, { label: string; style: string }> = {
  product: { label: "Products", style: "bg-sky-50 text-sky-700" },
  package: { label: "Packages", style: "bg-indigo-50 text-indigo-700" },
  slot: { label: "Slots", style: "bg-teal-50 text-teal-700" },
  booking: { label: "Bookings", style: "bg-emerald-50 text-emerald-700" },
  review: { label: "Reviews", style: "bg-amber-50 text-amber-800" },
  user: { label: "Roles", style: "bg-rose-50 text-rose-700" },
  payment: { label: "Payments & refunds", style: "bg-fuchsia-50 text-fuchsia-700" },
  coupon: { label: "Coupons", style: "bg-orange-50 text-orange-700" },
  credits: { label: "Session credits", style: "bg-lime-50 text-lime-800" },
  predictor: { label: "Predictor access", style: "bg-violet-50 text-violet-700" },
  data: { label: "Data exports", style: "bg-slate-200 text-slate-800" },
  security: { label: "Sign-ins", style: "bg-slate-100 text-slate-600" },
};
const groupOf = (action: string) => action.split(".")[0];
const istDay = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(iso));

export default function ActivityLog({ rows, setupMissing }: { rows: ActivityRow[]; setupMissing: boolean }) {
  const [q, setQ] = useState("");
  const [admin, setAdmin] = useState("all");
  const [group, setGroup] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [open, setOpen] = useState<number | null>(null);

  const admins = useMemo(() => [...new Set(rows.map((r) => r.admin_name))].sort(), [rows]);
  const groups = useMemo(() => [...new Set(rows.map((r) => groupOf(r.action)))], [rows]);
  const shown = rows.filter((r) => {
    const d = istDay(r.created_at);
    return (admin === "all" || r.admin_name === admin)
      && (group === "all" || groupOf(r.action) === group)
      && (!from || d >= from)
      && (!to || d <= to)
      && (!q || `${r.summary} ${r.admin_name} ${r.action}`.toLowerCase().includes(q.trim().toLowerCase()));
  });

  return (
    <>
      <AdminHeader title="Activity Log" subtitle="Every change made by an admin — recorded automatically by the database. It can't be edited or deleted.">
        <button
          type="button"
          onClick={() => downloadCsv("activity-log.csv", ["Date & time (IST)", "Admin", "Action", "What happened", "Details"], shown.map((r) => [csvDateTimeIST(r.created_at), r.admin_name, r.action, r.summary, JSON.stringify(r.details)]))}
          className="btn-light"
        >
          Export CSV
        </button>
      </AdminHeader>
      {setupMissing && <div className="mb-4"><Notice kind="error">Run supabase/admin-security.sql in Supabase → SQL Editor first.</Notice></div>}

      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="input !pl-9" aria-label="Search activity" />
        </div>
        <select value={admin} onChange={(e) => setAdmin(e.target.value)} className="input" aria-label="Admin">
          <option value="all">All admins</option>
          {admins.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={group} onChange={(e) => setGroup(e.target.value)} className="input" aria-label="Type of action">
          <option value="all">All actions</option>
          {groups.map((g) => <option key={g} value={g}>{GROUPS[g]?.label ?? g}</option>)}
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input" aria-label="From date" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input" aria-label="To date" />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr><th className="px-4 py-3">Date &amp; time (IST)</th><th className="px-4 py-3">Admin</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">What happened</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-500">{rows.length ? "Nothing matches these filters." : "No admin activity yet."}</td></tr>}
            {shown.slice(0, 1000).map((r) => {
              const g = GROUPS[groupOf(r.action)];
              const changed = (r.details as { changed?: Record<string, [unknown, unknown]> }).changed;
              return (
                <tr key={r.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">{formatDateTime(r.created_at)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{r.admin_name}</td>
                  <td className="px-4 py-3"><span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${g?.style ?? "bg-slate-100 text-slate-600"}`}>{g?.label ?? r.action}</span></td>
                  <td className="px-4 py-3">
                    <p className="text-slate-800">{r.summary}</p>
                    {changed && Object.keys(changed).length > 0 && (
                      <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} className="mt-1 text-xs font-semibold text-brand-700 underline">
                        {open === r.id ? "Hide details" : `Show ${Object.keys(changed).length} change${Object.keys(changed).length === 1 ? "" : "s"}`}
                      </button>
                    )}
                    {open === r.id && changed && (
                      <ul className="mt-2 space-y-1 rounded-xl bg-slate-50 p-3 text-xs ring-1 ring-slate-200">
                        {Object.entries(changed).map(([k, [o, n]]) => (
                          <li key={k} className="break-all"><strong>{k}</strong>: <span className="text-rose-700 line-through">{short(o)}</span> → <span className="text-emerald-700">{short(n)}</span></li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {shown.length > 1000 && <p className="mt-3 text-center text-xs text-slate-500">Showing the newest 1,000 — use the filters or Export CSV to see more.</p>}
    </>
  );
}

function short(v: unknown) {
  if (v === null || v === undefined || v === "") return "(empty)";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return s.length > 120 ? `${s.slice(0, 120)}…` : s;
}
