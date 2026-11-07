"use client";

// Admin → Settings → Fees & Campuses: campus details + fee table
// (year × campus × fee category → rank range + tuition per year).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { copyFeeYear, deleteCampus, deleteFee, deleteSampleFees, saveCampus, saveFee, type CampusInput, type FeeInput } from "@/app/admin/actions";
import { rupees, type Campus, type CampusFee } from "@/lib/fees-shared";
import { EditIcon, ExternalIcon, PlusIcon, TrashIcon } from "../Icons";
import { AdminHeader, Label, Modal, Notice } from "./ui";

type Msg = { kind: "error" | "success"; text: string } | null;

export default function FeesManager({ campuses, fees }: { campuses: Campus[]; fees: CampusFee[] }) {
  const router = useRouter();
  const years = [...new Set(fees.map((f) => f.year))].sort((a, b) => b - a);
  const [year, setYear] = useState<number | null>(years[0] ?? null);
  const [campusForm, setCampusForm] = useState<Campus | "new" | null>(null);
  const [feeForm, setFeeForm] = useState<CampusFee | Partial<CampusFee> | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  const sampleCount = campuses.filter((c) => c.is_sample).length + fees.filter((f) => f.is_sample).length;

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, after?: () => void) =>
    start(async () => {
      const res = await fn();
      setMsg(res.ok ? { kind: "success", text: res.message ?? "Saved." } : { kind: "error", text: res.error ?? "Something went wrong." });
      if (res.ok) {
        after?.();
        router.refresh();
      }
    });

  const shownYear = year ?? years[0] ?? new Date().getFullYear();
  const rowsFor = (campus: string) => fees.filter((f) => f.campus === campus && f.year === shownYear).sort((a, b) => a.fee_category - b.fee_category);

  return (
    <>
      <AdminHeader title="Fees & Campuses" subtitle="Used by the public Fee Calculator & Campus Comparison page. Enter only official figures.">
        <Link href="/fee-calculator" target="_blank" className="btn-light"><ExternalIcon className="h-4 w-4" /> View page</Link>
        <Link href="/admin/settings" className="btn-light">← Settings</Link>
      </AdminHeader>
      {msg && <div className="mb-4"><Notice kind={msg.kind}>{msg.text}</Notice></div>}

      {sampleCount > 0 && (
        <div className="mb-5 flex flex-col gap-3 rounded-2xl bg-red-50 p-4 text-sm text-red-900 ring-2 ring-red-200 sm:flex-row sm:items-center sm:justify-between">
          <p><strong>⚠️ {sampleCount} SAMPLE rows</strong> (not real fees) are shown on the website with a red &ldquo;Sample data&rdquo; label. Edit them with real figures (saving removes the sample mark) or delete them all.</p>
          <button type="button" disabled={pending} onClick={() => confirm("Delete ALL sample campuses and fee rows? Rows you already edited are kept.") && run(() => deleteSampleFees())} className="btn-light shrink-0 !text-red-700">Delete all sample data</button>
        </div>
      )}

      {/* ---------- Campuses ---------- */}
      <section className={`card mb-6 p-5 ${pending ? "opacity-60" : ""}`}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-slate-900">Campuses ({campuses.length})</h2>
          <button type="button" onClick={() => setCampusForm("new")} className="btn-primary !px-4 !py-2 text-sm"><PlusIcon /> Add campus</button>
        </div>
        {campuses.length === 0 ? (
          <p className="text-sm text-slate-500">No campuses yet.</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {campuses.map((c) => (
              <li key={c.id} className={`rounded-2xl p-4 ring-1 ${c.is_sample ? "bg-red-50/50 ring-red-200" : "bg-slate-50 ring-slate-200"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-900">{c.name} {c.is_sample && <span className="ml-1 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-extrabold text-white">SAMPLE</span>}</p>
                    <p className="text-xs text-slate-500">{c.location ?? "—"}</p>
                  </div>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => setCampusForm(c)} className="btn-light !px-2.5 !py-1 text-xs" aria-label={`Edit ${c.name}`}><EditIcon /></button>
                    <button type="button" onClick={() => confirm(`Delete ${c.name} and ALL its fee rows?`) && run(() => deleteCampus(c.id))} className="btn-light !px-2.5 !py-1 text-xs !text-red-600" aria-label={`Delete ${c.name}`}><TrashIcon /></button>
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-600">{c.branches.length} branches · Hostel {rupees(c.hostel_fee_min)} – {rupees(c.hostel_fee_max)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------- Fees ---------- */}
      <section className={`card p-5 ${pending ? "opacity-60" : ""}`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-extrabold text-slate-900">Tuition fees</h2>
            {years.length > 0 && (
              <select value={shownYear} onChange={(e) => setYear(Number(e.target.value))} className="input !w-auto !py-1.5 text-sm" aria-label="Year">
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {years.length > 0 && (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  const to = Number(prompt(`Copy all ${shownYear} fee rows to which year? (then update the numbers)`, String(shownYear + 1)));
                  if (to) run(() => copyFeeYear(shownYear, to), () => setYear(to));
                }}
                className="btn-light !px-4 !py-2 text-sm"
              >
                Copy {shownYear} → new year
              </button>
            )}
            <button type="button" disabled={!campuses.length} onClick={() => setFeeForm({ year: shownYear, campus: campuses[0]?.name })} className="btn-primary !px-4 !py-2 text-sm disabled:opacity-50"><PlusIcon /> Add fee row</button>
          </div>
        </div>
        <p className="mb-4 text-xs text-slate-500">For each campus, add one row per fee category: the rank range it applies to and the tuition per year (₹). Leave &ldquo;rank to&rdquo; empty for the last category (&ldquo;and above&rdquo;).</p>

        <div className="space-y-5">
          {campuses.map((c) => {
            const rows = rowsFor(c.name);
            return (
              <div key={c.id}>
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-bold text-slate-800">{c.name}</p>
                  <button type="button" onClick={() => setFeeForm({ year: shownYear, campus: c.name, fee_category: Math.min(5, (rows.at(-1)?.fee_category ?? 0) + 1), rank_from: (rows.at(-1)?.rank_to ?? 0) + 1 })} className="text-xs font-semibold text-brand-700 underline">+ Add category</button>
                </div>
                {rows.length === 0 ? (
                  <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">No {shownYear} fees for this campus.</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl ring-1 ring-slate-200">
                    <table className="w-full min-w-[520px] text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr><th className="px-3 py-2">Category</th><th className="px-3 py-2">Rank range</th><th className="px-3 py-2 text-right">Tuition / year</th><th className="px-3 py-2 text-right">4 years</th><th className="px-3 py-2" /></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {rows.map((f) => (
                          <tr key={f.id} className={f.is_sample ? "bg-red-50/40" : ""}>
                            <td className="px-3 py-2 font-semibold">Category {f.fee_category} {f.is_sample && <span className="ml-1 rounded bg-red-600 px-1 text-[10px] font-extrabold text-white">SAMPLE</span>}</td>
                            <td className="px-3 py-2">{f.rank_from.toLocaleString("en-IN")} – {f.rank_to ? f.rank_to.toLocaleString("en-IN") : "above"}</td>
                            <td className="px-3 py-2 text-right font-semibold">{rupees(f.tuition_per_year)}</td>
                            <td className="px-3 py-2 text-right text-slate-500">{rupees(f.tuition_per_year * 4)}</td>
                            <td className="px-3 py-2 text-right">
                              <button type="button" onClick={() => setFeeForm(f)} className="rounded p-1 text-slate-500 hover:text-brand-700" aria-label="Edit fee"><EditIcon /></button>
                              <button type="button" onClick={() => confirm("Delete this fee row?") && run(() => deleteFee(f.id))} className="rounded p-1 text-slate-400 hover:text-red-600" aria-label="Delete fee"><TrashIcon /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {campusForm && <CampusForm campus={campusForm === "new" ? null : campusForm} pending={pending} onClose={() => setCampusForm(null)} onSubmit={(v) => run(() => saveCampus(v), () => setCampusForm(null))} />}
      {feeForm && <FeeForm fee={feeForm} campuses={campuses} pending={pending} onClose={() => setFeeForm(null)} onSubmit={(v) => run(() => saveFee(v), () => { setFeeForm(null); setYear(Number(v.year)); })} />}
    </>
  );
}

function CampusForm({ campus, pending, onClose, onSubmit }: { campus: Campus | null; pending: boolean; onClose: () => void; onSubmit: (v: CampusInput) => void }) {
  const [v, setV] = useState({
    name: campus?.name ?? "", location: campus?.location ?? "", branches: (campus?.branches ?? []).join("\n"),
    hostel_fee_min: campus?.hostel_fee_min?.toString() ?? "", hostel_fee_max: campus?.hostel_fee_max?.toString() ?? "",
    notes: campus?.notes ?? "", website: campus?.website ?? "", sort_order: String(campus?.sort_order ?? 0),
  });
  return (
    <Modal title={campus ? `Edit ${campus.name}` : "Add campus"} onClose={onClose} wide>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSubmit({ ...v, id: campus?.id }); }}>
        {campus?.is_sample && <p className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-800">This is SAMPLE data. Replace every field with official details — saving removes the SAMPLE label.</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label htmlFor="cf-name">Campus name *</Label><input id="cf-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} className="input" required /></div>
          <div><Label htmlFor="cf-loc">Location</Label><input id="cf-loc" value={v.location} onChange={(e) => setV({ ...v, location: e.target.value })} className="input" placeholder="City, State" /></div>
        </div>
        <div><Label htmlFor="cf-br">Branches (one per line)</Label><textarea id="cf-br" rows={5} value={v.branches} onChange={(e) => setV({ ...v, branches: e.target.value })} className="input" /></div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div><Label htmlFor="cf-hmin">Hostel fee from (₹/yr)</Label><input id="cf-hmin" inputMode="numeric" value={v.hostel_fee_min} onChange={(e) => setV({ ...v, hostel_fee_min: e.target.value })} className="input" /></div>
          <div><Label htmlFor="cf-hmax">Hostel fee to (₹/yr)</Label><input id="cf-hmax" inputMode="numeric" value={v.hostel_fee_max} onChange={(e) => setV({ ...v, hostel_fee_max: e.target.value })} className="input" /></div>
          <div><Label htmlFor="cf-sort">Order</Label><input id="cf-sort" type="number" value={v.sort_order} onChange={(e) => setV({ ...v, sort_order: e.target.value })} className="input" /></div>
        </div>
        <div><Label htmlFor="cf-web">Official page (https://…)</Label><input id="cf-web" type="url" value={v.website} onChange={(e) => setV({ ...v, website: e.target.value })} className="input" /></div>
        <div><Label htmlFor="cf-notes">Notes</Label><textarea id="cf-notes" rows={3} maxLength={1500} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} className="input" placeholder="e.g. campus size, highlights" /></div>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose} className="btn-light">Cancel</button>
          <button type="submit" disabled={pending} className="btn-primary disabled:opacity-60">Save campus</button>
        </div>
      </form>
    </Modal>
  );
}

function FeeForm({ fee, campuses, pending, onClose, onSubmit }: { fee: Partial<CampusFee>; campuses: Campus[]; pending: boolean; onClose: () => void; onSubmit: (v: FeeInput) => void }) {
  const [v, setV] = useState({
    year: String(fee.year ?? new Date().getFullYear()), campus: fee.campus ?? campuses[0]?.name ?? "", fee_category: String(fee.fee_category ?? 1),
    rank_from: fee.rank_from?.toString() ?? "", rank_to: fee.rank_to?.toString() ?? "", tuition_per_year: fee.tuition_per_year?.toString() ?? "", notes: fee.notes ?? "",
  });
  return (
    <Modal title={fee.id ? "Edit fee row" : "Add fee row"} onClose={onClose}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSubmit({ ...v, id: fee.id, rank_to: v.rank_to || null }); }}>
        {fee.is_sample && <p className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-800">SAMPLE row — enter the official figures. Saving removes the SAMPLE label.</p>}
        <div className="grid gap-4 sm:grid-cols-3">
          <div><Label htmlFor="ff-year">Year *</Label><input id="ff-year" type="number" value={v.year} onChange={(e) => setV({ ...v, year: e.target.value })} className="input" required /></div>
          <div className="sm:col-span-2">
            <Label htmlFor="ff-campus">Campus *</Label>
            <select id="ff-campus" value={v.campus} onChange={(e) => setV({ ...v, campus: e.target.value })} className="input">
              {campuses.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="ff-cat">Fee category *</Label>
            <select id="ff-cat" value={v.fee_category} onChange={(e) => setV({ ...v, fee_category: e.target.value })} className="input">
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Category {n}</option>)}
            </select>
          </div>
          <div><Label htmlFor="ff-from">Rank from *</Label><input id="ff-from" inputMode="numeric" value={v.rank_from} onChange={(e) => setV({ ...v, rank_from: e.target.value })} className="input" required /></div>
          <div><Label htmlFor="ff-to">Rank to</Label><input id="ff-to" inputMode="numeric" value={v.rank_to} onChange={(e) => setV({ ...v, rank_to: e.target.value })} className="input" placeholder="empty = and above" /></div>
        </div>
        <div><Label htmlFor="ff-fee">Tuition per year (₹) *</Label><input id="ff-fee" inputMode="numeric" value={v.tuition_per_year} onChange={(e) => setV({ ...v, tuition_per_year: e.target.value })} className="input" required /></div>
        <div><Label htmlFor="ff-notes">Note (not shown on the page)</Label><input id="ff-notes" value={v.notes} maxLength={500} onChange={(e) => setV({ ...v, notes: e.target.value })} className="input" placeholder="e.g. source: official fee PDF, date" /></div>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose} className="btn-light">Cancel</button>
          <button type="submit" disabled={pending} className="btn-primary disabled:opacity-60">Save</button>
        </div>
      </form>
    </Modal>
  );
}
