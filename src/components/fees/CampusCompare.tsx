"use client";

// Campus comparison: pick 2–3 campuses and see them side by side.
import { useState } from "react";
import { latestYear, rupees, type Campus, type CampusFee } from "@/lib/fees-shared";
import { CheckIcon, ExternalIcon } from "../Icons";

export default function CampusCompare({ campuses, fees }: { campuses: Campus[]; fees: CampusFee[] }) {
  const [picked, setPicked] = useState<string[]>(campuses.slice(0, Math.min(3, campuses.length)).map((c) => c.id));
  const chosen = picked.map((id) => campuses.find((c) => c.id === id)).filter(Boolean) as Campus[];

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? (p.length > 2 ? p.filter((x) => x !== id) : p) : p.length < 3 ? [...p, id] : [...p.slice(1), id]));

  const feeRange = (c: Campus) => {
    const y = latestYear(fees, c.name);
    const rows = fees.filter((f) => f.campus === c.name && f.year === y);
    if (!rows.length) return null;
    const min = Math.min(...rows.map((r) => r.tuition_per_year));
    const max = Math.max(...rows.map((r) => r.tuition_per_year));
    return { y, min, max, rows: rows.sort((a, b) => a.fee_category - b.fee_category) };
  };
  const categories = [...new Set(fees.map((f) => f.fee_category))].sort();
  const anySample = chosen.some((c) => c.is_sample || fees.some((f) => f.campus === c.name && f.is_sample));

  if (campuses.length < 2) return <p className="card p-8 text-center text-slate-600">Campus comparison will be available soon.</p>;

  type Row = { label: string; cell: (c: Campus) => React.ReactNode };
  const rows: Row[] = [
    { label: "Location", cell: (c) => c.location ?? "—" },
    { label: "Tuition per year", cell: (c) => { const r = feeRange(c); return r ? <><strong>{rupees(r.min)} – {rupees(r.max)}</strong><span className="block text-xs text-slate-500">{r.y} · depends on fee category</span></> : "—"; } },
    ...categories.map((cat) => ({
      label: `Category ${cat} (per year)`,
      cell: (c: Campus) => { const r = feeRange(c)?.rows.find((x) => x.fee_category === cat); return r ? rupees(r.tuition_per_year) : "—"; },
    })),
    { label: "Tuition for 4 years", cell: (c) => { const r = feeRange(c); return r ? `${rupees(r.min * 4)} – ${rupees(r.max * 4)}` : "—"; } },
    { label: "Hostel (per year)", cell: (c) => (c.hostel_fee_min !== null || c.hostel_fee_max !== null ? `${rupees(c.hostel_fee_min)} – ${rupees(c.hostel_fee_max)}` : "—") },
    {
      label: "Branches",
      cell: (c) => (c.branches.length ? <ul className="space-y-0.5">{c.branches.map((b) => <li key={b} className="flex gap-1.5"><CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />{b}</li>)}</ul> : "—"),
    },
    { label: "Notes", cell: (c) => (c.notes ? <span className="whitespace-pre-line text-slate-600">{c.notes}</span> : "—") },
    {
      label: "Official page",
      cell: (c) => (c.website ? <a href={c.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-brand-700 underline">Visit <ExternalIcon className="h-3 w-3" /></a> : "—"),
    },
  ];

  return (
    <div>
      <fieldset className="mb-4">
        <legend className="mb-2 text-sm font-bold text-slate-800">Pick 2 or 3 campuses</legend>
        <div className="flex flex-wrap gap-2">
          {campuses.map((c) => {
            const on = picked.includes(c.id);
            return (
              <button key={c.id} type="button" onClick={() => toggle(c.id)} aria-pressed={on} className={`rounded-full px-4 py-2 text-sm font-semibold ring-1 transition ${on ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"}`}>
                {on && "✓ "}{c.name}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="bg-slate-50">
              <th className="w-40 px-4 py-3 text-xs uppercase tracking-wide text-slate-500" scope="col"><span className="sr-only">Detail</span></th>
              {chosen.map((c) => <th key={c.id} scope="col" className="px-4 py-3 text-base font-extrabold text-slate-900">{c.name}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.label} className="align-top">
                <th scope="row" className="bg-slate-50/60 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">{r.label}</th>
                {chosen.map((c) => <td key={c.id} className="px-4 py-3 text-slate-800">{r.cell(c)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        {anySample && <p className="bg-red-600 px-4 py-2 text-center text-xs font-extrabold uppercase tracking-wide text-white">Sample data — not real fees or campus details</p>}
      </div>
    </div>
  );
}
