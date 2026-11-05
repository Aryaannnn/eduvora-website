"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { Field } from "../ContactForm";
import { CheckIcon } from "../Icons";

// Edit name + phone. Email can't be changed here.
export default function ProfileForm({ userId, email, fullName, phone }: { userId: string; email: string; fullName: string; phone: string }) {
  const router = useRouter();
  const [name, setName] = useState(fullName);
  const [mobile, setMobile] = useState(phone);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    if (name.trim().length < 2) return setError("Please enter your full name.");
    if (mobile && !/^[6-9]\d{9}$/.test(mobile)) return setError("Please enter a valid 10-digit mobile number (or leave it empty).");
    const supabase = getBrowserSupabase();
    if (!supabase) return setError("Supabase is not connected.");

    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: name.trim(), phone: mobile ? `91${mobile}` : null })
      .eq("id", userId);
    setSaving(false);
    if (error) return setError(error.message);
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-5" noValidate>
      <Field label="Full name" htmlFor="p-name">
        <input id="p-name" value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} className="input" autoComplete="name" />
      </Field>
      <Field label="Mobile number" htmlFor="p-phone">
        <div className="flex">
          <span className="inline-flex items-center rounded-l-[0.8rem] border border-r-0 border-slate-300 bg-slate-50 px-3 font-semibold text-slate-600">+91</span>
          <input
            id="p-phone"
            type="tel"
            inputMode="numeric"
            maxLength={10}
            value={mobile}
            onChange={(e) => { setMobile(e.target.value.replace(/\D/g, "").slice(0, 10)); setSaved(false); }}
            className="input !rounded-l-none"
            placeholder="10-digit mobile number"
            autoComplete="tel-national"
          />
        </div>
      </Field>
      <Field label="Email" htmlFor="p-email">
        <input id="p-email" value={email} readOnly disabled className="input cursor-not-allowed !bg-slate-100 !text-slate-500" />
        <span className="mt-1.5 block text-xs text-slate-500">Your login email can&apos;t be changed here. Contact us if you need to update it.</span>
      </Field>

      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-200">{error}</p>}
      {saved && <p role="status" className="flex items-center gap-2 rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-700 ring-1 ring-green-200"><CheckIcon className="h-4 w-4" /> Profile saved</p>}

      <button type="submit" disabled={saving} className="btn-primary w-full sm:w-auto disabled:opacity-60">{saving ? "Saving…" : "Save changes"}</button>
    </form>
  );
}
