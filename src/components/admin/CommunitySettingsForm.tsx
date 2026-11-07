"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveCommunityLink } from "@/app/admin/actions";
import { WhatsAppIcon } from "../Icons";
import { Label, Notice } from "./ui";

/** Admin → Settings → WhatsApp community link (empty = banner hidden). */
export default function CommunitySettingsForm({ initial, setupMissing }: { initial: string; setupMissing: boolean }) {
  const router = useRouter();
  const [link, setLink] = useState(initial);
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <section id="community" className="card mb-8 scroll-mt-24 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#25D366] text-white"><WhatsAppIcon className="h-6 w-6" /></span>
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">WhatsApp community</h2>
          <p className="text-sm text-slate-500">
            When a link is saved, a &ldquo;Join our free VITEEE WhatsApp community&rdquo; banner shows on the home page, Important Dates, the student dashboard, after sign-up and in the welcome email. Leave it empty to hide it everywhere. Clicks are counted in Overview.
          </p>
        </div>
      </div>
      {setupMissing ? (
        <div className="mt-4"><Notice kind="error">Run supabase/whatsapp-community.sql in Supabase → SQL Editor first.</Notice></div>
      ) : (
        <form
          className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await saveCommunityLink(link);
              setMsg(res.ok ? { kind: "success", text: res.message ?? "Saved." } : { kind: "error", text: res.error });
              if (res.ok) router.refresh();
            });
          }}
        >
          <div className="flex-1">
            <Label htmlFor="wc-link">Community / group / channel invite link</Label>
            <input id="wc-link" type="url" value={link} onChange={(e) => setLink(e.target.value)} className="input" placeholder="https://chat.whatsapp.com/…  (empty = hidden)" />
          </div>
          <button type="submit" disabled={pending} className="btn-primary disabled:opacity-60">{pending ? "Saving…" : "Save"}</button>
        </form>
      )}
      {msg && <div className="mt-3"><Notice kind={msg.kind}>{msg.text}</Notice></div>}
    </section>
  );
}
