"use client";

// Admin → Important Dates: timeline events (add / edit / delete / reorder) + Latest Updates.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  deleteImportantDate, deleteSiteUpdate, moveImportantDate, saveImportantDate, saveSiteUpdate, sortImportantDatesByDate,
  type ImportantDateInput, type SiteUpdateInput,
} from "@/app/admin/actions";
import { formatDate, formatDayIST } from "@/lib/format";
import { CATEGORY_LABEL, type DateCategory, type DateStatus } from "@/lib/important-dates-shared";
import { ArrowDownIcon, ArrowUpIcon, EditIcon, ExternalIcon, PlusIcon, TrashIcon } from "../Icons";
import { AdminHeader, Label, Modal, Notice, Toggle } from "./ui";

export type AdminDate = {
  id: string; title: string; category: DateCategory; start_date: string; end_date: string | null; description: string | null;
  official_link: string | null; sort_order: number; is_published: boolean; is_sample: boolean; status: DateStatus;
};
export type AdminUpdate = { id: string; title: string; body: string | null; link: string | null; is_pinned: boolean; is_published: boolean; published_at: string };

const STATUS: Record<DateStatus, string> = { upcoming: "bg-sky-50 text-sky-700", ongoing: "bg-emerald-50 text-emerald-700", completed: "bg-slate-100 text-slate-500" };
const istDay = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(iso));

