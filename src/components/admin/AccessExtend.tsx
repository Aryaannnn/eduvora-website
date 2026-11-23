"use client";

import { useState } from "react";
import { extendStudentAccess } from "@/app/admin/access-actions";
import { accessEnded, purchaseAccessText } from "@/lib/access";

const plusDays = (from: string | null, days: number) => {
  const base = from && new Date(from).getTime() > Date.now() ? new Date(from) : new Date();
  base.setDate(base.getDate() + days);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(base);
};

/** One bought item in Admin → Students: "Access until …" + Extend (+30 / +90 / +1 year / date / lifetime) */
export default function AccessExtend({ purchaseId, title, until: initial }: { purchaseId: string; title: string; until: string | null }) {
  const [until, setUntil] = useState(initial);
  const [choice, setChoice] = useState("");
  const [date, setDate] = useState("");
  const [msg, setMsg] = useState("");
  const ended = accessEnded(until);

  async function apply(value: string | null) {
    if (!confirm(`${title}: set access ${value ? `until ${value}` : "to lifetime"}?`)) return;
    const r = await extendStudentAccess(purchaseId, value);
    setMsg(r.ok ? "✓ Saved" : r.error);
    if (r.ok) setUntil(r.data!.until);
    setChoice("");
  }

  return (
    <li className="text-xs">
      <span className="flex flex-wrap items-center gap-1.5">
        <span className="truncate">{title}</span>
        <span className={`rounded-full px-1.5 font-semibold ${ended ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}>{ended ? "Expired" : purchaseAccessText(until)}</span>
        <select
          value={choice}
          onChange={(e) => {
            const v = e.target.value;
            setChoice(v);
            if (v === "30" || v === "90" || v === "365") void apply(plusDays(until, Number(v)));
            if (v === "life") void apply(null);
          }}
          className="rounded-lg border-0 bg-white px-1.5 py-0.5 text-xs ring-1 ring-slate-200"
          aria-label={`Extend access to ${title}`}
        >
          <option value="">Extend…</option>
          <option value="30">+30 days</option>
          <option value="90">+90 days</option>
          <option value="365">+1 year</option>
          <option value="date">Pick a date…</option>
          <option value="life">Lifetime</option>
        </select>
        {choice === "date" && (
          <>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg px-1 py-0.5 text-xs ring-1 ring-slate-200" aria-label="New access end date" />
            <button type="button" disabled={!date} onClick={() => void apply(date)} className="font-semibold text-brand-700 underline disabled:opacity-40">Save</button>
          </>
        )}
        {msg && <span className={msg.startsWith("✓") ? "text-emerald-700" : "text-red-600"}>{msg}</span>}
      </span>
    </li>
  );
}
