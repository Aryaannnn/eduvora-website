"use client";

import { useState } from "react";
import { csvDateTimeIST, formatDateTime } from "@/lib/format";
import { SearchIcon } from "../Icons";
import { downloadCsv } from "./ui";

type Person = { name: string; email: string; phone: string };
export type AdminReferral = {
  id: string; code: string; status: "joined" | "rewarded" | "cancelled"; referred_discount: number; referrer_reward: number;
  created_at: string; rewarded_at: string | null; cancelled_at: string | null; cancel_reason: string | null;
  referrer: Person; referred: Person; firstPayment: string | null; referrerBalance: number;
};

const STATUS = {
  joined: { label: "Joined — not paid yet", style: "bg-amber-50 text-amber-800" },
  rewarded: { label: "Paid — rewarded", style: "bg-emerald-50 text-emerald-700" },
  cancelled: { label: "Refunded — cancelled", style: "bg-slate-100 text-slate-500" },
};

export default function ReferralsTable({ rows }: { rows: AdminReferral[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | AdminReferral["status"]>("all");
  const shown = rows.filter(
    (r) =>
      (status === "all" || r.status === status) &&
      (!q || `${r.code} ${r.referrer.name} ${r.referrer.email} ${r.referred.name} ${r.referred.email}`.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <>
      <div className="card mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, email or code…" className="input !pl-9" aria-label="Search referrals" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="input sm:!w-56" aria-label="Status">
          <option value="all">All statuses</option>
          <option value="joined">Joined — not paid yet</option>
          <option value="rewarded">Paid — rewarded</option>
          <option value="cancelled">Refunded — cancelled</option>
        </select>
        <button
          type="button"
          onClick={() =>
            downloadCsv(
              "referrals.csv",
              ["Joined", "Code", "Referrer", "Referrer email", "New student", "New student email", "Status", "First payment", "Discount (INR)", "Reward (INR)", "Rewarded on", "Cancelled on"],
              shown.map((r) => [csvDateTimeIST(r.created_at), r.code, r.referrer.name, r.referrer.email, r.referred.name, r.referred.email, r.status, r.firstPayment ?? "", r.referred_discount, r.referrer_reward, r.rewarded_at ? csvDateTimeIST(r.rewarded_at) : "", r.cancelled_at ? csvDateTimeIST(r.cancelled_at) : ""]),
            )
          }
          className="btn-light"
        >
          Export CSV
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr><th className="px-4 py-3">Joined</th><th className="px-4 py-3">Referrer</th><th className="px-4 py-3">New student</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">First payment</th><th className="px-4 py-3">Discount / reward</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">No referrals yet.</td></tr>}
            {shown.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">{formatDateTime(r.created_at)}<p className="font-mono text-[11px] text-slate-400">{r.code}</p></td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-900">{r.referrer.name}</p>
                  <p className="text-xs text-slate-500">{r.referrer.email}</p>
                  <p className="text-[11px] font-semibold text-emerald-700">Credit left: ₹{r.referrerBalance.toLocaleString("en-IN")}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-900">{r.referred.name}</p>
                  <p className="text-xs text-slate-500">{r.referred.email}</p>
                  {r.referred.phone && <p className="text-xs text-slate-500">+{r.referred.phone}</p>}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS[r.status].style}`}>{STATUS[r.status].label}</span>
                  {r.rewarded_at && <p className="mt-1 text-[11px] text-slate-500">Rewarded {formatDateTime(r.rewarded_at)}</p>}
                  {r.cancel_reason && <p className="mt-1 text-[11px] text-slate-500">{r.cancel_reason}</p>}
                </td>
                <td className="px-4 py-3 text-xs text-slate-700">{r.firstPayment ?? "—"}</td>
                <td className="whitespace-nowrap px-4 py-3 text-xs">
                  <p>New student: <strong>₹{r.referred_discount}</strong> off</p>
                  <p>Referrer: <strong>₹{r.referrer_reward}</strong> credit</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
