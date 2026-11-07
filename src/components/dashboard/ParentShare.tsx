"use client";

// Dashboard → Share with Parent: create / renew / turn off the private link.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { siteConfig } from "@/config/site";
import { createParentLink, revokeParentLink } from "@/lib/parent-actions";
import { formatDate, formatDateTime } from "@/lib/format";
import { CheckIcon, CopyIcon, MailIcon, WhatsAppIcon } from "../Icons";

export type ShareState = { status: "none" | "active" | "expired" | "off"; expires_at: string | null; parent_email: string | null; view_count: number; last_viewed_at: string | null; created_at: string | null };

export default function ParentShare({ share, studentFirst }: { share: ShareState; studentFirst: string }) {
  const router = useRouter();
  const [email, setEmail] = useState(share.parent_email ?? "");
  const [send, setSend] = useState(!!share.parent_email);
  const [link, setLink] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const create = () =>
    start(async () => {
      setMsg(null);
      const res = await createParentLink(email, send && !!email);
      if (!res.ok) return setMsg({ kind: "err", text: res.error });
      setLink(res.url);
      setMsg({ kind: "ok", text: res.message });
      router.refresh();
    });
  const turnOff = () => {
    if (!confirm("Turn off the parent link? Anyone with the link will no longer be able to see your progress.")) return;
    start(async () => {
      const res = await revokeParentLink();
      setLink(null);
      setMsg(res.ok ? { kind: "ok", text: "Parent link turned off." } : { kind: "err", text: res.error ?? "Something went wrong." });
      router.refresh();
    });
  };
  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* select manually */
    }
  };
  const active = share.status === "active";

  return (
    <div className="space-y-5">
      {/* Status */}
      <section className={`card p-5 sm:p-6 ${active ? "ring-2 ring-emerald-300" : ""}`}>
        {active ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700 ring-1 ring-emerald-200">● Parent link active</p>
              <p className="mt-2 text-sm text-slate-600">
                Works until <strong>{formatDate(share.expires_at!.slice(0, 10), true)}</strong>
                {share.parent_email ? <> · parent email: {share.parent_email}</> : null}
              </p>
              <p className="text-xs text-slate-500">{share.view_count ? `Opened ${share.view_count} time${share.view_count === 1 ? "" : "s"}${share.last_viewed_at ? ` · last ${formatDateTime(share.last_viewed_at)}` : ""}` : "Not opened yet"}</p>
            </div>
            <button type="button" onClick={turnOff} disabled={pending} className="btn-light !text-red-700">Turn off</button>
          </div>
        ) : (
          <p className="text-sm text-slate-600">
            {share.status === "expired" ? "⏰ Your parent link has expired. Create a new one below." : share.status === "off" ? "Your parent link is turned off." : "You haven't shared your progress yet."}
          </p>
        )}
      </section>

      {/* New link shown once */}
      {link && (
        <section className="card p-5 ring-2 ring-brand-300 sm:p-6">
          <p className="font-bold text-slate-900">Your private parent link</p>
          <p className="mt-1 text-xs text-slate-500">Copy it now — for your security it is shown only once. (Lost it? Just create a new one.)</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="input font-mono text-xs" aria-label="Parent link" />
            <button type="button" onClick={copy} className="btn-primary shrink-0">{copied ? <><CheckIcon className="h-4 w-4" /> Copied</> : <><CopyIcon className="h-4 w-4" /> Copy</>}</button>
          </div>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`Hi! Here is my VITEEE progress on ${siteConfig.businessName} (private link, please don't share): ${link}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary mt-3 !bg-[#25D366]"
          >
            <WhatsAppIcon className="h-4 w-4" /> Send on WhatsApp
          </a>
        </section>
      )}

      {/* Create / renew */}
      <section className="card p-5 sm:p-6">
        <h2 className="text-lg font-extrabold text-slate-900">{active ? "Renew the link" : "Create a parent link"}</h2>
        <p className="mt-1 text-sm text-slate-600">
          {active ? "Makes a new link for 90 days. The old link stops working immediately." : `Your parent can open it without logging in. It works for 90 days and you can turn it off any time.`}
        </p>
        <div className="mt-4 space-y-3">
          <div>
            <label htmlFor="ps-email" className="text-sm font-semibold text-slate-700">Parent&apos;s email (optional)</label>
            <div className="relative mt-1">
              <MailIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input id="ps-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="parent@example.com" className="input !pl-9" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={send} onChange={(e) => setSend(e.target.checked)} disabled={!email} className="h-4 w-4 accent-brand-600" />
            Also email the link to my parent
          </label>
          {msg && <p role={msg.kind === "err" ? "alert" : "status"} className={`text-sm font-semibold ${msg.kind === "err" ? "text-red-600" : "text-emerald-700"}`}>{msg.text}</p>}
          <button type="button" onClick={create} disabled={pending} className="btn-primary disabled:opacity-60">{pending ? "Working…" : active ? "Renew link" : "Create link"}</button>
        </div>
      </section>

      {/* What they see */}
      <section className="card p-5 text-sm sm:p-6">
        <p className="font-bold text-slate-900">What your parent can see</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <ul className="space-y-1.5 text-slate-700">
            {["Your name", "Booked and completed counselling sessions (date and time)", "Courses and material you bought (names only)", "Mock test scores and your progress chart", "Your latest predicted rank"].map((t) => (
              <li key={t} className="flex gap-2"><CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{t}</li>
            ))}
          </ul>
          <ul className="space-y-1.5 text-slate-700">
            {["Payments, prices or invoices", "Your phone number or email", "Your messages", "Anything they could change — it's view-only"].map((t) => (
              <li key={t} className="flex gap-2"><span className="mt-0.5 h-4 w-4 shrink-0 text-center font-bold leading-4 text-red-600">✕</span>{t}</li>
            ))}
          </ul>
        </div>
        <p className="mt-4 text-xs text-slate-500">Share it only with your parent or guardian, {studentFirst}. Anyone who has the link can see this page until it expires or you turn it off.</p>
      </section>
    </div>
  );
}
