"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { markUpdatesRead } from "@/lib/material-actions";
import { formatDateTime } from "@/lib/format";

export type BellItem = { id: string; text: string; at: string; href: string; unread: boolean };

const Bell = ({ className = "h-5 w-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

/** The bell button + dropdown. Clicking an update marks it read and opens that course / subject. */
export default function BellMenu({ items }: { items: BellItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [readNow, setReadNow] = useState<Set<string>>(new Set());
  const box = useRef<HTMLDivElement>(null);
  const unread = items.filter((i) => i.unread && !readNow.has(i.id));

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function go(item: BellItem) {
    setReadNow((r) => new Set(r).add(item.id));
    setOpen(false);
    await markUpdatesRead([item.id]);
    router.push(item.href);
    router.refresh();
  }
  async function readAll() {
    const ids = unread.map((i) => i.id);
    setReadNow((r) => new Set([...r, ...ids]));
    await markUpdatesRead(ids);
    router.refresh();
  }

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={unread.length ? `${unread.length} new update${unread.length === 1 ? "" : "s"}` : "Updates"}
        className="relative grid h-11 w-11 place-items-center rounded-full bg-white text-brand-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
      >
        <Bell />
        {unread.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[11px] font-extrabold text-white">{unread.length > 9 ? "9+" : unread.length}</span>
        )}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-extrabold text-slate-900">Updates</p>
            {unread.length > 0 && (
              <button type="button" onClick={() => void readAll()} className="text-xs font-semibold text-brand-700 hover:underline">Mark all as read</button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">No updates yet. New PDFs in your courses will show here.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {items.map((i) => {
                const isUnread = i.unread && !readNow.has(i.id);
                return (
                  <li key={i.id}>
                    <button type="button" role="menuitem" onClick={() => void go(i)} className={`flex w-full items-start gap-2.5 px-4 py-3 text-left text-sm hover:bg-slate-50 ${isUnread ? "bg-accent-400/10" : ""}`}>
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${isUnread ? "bg-red-600" : "bg-transparent"}`} aria-hidden />
                      <span className="min-w-0">
                        <span className={`block ${isUnread ? "font-bold text-slate-900" : "text-slate-600"}`}>{i.text}</span>
                        <span className="block text-xs text-slate-400">{formatDateTime(i.at)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