export default function DatesManager({ dates, updates, setupMissing }: { dates: AdminDate[]; updates: AdminUpdate[]; setupMissing: boolean }) {
  const router = useRouter();
  const [editDate, setEditDate] = useState<AdminDate | "new" | null>(null);
  const [editUpdate, setEditUpdate] = useState<AdminUpdate | "new" | null>(null);
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, after?: () => void) =>
    start(async () => {
      const res = await fn();
      if (res.ok && !res.message) setMsg(null);
      else setMsg(res.ok ? { kind: "success", text: res.message! } : { kind: "error", text: res.error ?? "Something went wrong." });
      if (res.ok) {
        after?.();
        router.refresh();
      }
    });

  return (
    <>
      <AdminHeader title="Important Dates" subtitle="The timeline on /important-dates. The next 3 events also show on the home page and student dashboard.">
        <a href="/important-dates" target="_blank" rel="noopener noreferrer" className="btn-light">View page <ExternalIcon /></a>
        <button type="button" onClick={() => setEditDate("new")} disabled={setupMissing} className="btn-primary disabled:opacity-50"><PlusIcon className="h-4 w-4" /> Add event</button>
      </AdminHeader>
      {setupMissing && <div className="mb-4"><Notice kind="error">Run supabase/important-dates.sql in Supabase → SQL Editor first.</Notice></div>}
      {msg && <div className="mb-4"><Notice kind={msg.kind}>{msg.text}</Notice></div>}
      <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
        ⚠️ Only add dates from the official VIT website, and add the official link to each event. Status (Upcoming / Ongoing / Completed) updates by itself.
      </p>

      <div className={`card overflow-x-auto ${pending ? "opacity-60" : ""}`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-bold text-slate-700">{dates.length} event{dates.length === 1 ? "" : "s"} · shown in this order</p>
          <button type="button" onClick={() => run(() => sortImportantDatesByDate())} disabled={dates.length < 2} className="text-sm font-semibold text-brand-700 hover:underline disabled:opacity-40">Sort by date</button>
        </div>
        <table className="w-full min-w-[820px] text-left text-sm">
          <tbody className="divide-y divide-slate-100">
            {dates.length === 0 && <tr><td className="px-4 py-10 text-center text-slate-500">No events yet. Click “Add event”.</td></tr>}
            {dates.map((d, i) => (
              <tr key={d.id} className={d.is_published ? "" : "bg-slate-50"}>
                <td className="w-16 px-3 py-3">
                  <div className="flex flex-col gap-1">
                    <button type="button" onClick={() => run(() => moveImportantDate(d.id, -1))} disabled={i === 0} className="btn-light !px-2 !py-1 disabled:opacity-30" aria-label="Move up"><ArrowUpIcon className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={() => run(() => moveImportantDate(d.id, 1))} disabled={i === dates.length - 1} className="btn-light !px-2 !py-1 disabled:opacity-30" aria-label="Move down"><ArrowDownIcon className="h-3.5 w-3.5" /></button>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <p className="font-bold text-slate-900">
                    {d.title} {d.is_sample && <span className="ml-1 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-extrabold text-rose-700">SAMPLE</span>}
                    {!d.is_published && <span className="ml-1 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">HIDDEN</span>}
                  </p>
                  <p className="text-xs text-slate-500">{CATEGORY_LABEL[d.category]}{d.description ? ` · ${d.description.slice(0, 90)}${d.description.length > 90 ? "…" : ""}` : ""}</p>
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-slate-700">{formatDate(d.start_date, true)}{d.end_date ? ` – ${formatDate(d.end_date, true)}` : ""}</td>
                <td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${STATUS[d.status]}`}>{d.status}</span></td>
                <td className="px-3 py-3">{d.official_link ? <a href={d.official_link} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-brand-700 hover:underline">Official link</a> : <span className="text-xs text-amber-700">No link</span>}</td>
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setEditDate(d)} className="btn-light !px-2.5 !py-1.5" aria-label={`Edit ${d.title}`}><EditIcon /></button>
                    <button type="button" onClick={() => confirm(`Delete "${d.title}"?`) && run(() => deleteImportantDate(d.id))} className="btn-light !px-2.5 !py-1.5 !text-red-600" aria-label={`Delete ${d.title}`}><TrashIcon /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ---------- Latest Updates ---------- */}
      <div className="mt-10 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Latest Updates</h2>
          <p className="text-sm text-slate-500">Short news posts shown next to the timeline. Pinned posts stay on top.</p>
        </div>
        <button type="button" onClick={() => setEditUpdate("new")} disabled={setupMissing} className="btn-primary disabled:opacity-50"><PlusIcon className="h-4 w-4" /> New update</button>
      </div>
      <ul className="card mt-4 divide-y divide-slate-100">
        {updates.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-500">No updates yet.</li>}
        {updates.map((u) => (
          <li key={u.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-4">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                {formatDayIST(u.published_at)}
                {u.is_pinned && <span className="rounded bg-accent-100 px-1.5 py-0.5 font-bold text-accent-800">📌 Pinned</span>}
                {!u.is_published && <span className="rounded bg-slate-200 px-1.5 py-0.5 font-bold text-slate-600">Hidden</span>}
                {u.is_published && new Date(u.published_at) > new Date() && <span className="rounded bg-sky-100 px-1.5 py-0.5 font-bold text-sky-700">Scheduled</span>}
              </p>
              <p className="mt-0.5 font-bold text-slate-900">{u.title}</p>
              {u.body && <p className="mt-0.5 line-clamp-2 text-sm text-slate-600">{u.body}</p>}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditUpdate(u)} className="btn-light !px-2.5 !py-1.5" aria-label={`Edit ${u.title}`}><EditIcon /></button>
              <button type="button" onClick={() => confirm(`Delete "${u.title}"?`) && run(() => deleteSiteUpdate(u.id))} className="btn-light !px-2.5 !py-1.5 !text-red-600" aria-label={`Delete ${u.title}`}><TrashIcon /></button>
            </div>
          </li>
        ))}
      </ul>

      {editDate && <DateForm d={editDate === "new" ? null : editDate} pending={pending} onClose={() => setEditDate(null)} onSave={(v) => run(() => saveImportantDate(v), () => setEditDate(null))} />}
      {editUpdate && <UpdateForm u={editUpdate === "new" ? null : editUpdate} pending={pending} onClose={() => setEditUpdate(null)} onSave={(v) => run(() => saveSiteUpdate(v), () => setEditUpdate(null))} />}
    </>
  );
}

function DateForm({ d, pending, onClose, onSave }: { d: AdminDate | null; pending: boolean; onClose: () => void; onSave: (v: ImportantDateInput) => void }) {
  const [f, setF] = useState({
    title: d?.is_sample ? "" : d?.title ?? "",
    category: d?.category ?? ("application" as DateCategory),
    start_date: d?.start_date ?? "",
    end_date: d?.end_date ?? "",
    description: d?.is_sample ? "" : d?.description ?? "",
    official_link: d?.official_link ?? "",
    is_published: d?.is_published ?? true,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  return (
    <Modal title={d ? "Edit event" : "Add event"} onClose={onClose}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSave({ id: d?.id, ...f }); }}>
        {d?.is_sample && <p className="rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">This is the SAMPLE event. Saving it with your own details turns it into a real event.</p>}
        <div><Label htmlFor="d-title">Title *</Label><input id="d-title" value={f.title} onChange={(e) => set("title", e.target.value)} className="input" placeholder="e.g. VITEEE application window" maxLength={150} required /></div>
        <div>
          <Label htmlFor="d-cat">Type</Label>
          <select id="d-cat" value={f.category} onChange={(e) => set("category", e.target.value as DateCategory)} className="input">
            {(Object.keys(CATEGORY_LABEL) as DateCategory[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label htmlFor="d-start">Date / start date *</Label><input id="d-start" type="date" value={f.start_date} onChange={(e) => set("start_date", e.target.value)} className="input" required /></div>
          <div><Label htmlFor="d-end">End date (for a range)</Label><input id="d-end" type="date" value={f.end_date} min={f.start_date || undefined} onChange={(e) => set("end_date", e.target.value)} className="input" /></div>
        </div>
        <div><Label htmlFor="d-desc">Short description</Label><textarea id="d-desc" rows={3} maxLength={600} value={f.description} onChange={(e) => set("description", e.target.value)} className="input" /></div>
        <div><Label htmlFor="d-link">Official link</Label><input id="d-link" type="url" value={f.official_link} onChange={(e) => set("official_link", e.target.value)} className="input" placeholder="https://vit.ac.in/…" /></div>
        <Toggle checked={f.is_published} onChange={(v) => set("is_published", v)} label="Show on the website" />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-light">Cancel</button>
          <button type="submit" disabled={pending} className="btn-primary disabled:opacity-60">{pending ? "Saving…" : "Save event"}</button>
        </div>
      </form>
    </Modal>
  );
}

function UpdateForm({ u, pending, onClose, onSave }: { u: AdminUpdate | null; pending: boolean; onClose: () => void; onSave: (v: SiteUpdateInput) => void }) {
  const [f, setF] = useState({
    title: u?.title ?? "",
    body: u?.body ?? "",
    link: u?.link ?? "",
    is_pinned: u?.is_pinned ?? false,
    is_published: u?.is_published ?? true,
    published_on: u ? istDay(u.published_at) : "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  return (
    <Modal title={u ? "Edit update" : "New update"} onClose={onClose}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSave({ id: u?.id, ...f }); }}>
        <div><Label htmlFor="u-title">Headline *</Label><input id="u-title" value={f.title} onChange={(e) => set("title", e.target.value)} className="input" maxLength={150} required /></div>
        <div><Label htmlFor="u-body">Details</Label><textarea id="u-body" rows={4} maxLength={1000} value={f.body} onChange={(e) => set("body", e.target.value)} className="input" /></div>
        <div><Label htmlFor="u-link">Link (optional)</Label><input id="u-link" type="url" value={f.link} onChange={(e) => set("link", e.target.value)} className="input" placeholder="https://…" /></div>
        <div><Label htmlFor="u-date">Date shown (empty = now; a future date schedules it)</Label><input id="u-date" type="date" value={f.published_on} onChange={(e) => set("published_on", e.target.value)} className="input" /></div>
        <div className="flex flex-wrap gap-6">
          <Toggle checked={f.is_pinned} onChange={(v) => set("is_pinned", v)} label="Pin to top" />
          <Toggle checked={f.is_published} onChange={(v) => set("is_published", v)} label="Show on the website" />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-light">Cancel</button>
          <button type="submit" disabled={pending} className="btn-primary disabled:opacity-60">{pending ? "Saving…" : "Save update"}</button>
        </div>
      </form>
    </Modal>
  );
}
