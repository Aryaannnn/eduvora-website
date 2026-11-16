"use client";

// Admin → Products → Reading log (last 30 days): one row per student + file —
// pages read, page views, devices, first/last time — with unusual activity flagged.
import Link from "next/link";
import { useState } from "react";
import { csvDateTimeIST, formatDateTime } from "@/lib/format";
import { SearchIcon } from "../Icons";
import { AdminHeader, Notice, downloadCsv } from "./ui";

export type ReadingRow = {
  key: string; student: string; email: string; phone: string; file: string; product: string;
  pagesRead: number; views: number; devices: number; first: string; last: string; flags: string[];
};

export default function ReadingLog({ rows, total, setupMissing }: { rows: ReadingRow[]; total: number; setupMissing: boolean }) {
  const [q, setQ] = useState("");
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const flagged = rows.filter((r) => r.flags.length > 0);
  const shown = rows.filter((r) => (!onlyFlagged || r.flags.length > 0) && (!q || `${r.student} ${r.email} ${r.phone} ${r.file} ${r.product}`.toLowerCase().includes(q.trim().toLowerCase())));

  const exportCsv = () =>
    downloadCsv(
      "reading-log.csv",
      ["Student", "Email", "Phone", "File", "Product", "Pages read", "Page views", "Devices", "First read", "Last read", "Flags"],
      shown.map((r) => [r.student, r.email, r.phone, r.file, r.product, r.pagesRead, r.views, r.devices, csvDateTimeIST(r.first), csvDateTimeIST(r.last), r.flags.join("; ")]),
    );

  return (
    <>
      <AdminHeader title="Reading log" subtitle="Course material is read online only. Every page a student opens is logged (last 30 days).">
        <Link href="/admin/products" className="btn-light">← Products</Link>
        <button type="button" disabled={shown.length === 0} onClick={exportCsv} className="btn-primary disabled:opacity-50">CSV</button>
      </AdminHeader>
      {setupMissing && <div className="mb-4"><Notice kind="error">Run supabase/secure-reader.sql in Supabase → SQL Editor to turn on the reading log.</Notice></div>}

      {flagged.length > 0 && (
        <section className="mb-4 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
          <h2 className="font-extrabold text-amber-950">⚠️ Unusual activity ({flagged.length})</h2>
          <ul className="mt-2 space-y-1.5 text-sm text-amber-950">
            {flagged.slice(0, 8).map((r) => (
              <li key={r.key}><strong>{r.student}</strong>{r.email ? ` (${r.email})` : ""} · {r.file}: {r.flags.join(" · ")}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="card mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search student, email, phone or file…" className="input !pl-9" aria-label="Search the reading log" />
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={onlyFlagged} onChange={(e) => setOnlyFlagged(e.target.checked)} className="h-4 w-4 accent-brand-600" /> Only unusual
        </label>
        <p className="text-xs text-slate-500">{total.toLocaleString("en-IN")} page views</p>
      </div>

      {shown.length === 0 ? (
        <p className="card p-10 text-center text-slate-500">No reading yet.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">File</th>
                <th className="px-4 py-3">Pages read</th>
                <th className="px-4 py-3">Devices</th>
                <th className="px-4 py-3">Last read</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map((r) => (
                <tr key={r.key} className={r.flags.length ? "bg-amber-50/60" : ""}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{r.student}</p>
                    <p className="text-xs text-slate-500">{[r.email, r.phone].filter(Boolean).join(" · ")}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-800">{r.file}</p>
                    <p className="text-xs text-slate-500">{r.product}</p>
                    {r.flags.length > 0 && <p className="mt-1 text-xs font-bold text-amber-800">⚠️ {r.flags.join(" · ")}</p>}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{r.pagesRead} <span className="text-xs text-slate-500">({r.views} views)</span></td>
                  <td className={`px-4 py-3 tabular-nums ${r.devices >= 3 ? "font-bold text-amber-800" : ""}`}>{r.devices}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{formatDateTime(r.last)}<br /><span className="text-slate-400">first {formatDateTime(r.first)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-slate-500">
        Devices = different browsers (each gets a random id). Students can be signed in on at most 2 devices at once; older logins are signed out.{" "}
        <Link href="/admin/products/downloads" className="underline">Old download history</Link>
      </p>
    </>
  );
}
