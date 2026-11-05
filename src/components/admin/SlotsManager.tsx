"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addSlot, addSlotsBulk, deleteSlot, setSlotAvailable } from "@/app/admin/actions";
import { formatDate, formatPrice, formatTime } from "@/lib/format";
import { PlusIcon, TrashIcon } from "../Icons";
import { AdminHeader, Label, Modal, Notice, Toggle } from "./ui";

export type AdminSlot = {
  id: string; date: string; start_time: string; end_time: string; price: number; is_available: boolean;
  bookings: { id: string; name: string; status: string }[];
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function SlotsManager({ slots, today }: { slots: AdminSlot[]; today: string }) {
  const router = useRouter();
  const [modal, setModal] = useState<"single" | "bulk" | null>(null);
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, after?: () => void) =>
    start(async () => {
      const res = await fn();
      setMsg(res.ok ? (res.message ? { kind: "success", text: res.message } : null) : { kind: "error", text: res.error ?? "Something went wrong." });
      if (res.ok) { after?.(); router.refresh(); }
    });

  const byDate = slots.reduce<Record<string, AdminSlot[]>>((acc, s) => ((acc[s.date] ??= []).push(s), acc), {});

  return (
    <>
      <AdminHeader title="Counselling slots" subtitle="Upcoming slots students can book.">
        <button type="button" onClick={() => setModal("single")} className="btn-light"><PlusIcon /> Add one slot</button>
        <button type="button" onClick={() => setModal("bulk")} className="btn-primary"><PlusIcon /> Add many slots</button>
      </AdminHeader>

      {msg && <div className="mb-4 whitespace-pre-line"><Notice kind={msg.kind}>{msg.text}</Notice></div>}

      {slots.length === 0 ? (
        <p className="card p-10 text-center text-slate-500">No upcoming slots. Click <strong>Add many slots</strong> to create a week of slots at once.</p>
      ) : (
        <div className={`space-y-4 ${pending ? "opacity-60" : ""}`}>
          {Object.entries(byDate).map(([date, list]) => (
            <section key={date} className="card p-4 sm:p-5">
              <h2 className="font-extrabold text-slate-900">{formatDate(date, true)}</h2>
              <ul className="mt-3 divide-y divide-slate-100">
                {list.map((s) => {
                  const active = s.bookings.find((b) => ["pending", "confirmed", "completed"].includes(b.status));
                  return (
                    <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div>
                        <p className="font-semibold text-slate-900">{formatTime(s.start_time)} – {formatTime(s.end_time)} <span className="font-normal text-slate-500">· {formatPrice(s.price)}</span></p>
                        <p className="text-xs">
                          {active ? <span className="font-semibold text-brand-700">Booked by {active.name} ({active.status})</span>
                            : s.is_available ? <span className="text-green-700">Available</span>
                            : <span className="text-slate-500">Unavailable</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {!active && <Toggle checked={s.is_available} onChange={(v) => run(() => setSlotAvailable(s.id, v))} label="Open" />}
                        <button
                          type="button"
                          onClick={() => confirm(`Delete the ${formatTime(s.start_time)} slot on ${formatDate(s.date)}?`) && run(() => deleteSlot(s.id))}
                          className="btn-light !px-3 !py-1.5 text-xs !text-red-600"
                        >
                          <TrashIcon /> Delete
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {modal === "single" && <SingleSlotForm today={today} onClose={() => setModal(null)} onSubmit={(v) => run(() => addSlot(v), () => setModal(null))} pending={pending} />}
      {modal === "bulk" && <BulkSlotForm today={today} onClose={() => setModal(null)} onSubmit={(v) => run(() => addSlotsBulk(v), () => setModal(null))} pending={pending} />}
    </>
  );
}

function SingleSlotForm({ today, onClose, onSubmit, pending }: { today: string; onClose: () => void; onSubmit: (v: { date: string; start: string; end: string; price: string }) => void; pending: boolean }) {
  const [v, setV] = useState({ date: today, start: "10:00", end: "10:45", price: "999" });
  return (
    <Modal title="Add one slot" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(v); }} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Label htmlFor="ss-date">Date</Label><input id="ss-date" type="date" min={today} value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} className="input" required /></div>
        <div><Label htmlFor="ss-start">Start time</Label><input id="ss-start" type="time" value={v.start} onChange={(e) => setV({ ...v, start: e.target.value })} className="input" required /></div>
        <div><Label htmlFor="ss-end">End time</Label><input id="ss-end" type="time" value={v.end} onChange={(e) => setV({ ...v, end: e.target.value })} className="input" required /></div>
        <div className="sm:col-span-2"><Label htmlFor="ss-price">Price (₹)</Label><input id="ss-price" type="number" min={0} value={v.price} onChange={(e) => setV({ ...v, price: e.target.value })} className="input" required /></div>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" onClick={onClose} className="btn-light">Cancel</button>
          <button type="submit" disabled={pending} className="btn-primary disabled:opacity-60">Add slot</button>
        </div>
      </form>
    </Modal>
  );
}

function BulkSlotForm({ today, onClose, onSubmit, pending }: {
  today: string; onClose: () => void; pending: boolean;
  onSubmit: (v: { from: string; to: string; weekdays: number[]; times: { start: string; end: string }[]; price: string }) => void;
}) {
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [weekdays, setWeekdays] = useState([1, 2, 3, 4, 5, 6]);
  const [times, setTimes] = useState([{ start: "10:00", end: "10:45" }, { start: "15:00", end: "15:45" }, { start: "18:30", end: "19:15" }]);
  const [price, setPrice] = useState("999");

  return (
    <Modal title="Add many slots" onClose={onClose} wide>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit({ from, to, weekdays, times, price }); }} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div><Label htmlFor="bs-from">From date</Label><input id="bs-from" type="date" min={today} value={from} onChange={(e) => setFrom(e.target.value)} className="input" required /></div>
          <div><Label htmlFor="bs-to">To date</Label><input id="bs-to" type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} className="input" required /></div>
          <div><Label htmlFor="bs-price">Price per slot (₹)</Label><input id="bs-price" type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} className="input" required /></div>
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-slate-700">On these days</legend>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d, i) => {
              const n = i + 1;
              const on = weekdays.includes(n);
              return (
                <button key={d} type="button" aria-pressed={on} onClick={() => setWeekdays((w) => (on ? w.filter((x) => x !== n) : [...w, n]))}
                  className={`rounded-xl px-3.5 py-2 text-sm font-bold ring-1 ${on ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-slate-600 ring-slate-300"}`}>
                  {d}
                </button>
              );
            })}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-slate-700">At these times (every chosen day)</legend>
          <div className="space-y-2">
            {times.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="time" value={t.start} onChange={(e) => setTimes((ts) => ts.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} className="input" aria-label={`Time ${i + 1} start`} />
                <span className="text-slate-400">to</span>
                <input type="time" value={t.end} onChange={(e) => setTimes((ts) => ts.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} className="input" aria-label={`Time ${i + 1} end`} />
                <button type="button" onClick={() => setTimes((ts) => ts.filter((_, j) => j !== i))} className="btn-light !px-3 !text-red-600" aria-label={`Remove time ${i + 1}`}><TrashIcon /></button>
              </div>
            ))}
            <button type="button" onClick={() => setTimes((ts) => [...ts, { start: "12:00", end: "12:45" }])} className="btn-light !px-3 !py-2 text-sm"><PlusIcon /> Add time</button>
          </div>
        </fieldset>
        <p className="text-xs text-slate-500">Slots that already exist at the same date and start time are skipped.</p>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose} className="btn-light">Cancel</button>
          <button type="submit" disabled={pending} className="btn-primary disabled:opacity-60">{pending ? "Adding…" : "Create slots"}</button>
        </div>
      </form>
    </Modal>
  );
}
