"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveReferralSettings } from "@/app/admin/actions";
import { GiftIcon } from "../Icons";
import { Label, Notice, Toggle } from "./ui";

/** Admin → Settings → Referrals: amounts + on/off. */
export default function ReferralSettingsForm({ initial }: { initial: { enabled: boolean; referred_discount: number; referrer_reward: number } | null }) {
  const router = useRouter();
  const [f, setF] = useState({ enabled: initial?.enabled ?? true, referred_discount: String(initial?.referred_discount ?? 100), referrer_reward: String(initial?.referrer_reward ?? 100) });
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <section id="referrals" className="card mb-8 scroll-mt-24 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent-400 text-brand-950"><GiftIcon className="h-5 w-5" /></span>
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">Referrals</h2>
          <p className="text-sm text-slate-500">A new student who signs up with a friend&apos;s link gets money off their first payment. The friend gets reward credit after that payment succeeds.</p>
        </div>
      </div>
      {!initial ? (
        <div className="mt-4"><Notice kind="error">Run supabase/coupons-referrals.sql in Supabase → SQL Editor first.</Notice></div>
      ) : (
        <form
          className="mt-5 grid gap-4 sm:grid-cols-[auto_1fr_1fr_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await saveReferralSettings(f);
              setMsg(res.ok ? { kind: "success", text: res.message ?? "Saved." } : { kind: "error", text: res.error });
              if (res.ok) router.refresh();
            });
          }}
        >
          <div className="pb-2"><Toggle checked={f.enabled} onChange={(v) => setF({ ...f, enabled: v })} label={f.enabled ? "On" : "Off"} /></div>
          <div><Label htmlFor="rf-off">New student gets (₹ off first payment)</Label><input id="rf-off" type="number" min={0} max={10000} inputMode="numeric" value={f.referred_discount} onChange={(e) => setF({ ...f, referred_discount: e.target.value })} className="input" /></div>
          <div><Label htmlFor="rf-rew">Referrer gets (₹ reward credit)</Label><input id="rf-rew" type="number" min={0} max={10000} inputMode="numeric" value={f.referrer_reward} onChange={(e) => setF({ ...f, referrer_reward: e.target.value })} className="input" /></div>
          <button type="submit" disabled={pending} className="btn-primary disabled:opacity-60">{pending ? "Saving…" : "Save"}</button>
        </form>
      )}
      {msg && <div className="mt-3"><Notice kind={msg.kind}>{msg.text}</Notice></div>}
    </section>
  );
}
