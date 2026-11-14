"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { track } from "@/lib/analytics";
import { requestFreeGuide } from "@/lib/guide-actions";
import { GUIDE_CLASSES } from "@/lib/guide-shared";
import { CheckIcon, CloseIcon, DownloadIcon, FileIcon, PhoneIcon } from "../Icons";
import { Spinner } from "../Spinner";

/** The popup window: form → "Your guide is ready" (download + Book a free enquiry call). */
export default function GuideForm({ title, onClose }: { title: string; onClose: () => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ url: string; emailed: boolean } | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    box.current?.querySelector<HTMLElement>("input:not([type=hidden]), a, button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [done]);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);
    start(async () => {
      const res = await requestFreeGuide(form);
      if (!res.ok) return setError(res.error);
      track("free_resource", { action: "guide", source: "popup" });
      setDone({ url: res.downloadUrl, emailed: res.emailed });
    });
  };

  return (
    <div className="fixed inset-0 z-[72] flex items-end justify-center bg-slate-950/55 p-3 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={box} role="dialog" aria-modal="true" aria-labelledby="guide-title" className="relative max-h-[92vh] w-full max-w-md animate-fade-up overflow-y-auto rounded-[1.5rem] bg-white p-6 shadow-2xl sm:p-7">
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800">
          <CloseIcon className="h-5 w-5" />
        </button>

        {!done ? (
          <>
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent-400 text-brand-950"><FileIcon className="h-6 w-6" /></span>
            <h2 id="guide-title" className="mt-4 pr-8 text-xl font-extrabold text-slate-900">Free: {title}</h2>
            <p className="mt-1.5 text-sm text-slate-600">Every step of VIT counselling on one page — documents, fee categories, choice filling and the dates you can&apos;t miss.</p>
            <form onSubmit={submit} className="mt-5 space-y-3" noValidate>
              {/* bots fill this hidden box, people never see it */}
              <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
              <div>
                <label htmlFor="g-name" className="mb-1 block text-xs font-bold text-slate-700">Your name</label>
                <input id="g-name" name="name" required minLength={2} maxLength={80} autoComplete="name" className="input" placeholder="e.g. Riya Sharma" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="g-email" className="mb-1 block text-xs font-bold text-slate-700">Email <span className="font-normal text-slate-500">(we send the link)</span></label>
                  <input id="g-email" name="email" type="email" maxLength={120} autoComplete="email" className="input" placeholder="you@email.com" />
                </div>
                <div>
                  <label htmlFor="g-phone" className="mb-1 block text-xs font-bold text-slate-700">or Phone</label>
                  <input id="g-phone" name="phone" type="tel" inputMode="numeric" maxLength={14} autoComplete="tel-national" className="input" placeholder="10-digit mobile" />
                </div>
              </div>
              <div>
                <label htmlFor="g-class" className="mb-1 block text-xs font-bold text-slate-700">Class</label>
                <select id="g-class" name="class_year" className="input" defaultValue="">
                  <option value="">Choose…</option>
                  {GUIDE_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-slate-50 p-3 text-xs leading-snug text-slate-600 ring-1 ring-slate-200">
                <input type="checkbox" name="consent" required className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600" />
                <span>
                  Send me the guide, and EDUVORA may contact me about VITEEE counselling. I can ask to delete my details any time.{" "}
                  <Link href="/privacy-policy" target="_blank" className="font-semibold text-brand-700 underline">Privacy Policy</Link>
                </span>
              </label>
              {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-200" role="alert">{error}</p>}
              <button type="submit" disabled={pending} className="btn-primary w-full !py-3.5 text-base disabled:opacity-70">
                {pending ? <><Spinner /> Getting your guide…</> : <><DownloadIcon className="h-4 w-4" /> Get the free guide</>}
              </button>
              <button type="button" onClick={onClose} className="w-full text-center text-sm font-semibold text-slate-500 hover:text-slate-800">No thanks</button>
            </form>
          </>
        ) : (
          <div className="text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-700"><CheckIcon className="h-7 w-7" /></span>
            <h2 id="guide-title" className="mt-4 text-xl font-extrabold text-slate-900">Your guide is ready!</h2>
            <p className="mt-1.5 text-sm text-slate-600">{done.emailed ? "We've also emailed you the download link." : "Download it now — the link works for 30 days."}</p>
            <a href={done.url} onClick={() => setDownloaded(true)} className="btn-accent mt-5 w-full !py-3.5 text-base">
              <DownloadIcon className="h-4 w-4" /> Download {title} (PDF)
            </a>
            <div className={`mt-5 rounded-2xl p-4 text-left ring-1 transition ${downloaded ? "bg-brand-50 ring-brand-200" : "bg-slate-50 ring-slate-200"}`}>
              <p className="font-bold text-slate-900">Want help with your own rank, campus or branch?</p>
              <p className="mt-1 text-sm text-slate-600">Send a free enquiry — our team will call you back. No payment needed.</p>
              <Link href="/contact#enquiry" onClick={onClose} className="btn-primary mt-3 w-full !py-3">
                <PhoneIcon className="h-4 w-4" /> Book a free enquiry call
              </Link>
            </div>
            <button type="button" onClick={onClose} className="mt-4 text-sm font-semibold text-slate-500 hover:text-slate-800">Close</button>
          </div>
        )}
      </div>
    </div>
  );
}
