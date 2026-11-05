"use client";

import Link from "next/link";
import { useState } from "react";
import { requestPasswordReset } from "@/lib/auth";
import { Field } from "./ContactForm";
import { MailIcon } from "./Icons";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSending(true);
    const res = await requestPasswordReset(email.trim());
    setSending(false);
    if (!res.ok) return setError(res.message ?? "Something went wrong. Please try again.");
    setSent(true);
  }

  if (sent) {
    return (
      <div className="animate-fade-up text-center" role="status">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-accent-100 text-accent-700"><MailIcon className="h-8 w-8" /></span>
        <p className="mt-4 font-bold text-brand-700">Check your email 📩</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          If this email is registered, we have sent a password reset link. Please check your inbox and spam folder.
        </p>
        <p className="mt-3 text-xs text-slate-500">The link works for a limited time. Open it on this same device and browser.</p>
        <button type="button" onClick={() => setSent(false)} className="btn-light mt-6 w-full">Send again</button>
        <Link href="/login" className="mt-3 block text-sm font-semibold text-brand-600 hover:underline">Back to Sign In</Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Your email" htmlFor="fp-email">
        <input id="fp-email" type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="Your email address" />
      </Field>
      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-200">{error}</p>}
      <button type="submit" disabled={sending} className="btn-primary w-full !py-3.5 text-base disabled:opacity-60">
        {sending ? "Sending…" : "Send reset link"}
      </button>
      <p className="text-center text-sm text-slate-600">
        Remembered it? <Link href="/login" className="font-bold text-brand-600 hover:underline">Sign In</Link>
      </p>
    </form>
  );
}
