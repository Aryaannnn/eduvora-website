"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addSlot, addSlotsBulk, convertSlotsTo30, deleteSlot, setSlotAvailable } from "@/app/admin/actions";
import { dailyStarts, slotEnd } from "@/lib/slot-time";
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
  const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const longSlots = slots.filter((s) => minutes(s.end_time) - minutes(s.start_time) !== 30).length;

  return (
    <>
      <AdminHeader title="Counselling slots" subtitle="Every slot is a 30-minute voice call. Upcoming slots students can book (India time).">
        <button type="button" onClick={() => setModal("single")} className="btn-light"><PlusIcon /> Add one slot</button>
        <button type="button" onClick={() => setModal("bulk")} className="btn-primary"><PlusIcon /> Add many slots</button>
      </AdminHeader>

      {longSlots > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
          <p className="text-sm text-amber-900">
            <strong>{longSlots}</strong> upcoming slot{longSlots === 1 ? " is" : "s are"} not 30 minutes long. Empty ones can be replaced by 30-minute slots; booked or being-paid slots are never changed.
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (confirm("Convert future EMPTY slots to 30 minutes?\n\nEach empty slot that isn't 30 minutes long is replaced by back-to-back 30-minute slots (same price, same Open setting). Slots that are booked, being paid for, or were ever booked are NOT touched.")) run(() => convertSlotsTo30());
            }}
            className="btn-primary !py-2.5 text-sm disabled:opacity-60"
          >
            Convert future empty slots to 30 minutes
          </button>
        </div>
      )}

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

function SingleSlotForm({ today, onClose, onSubmit, pending }: { today: string; onClose: () => void; onSubmit: (v: { date: string; start: string; price: string }) => void; pending: boolean }) {
  const [v, setV] = useState({ date: today, start: "10:00", price: "499" });
  const end = v.start ? slotEnd(v.start) : null;
  return (
    <Modal title="Add one 30-minute slot" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(v); }} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Label htmlFor="ss-date">Date</Label><input id="ss-date" type="date" min={today} value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} className="input" required /></div>
        <div><Label htmlFor="ss-start">Start time (India time)</Label><input id="ss-start" type="time" step={1800} value={v.start} onChange={(e) => setV({ ...v, start: e.target.value })} className="input" required /></div>
        <div>
          <Label>End time (automatic)</Label>
          <p className="input bg-slate-50 font-semibold text-slate-700">{end ?? "—"}</p>
        </div>
        <div className="sm:col-span-2"><Label htmlFor="ss-price">Price (₹)</Label><input id="ss-price" type="number" min={0} value={v.price} onChange={(e) => setV({ ...v, price: e.target.value })} className="input" required /></div>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" onClick={onClose} className="btn-light">Cancel</button>
          <button type="submit" disabled={pending || !end} className="btn-primary disabled:opacity-60">Add slot</button>
        </div>
      </form>
    </Modal>
  );
}

function BulkSlotForm({ today, onClose, onSubmit, pending }: {
  today: string; onClose: () => void; pending: boolean;
  onSubmit: (v: { from: string; to: string; weekdays: number[]; dayStart: string; dayEnd: string; breakStart?: string; breakEnd?: string; price: string }) => void;
}) {
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [weekdays, setWeekdays] = useState([1, 2, 3, 4, 5, 6]);
  const [dayStart, setDayStart] = useState("10:00");
  const [dayEnd, setDayEnd] = useState("19:00");
  const [useBreak, setUseBreak] = useState(true);
  const [breakStart, setBreakStart] = useState("13:00");
  const [breakEnd, setBreakEnd] = useState("14:00");
  const [price, setPrice] = useState("499");
  const perDay = dayEnd > dayStart ? dailyStarts(dayStart, dayEnd, useBreak ? breakStart : undefined, useBreak ? breakEnd : undefined) : [];

  return (
    <Modal title="Add many 30-minute slots" onClose={onClose} wide>
      <form
        onSubmit={(e) => { e.preventDefault(); onSubmit({ from, to, weekdays, dayStart, dayEnd, ...(useBreak ? { breakStart, breakEnd } : {}), price }); }}
        className="space-y-5"
      >
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
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label htmlFor="bs-ds">Daily start time</Label><input id="bs-ds" type="time" step={1800} value={dayStart} onChange={(e) => setDayStart(e.target.value)} className="input" required /></div>
          <div><Label htmlFor="bs-de">Daily end time</Label><input id="bs-de" type="time" step={1800} value={dayEnd} onChange={(e) => setDayEnd(e.target.value)} className="input" required /></div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={useBreak} onChange={(e) => setUseBreak(e.target.checked)} className="h-4 w-4 accent-brand-600" /> Leave a break (optional)
          </label>
          {useBreak && (
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div><Label htmlFor="bs-bs">Break from</Label><input id="bs-bs" type="time" step={1800} value={breakStart} onChange={(e) => setBreakStart(e.target.value)} className="input" /></div>
              <div><Label htmlFor="bs-be">Break until</Label><input id="bs-be" type="time" step={1800} value={breakEnd} onChange={(e) => setBreakEnd(e.target.value)} className="input" /></div>
            </div>
          )}
        </div>
        <p className="rounded-xl bg-brand-50 p-3 text-sm text-brand-900 ring-1 ring-brand-100">
          {perDay.length > 0
            ? <>Each chosen day gets <strong>{perDay.length}</strong> slot{perDay.length === 1 ? "" : "s"} of 30 minutes: {perDay.slice(0, 4).join(", ")}{perDay.length > 4 ? ` … ${perDay[perDay.length - 1]}` : ""}.</>
            : "No 30-minute slot fits between those times."}
          {" "}Times in the past and times that already have a slot are skipped.
        </p>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose} className="btn-light">Cancel</button>
          <button type="submit" disabled={pending || perDay.length === 0} className="btn-primary disabled:opacity-60">{pending ? "Adding…" : "Create slots"}</button>
        </div>
      </form>
    </Modal>
  );
}
