"use client";

// Download button for FREE items. The file downloads as normal; a moment
// later a small popup suggests a related paid course or counselling.
// "Not now" closes it (and it won't show again for this item in this visit).
import Link from "next/link";
import { useState } from "react";
import { track } from "@/lib/analytics";
import { formatPrice } from "@/lib/format";
import type { Suggestion } from "@/lib/free-resources";
import { CalendarIcon, CloseIcon, DownloadIcon, RocketIcon } from "../Icons";

const shown = new Set<string>();

export default function FreeDownloadButton({ href, itemTitle, suggestion }: { href: string; itemTitle: string; suggestion: Suggestion }) {
  const [open, setOpen] = useState(false);

  function onClick() {
    track("free_resource", { action: "download" });
    if (shown.has(itemTitle)) return;
    shown.add(itemTitle);
    setTimeout(() => setOpen(true), 1200); // let the download start first
  }

  return (
    <>
      <a href={href} onClick={onClick} className="btn-primary !px-3 !py-2 text-sm"><DownloadIcon /> Download</a>
      {open && <SuggestPopup itemTitle={itemTitle} s={suggestion} onClose={() => setOpen(false)} />}
    </>
  );
}

function SuggestPopup({ itemTitle, s, onClose }: { itemTitle: string; s: Suggestion; onClose: () => void }) {
  const counselling = s.kind === "counselling";
  return (
    <div className="fixed inset-x-3 bottom-24 z-[70] mx-auto max-w-sm animate-fade-up sm:bottom-6 sm:left-auto sm:right-6 sm:mx-0" role="dialog" aria-labelledby="suggest-title">
      <div className="relative rounded-3xl bg-white p-5 shadow-2xl ring-1 ring-slate-200">
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          <CloseIcon className="h-4 w-4" />
        </button>
        <p className="pr-8 text-xs font-bold uppercase tracking-wider text-emerald-600">✓ Downloading</p>
        <p className="mt-0.5 line-clamp-1 pr-8 text-xs text-slate-500">{itemTitle}</p>
        <div className="mt-3 flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent-400 text-brand-950">
            {counselling ? <CalendarIcon className="h-5 w-5" /> : <RocketIcon className="h-5 w-5" />}
          </span>
          <div className="min-w-0">
            <p id="suggest-title" className="font-extrabold text-slate-900">{counselling ? "Want a personal plan for your rank?" : "Ready for the next step?"}</p>
            <p className="mt-0.5 text-sm text-slate-600">
              {counselling ? "Book a one-to-one counselling session for campus, branch and fee guidance." : <>Students who used this also take <strong className="text-slate-900">{s.title}</strong>{s.price > 0 && <> · {formatPrice(s.price)}</>}.</>}
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link href={s.href} onClick={onClose} className="btn-accent !px-3 !py-2.5 text-sm">{counselling ? "Book Counselling" : "View Details"}</Link>
          {counselling ? (
            <button type="button" onClick={onClose} className="btn-light !px-3 !py-2.5 text-sm">Not now</button>
          ) : (
            <Link href="/book-a-slot" onClick={onClose} className="btn-light !px-3 !py-2.5 text-sm">Book Counselling</Link>
          )}
        </div>
      </div>
    </div>
  );
}
