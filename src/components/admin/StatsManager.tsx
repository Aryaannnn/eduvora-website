"use client";

// Admin → Settings → "Our results" numbers shown on the Home and About pages.
// Leave a number EMPTY to hide that stat. No numbers at all = section hidden.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveSiteStats } from "@/app/admin/actions";
import type { SiteStat } from "@/lib/types";
import { PlusIcon, TrashIcon } from "../Icons";
import { AdminHeader, Notice } from "./ui";

type Row = { id?: string; label: string; value: string; suffix: string };

export default function StatsManager({ stats }: { stats: SiteStat[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(stats.map((s) => ({ id: s.id, label: s.label, value: s.value === null ? "" : String(s.value), suffix: s.suffix })));
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = (i: number, patch: Partial<Row>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: number) =>
    setRows((r) => {
      const n = [...r];
      const j = i + d;
      if (j < 0 || j >= n.length) return r;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  const save = () =>
    start(async () => {
      const res = await saveSiteStats(rows);
      setMsg(res.ok ? { kind: "success", text: res.message ?? "Saved." } : { kind: "error", text: res.error });
      if (res.ok) router.refresh();
    });

  const shown = rows.filter((r) => r.value.trim() !== "" && r.label.trim()).length;

  return (
    <>
      <AdminHeader title="Settings" subtitle="Edit the numbers shown in the “Our results” section on the Home and About pages." />
      {msg && <div className="mb-4"><Notice kind={msg.kind}>{msg.text}</Notice></div>}

      <section className="card p-5 sm:p-6">
        <h2 className="text-lg font-extrabold text-slate-900">Results numbers</h2>
        <p className="mt-1 text-sm text-slate-600">
          Only use <strong>real numbers</strong>. Leave the number <strong>empty</strong> to hide a stat. {shown === 0 ? "Right now no stat has a number, so the section is hidden." : `${shown} stat${shown === 1 ? "" : "s"} will be shown.`}
        </p>

        <div className="mt-5 space-y-3">
          <div className="hidden grid-cols-[1fr_8rem_5rem_auto] gap-3 px-1 text-xs font-bold uppercase tracking-wider text-slate-500 sm:grid">
            <span>Label</span><span>Number</span><span>After it</span><span />
          </div>
          {rows.map((r, i) => (
            <div key={r.id ?? `new-${i}`} className={`grid gap-3 rounded-2xl p-3 ring-1 sm:grid-cols-[1fr_8rem_5rem_auto] sm:items-center ${r.value.trim() ? "bg-white ring-slate-200" : "bg-slate-50 ring-slate-200"}`}>
              <input value={r.label} onChange={(e) => set(i, { label: e.target.value })} maxLength={60} placeholder="e.g. Students guided" className="input" aria-label={`Stat ${i + 1} label`} />
              <input value={r.value} onChange={(e) => set(i, { value: e.target.value.replace(/\D/g, "").slice(0, 9) })} inputMode="numeric" placeholder="empty = hidden" className="input" aria-label={`Stat ${i + 1} number`} />
              <input value={r.suffix} onChange={(e) => set(i, { suffix: e.target.value.slice(0, 5) })} placeholder="+ or %" className="input" aria-label={`Stat ${i + 1} text after the number`} />
              <div className="flex gap-1.5">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="btn-light !px-2.5 !py-2 text-xs disabled:opacity-30" aria-label="Move up">↑</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} className="btn-light !px-2.5 !py-2 text-xs disabled:opacity-30" aria-label="Move down">↓</button>
                <button type="button" onClick={() => setRows((x) => x.filter((_, j) => j !== i))} className="btn-light !px-2.5 !py-2 text-xs !text-red-600" aria-label={`Remove stat ${i + 1}`}><TrashIcon /></button>
              </div>
              <p className="text-xs text-slate-500 sm:col-span-4">
                {r.value.trim() ? <>Shows as: <strong className="text-slate-800">{Number(r.value).toLocaleString("en-IN")}{r.suffix}</strong> {r.label}</> : "Hidden on the website (no number)."}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          {rows.length < 8 && (
            <button type="button" onClick={() => setRows((x) => [...x, { label: "", value: "", suffix: "+" }])} className="btn-light"><PlusIcon /> Add a stat</button>
          )}
          <button type="button" onClick={save} disabled={pending} className="btn-primary disabled:opacity-60">{pending ? "Saving…" : "Save"}</button>
        </div>
      </section>
    </>
  );
}
