"use client";

// Admin → Settings → Contact mode: who sees your number (+91 …) and the WhatsApp buttons.
//   Open    → everyone: number + Call + WhatsApp (contact page, footer, floating button, founder section)
//   Private → only paid students and admins (Help page, booking confirmation, payment success);
//             everyone else gets the free enquiry form
// Saved in supabase/contact-mode.sql. The number itself stays in CONTACT_PHONE (server).
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveContactMode } from "@/app/admin/actions";
import { LockIcon, PhoneIcon } from "../Icons";
import { Label, Notice } from "./ui";

type Value = { mode: "open" | "private"; openNote: string; privateNote: string };

export default function ContactModeCard({ initial, setupMissing }: { initial: Value; setupMissing: boolean }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const changed = v.mode !== saved.mode || v.openNote !== saved.openNote || v.privateNote !== saved.privateNote;

  const option = (mode: Value["mode"], title: string, text: string, Icon: typeof PhoneIcon) => (
    <label className={`flex cursor-pointer gap-3 rounded-2xl p-4 ring-2 transition ${v.mode === mode ? "bg-brand-50 ring-brand-600" : "bg-white ring-slate-200 hover:ring-slate-300"}`}>
      <input type="radio" name="contact-mode" value={mode} checked={v.mode === mode} onChange={() => setV({ ...v, mode })} className="mt-1 h-4 w-4 accent-brand-600" />
      <span>
        <span className="flex items-center gap-1.5 font-extrabold text-slate-900"><Icon className="h-4 w-4" /> {title}</span>
        <span className="mt-1 block text-sm text-slate-600">{text}</span>
      </span>
    </label>
  );

  return (
    <section id="contact-mode" className="card mb-8 scroll-mt-24 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><PhoneIcon className="h-6 w-6" /></span>
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">Contact mode</h2>
          <p className="text-sm text-slate-500">Who sees your number (calls and WhatsApp use the same number). The number itself stays on the server (CONTACT_PHONE in Vercel).</p>
        </div>
      </div>
      {setupMissing && <div className="mt-4"><Notice kind="error">Run supabase/contact-mode.sql in Supabase → SQL Editor first. Until then the website uses Open mode with the default text.</Notice></div>}
      <form
        className="mt-5 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (v.mode !== saved.mode && !confirm(v.mode === "open" ? "Switch to OPEN?\n\nYour full number will be shown to everyone with Call and WhatsApp buttons." : "Switch to PRIVATE?\n\nYour number and WhatsApp buttons will be hidden from visitors and students who haven't paid. They'll see the enquiry form instead.")) return;
          start(async () => {
            const res = await saveContactMode(v);
            setMsg(res.ok ? { kind: "success", text: res.message ?? "Saved." } : { kind: "error", text: res.error });
            if (res.ok) { setSaved(v); router.refresh(); }
          });
        }}
      >
        <fieldset disabled={setupMissing || pending} className="grid gap-3 md:grid-cols-2">
          <legend className="sr-only">Contact mode</legend>
          {option("open", "Open (Setup A)", "Everyone sees the full number with Call and WhatsApp buttons — contact page, footer, floating button and founder section.", PhoneIcon)}
          {option("private", "Private (Setup B)", "Only paid students and admins see the number (Help page, booking confirmation, payment success). Everyone else gets the free enquiry form.", LockIcon)}
        </fieldset>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="cm-open">Text in Open mode</Label>
            <textarea id="cm-open" rows={3} maxLength={300} value={v.openNote} disabled={setupMissing} onChange={(e) => setV({ ...v, openNote: e.target.value })} className="input" />
            <p className="mt-1 text-xs text-slate-500">Shown on the contact page and in the footer.</p>
          </div>
          <div>
            <Label htmlFor="cm-private">Text in Private mode</Label>
            <textarea id="cm-private" rows={3} maxLength={300} value={v.privateNote} disabled={setupMissing} onChange={(e) => setV({ ...v, privateNote: e.target.value })} className="input" />
            <p className="mt-1 text-xs text-slate-500">Shown with the free enquiry form.</p>
          </div>
        </div>
        <button type="submit" disabled={setupMissing || pending || !changed} className="btn-primary disabled:opacity-60">{pending ? "Saving…" : changed ? "Save contact mode" : "Saved"}</button>
      </form>
      {msg && <div className="mt-3"><Notice kind={msg.kind}>{msg.text}</Notice></div>}
    </section>
  );
}
