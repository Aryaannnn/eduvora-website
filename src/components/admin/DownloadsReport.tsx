"use client";

// Admin → Products → Downloads: every student download (last 30 days),
// a "watch list" for unusual activity, and the full log with search + CSV.
import Link from "next/link";
import { useMemo, useState } from "react";
import { csvDateTimeIST, formatDateTime } from "@/lib/format";
import { SearchIcon } from "../Icons";
import { AdminHeader, Notice, downloadCsv } from "./ui";

export type DownloadRow = {
  id: string; file_name: string; file_type: "pdf" | "zip"; action: "download" | "view"; watermarked: boolean; status: "ok" | "failed";
  error: string | null; device: string | null; created_at: string; product: string; student: string; email: string; user_id: string | null;
};

// ✏️ When is activity "unusual"? Change these numbers if needed.
const LIMITS = { perDay: 15, sameFile: 5, devices: 3 };

export default function DownloadsReport({ rows, setupMissing, nowISO }: { rows: DownloadRow[]; setupMissing: boolean; nowISO: string }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "ok" | "failed">("all");

  const students = useMemo(() => {
    const now = Date.parse(nowISO);
    const by = new Map<string, { key: string; student: string; email: string; total: number; day: number; week: number; files: Map<string, number>; devices: Set<string>; failed: number; last: string }>();
    for (const r of rows) {
      const key = r.user_id ?? r.email ?? "?";
      const s = by.get(key) ?? { key, student: r.student, email: r.email, total: 0, day: 0, week: 0, files: new Map(), devices: new Set(), failed: 0, last: r.created_at };
      const age = now - Date.parse(r.created_at);
      if (r.status === "failed") s.failed++;
      else {
        s.total++;
        if (age < 86400000) s.day++;
        if (age < 7 * 86400000) {
          s.week++;
          if (r.device) s.devices.add(r.device);
        }
        s.files.set(r.file_name, (s.files.get(r.file_name) ?? 0) + 1);
      }
      if (r.created_at > s.last) s.last = r.created_at;
      by.set(key, s);
    }
    return [...by.values()]
      .map((s) => {
        const top = [...s.files.entries()].sort((a, b) => b[1] - a[1])[0];
        const reasons = [
          s.day >= LIMITS.perDay && `${s.day} downloads in 24 hours`,
          top && top[1] >= LIMITS.sameFile && `“${top[0]}” ${top[1]} times`,
          s.devices.size > LIMITS.devices && `${s.devices.size} different devices this week`,
        ].filter(Boolean) as string[];
        return { ...s, top, reasons };
      })
      .sort((a, b) => b.reasons.length - a.reasons.length || b.week - a.week);
  }, [rows, nowISO]);

  const flagged = students.filter((s) => s.reasons.length > 0);
  // search also matches the Download ID printed on the PDF (e.g. "1A2B3C4D")
  const shown = rows.filter((r) => (status === "all" || r.status === status) && (!q || `${r.student} ${r.email} ${r.file_name} ${r.product} ${r.id}`.toLowerCase().includes(q.trim().toLowerCase())));
  const failed = rows.filter((r) => r.status === "failed").length;

  return (
    <>
      <AdminHeader title="Downloads" subtitle={`Last 30 days · ${rows.length - failed} downloads by ${students.length} student${students.length === 1 ? "" : "s"}${failed ? ` · ${failed} failed` : ""}`}>
        <Link href="/admin/products" className="btn-light">← Products</Link>
        <button
          type="button"
          onClick={() => downloadCsv("downloads.csv", ["Time", "Student", "Email", "File", "Product", "Type", "Action", "Watermarked", "Status", "Device", "Download ID"], shown.map((r) => [csvDateTimeIST(r.created_at), r.student, r.email, r.file_name, r.product, r.file_type, r.action, r.watermarked ? "yes" : "no", r.status, r.device, r.id]))}
          className="btn-light"
        >
          Export CSV
        </button>
      </AdminHeader>
      {setupMissing && <div className="mb-4"><Notice kind="error">Run supabase/watermark-downloads.sql in Supabase → SQL Editor first.</Notice></div>}
      <p className="mb-6 rounded-xl bg-sky-50 p-3 text-sm text-sky-900 ring-1 ring-sky-200">
        Every PDF a student downloads carries their name, email and a <strong>Download ID</strong> (bottom of each page). If a copy is shared online, search its ID below to see who downloaded it.
      </p>

      {/* Watch list */}
      <section className="card mb-6 p-5">
        <h2 className="text-lg font-extrabold text-slate-900">⚠️ Watch list</h2>
        <p className="text-sm text-slate-500">Students with unusual activity: {LIMITS.perDay}+ downloads in a day, the same file {LIMITS.sameFile}+ times, or more than {LIMITS.devices} devices in a week.</p>
        {flagged.length === 0 ? (
          <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200">✓ Nothing unusual right now.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {flagged.map((s) => (
              <li key={s.key} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="font-bold text-slate-900">{s.student} <span className="text-xs font-normal text-slate-500">{s.email}</span></p>
                  <p className="text-sm text-rose-700">{s.reasons.join(" · ")}</p>
                </div>
                <button type="button" onClick={() => setQ(s.email || s.student)} className="btn-light !px-3 !py-1.5 text-xs">Show their downloads</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Per student */}
      <section className="card mb-6 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">24 h</th><th className="px-4 py-3">7 days</th><th className="px-4 py-3">30 days</th><th className="px-4 py-3">Devices (7 d)</th><th className="px-4 py-3">Most downloaded</th><th className="px-4 py-3">Last</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {students.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No downloads yet.</td></tr>}
            {students.map((s) => (
              <tr key={s.key} className={s.reasons.length ? "bg-rose-50/60" : ""}>
                <td className="px-4 py-3"><button type="button" onClick={() => setQ(s.email || s.student)} className="text-left font-semibold text-slate-900 hover:text-brand-600">{s.student}</button><p className="text-xs text-slate-500">{s.email}</p></td>
                <td className="px-4 py-3 font-semibold">{s.day}</td>
                <td className="px-4 py-3">{s.week}</td>
                <td className="px-4 py-3">{s.total}</td>
                <td className="px-4 py-3">{s.devices.size}</td>
                <td className="px-4 py-3 text-xs text-slate-600">{s.top ? `${s.top[0]} (${s.top[1]}×)` : "—"}</td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{formatDateTime(s.last)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Full log */}
      <div className="card mb-4 flex flex-col gap-3 p-4 sm:flex-row">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search student, email, file or Download ID…" className="input !pl-9" aria-label="Search downloads" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="input sm:!w-44" aria-label="Status">
          <option value="all">All</option>
          <option value="ok">Successful</option>
          <option value="failed">Failed</option>
        </select>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr><th className="px-4 py-3">Time</th><th className="px-4 py-3">Student</th><th className="px-4 py-3">File</th><th className="px-4 py-3">Watermark</th><th className="px-4 py-3">Download ID</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No downloads match.</td></tr>}
            {shown.slice(0, 500).map((r) => (
                <tr key={r.id} className={r.status === "failed" ? "bg-amber-50/60" : ""}>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">{formatDateTime(r.created_at)}</td>
                  <td className="px-4 py-3"><p className="font-semibold text-slate-900">{r.student}</p><p className="text-xs text-slate-500">{r.email}</p></td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{r.file_name}</p>
                    <p className="text-xs text-slate-500">{r.product} · {r.action === "view" ? "opened" : "downloaded"}</p>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.status === "failed" ? <span className="font-bold text-amber-700" title={r.error ?? ""}>Failed — not given</span> : r.watermarked ? <span className="font-bold text-emerald-700">✓ Watermarked</span> : <span className="text-slate-500">ZIP (no watermark)</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.id.slice(0, 8).toUpperCase()}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
