"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { updatePassword } from "@/lib/auth";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { Field } from "./ContactForm";
import { CheckIcon, LockIcon } from "./Icons";

const MIN = 8;

// Opened from the email link. /auth/callback has already logged the user in
// for this one purpose; here they choose the new password.
export default function ResetPasswordForm() {
  const router = useRouter();
  const [state, setState] = useState<"checking" | "ready" | "expired" | "done">("checking");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Is the reset link valid? (an error in the address, or no login session = expired/used link)
  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      const url = window.location.search + window.location.hash;
      const linkError = /error|otp_expired|access_denied/i.test(url);
      setState(!linkError && data.session ? "ready" : "expired");
    });
  }, []);

  // After success, go to the dashboard
  useEffect(() => {
    if (state !== "done") return;
    const id = setTimeout(() => router.replace("/dashboard"), 2500);
    return () => clearTimeout(id);
  }, [state, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (pw.length < MIN) return setError(`Your password must be at least ${MIN} characters.`);
    if (pw !== pw2) return setError("The two passwords don't match. Please type them again.");
    setSaving(true);
    const res = await updatePassword(pw);
    setSaving(false);
    if (res.ok) return setState("done");
    if (res.message === "expired") return setState("expired");
    setError(res.message ?? "Could not save your password. Please try again.");
  }

  if (state === "checking") return <p className="py-8 text-center text-slate-500" aria-busy="true">Checking your link…</p>;

  if (state === "expired") {
    return (
      <div className="animate-fade-up text-center" role="alert">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-red-50 text-red-600"><LockIcon className="h-8 w-8" /></span>
        <p className="mt-4 font-bold text-brand-700">This link has expired or was already used</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Reset links work only once and for a limited time. They also need to be opened on the same device and browser where you asked for them.
        </p>
        <Link href="/forgot-password" className="btn-primary mt-6 w-full !py-3.5">Request a new link</Link>
        <Link href="/login" className="mt-3 block text-sm font-semibold text-brand-600 hover:underline">Back to Sign In</Link>
      </div>
    );
  }

  if (state === "done") {
    return (
      <div className="animate-fade-up text-center" role="status">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-green-100 text-green-600"><CheckIcon className="h-8 w-8" /></span>
        <p className="mt-4 font-bold text-brand-700">Password changed successfully 🎉</p>
        <p className="mt-2 text-sm text-slate-600">Taking you to your dashboard…</p>
        <Link href="/dashboard" className="btn-primary mt-6 w-full">Go to Dashboard now</Link>
      </div>
    );
  }

  const strong = pw.length >= MIN;
  const match = pw2.length > 0 && pw === pw2;

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <PasswordField id="np-1" label="New password" value={pw} onChange={setPw} show={show1} toggle={() => setShow1((v) => !v)} autoComplete="new-password" />
      <PasswordField id="np-2" label="Confirm new password" value={pw2} onChange={setPw2} show={show2} toggle={() => setShow2((v) => !v)} autoComplete="new-password" />
      <ul className="space-y-1 text-xs">
        <li className={strong ? "text-green-700" : "text-slate-500"}>{strong ? "✓" : "•"} At least {MIN} characters</li>
        <li className={match ? "text-green-700" : "text-slate-500"}>{match ? "✓" : "•"} Both passwords match</li>
      </ul>
      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-200">{error}</p>}
      <button type="submit" disabled={saving} className="btn-primary w-full !py-3.5 text-base disabled:opacity-60">
        {saving ? "Saving…" : "Save new password"}
      </button>
    </form>
  );
}

function PasswordField({ id, label, value, onChange, show, toggle, autoComplete }: {
  id: string; label: string; value: string; onChange: (v: string) => void; show: boolean; toggle: () => void; autoComplete: string;
}) {
  return (
    <Field label={label} htmlFor={id}>
      <div className="relative">
        <input id={id} type={show ? "text" : "password"} autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)} className="input !pr-16" required minLength={MIN} />
        <button type="button" onClick={toggle} aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} aria-pressed={show}
          className="absolute inset-y-0 right-3 my-auto h-fit rounded-md px-1 text-xs font-bold text-brand-600 hover:text-accent-700">
          {show ? "Hide" : "Show"}
        </button>
      </div>
    </Field>
  );
}
