"use client";

import { useActionState } from "react";
import { sendEnquiry, type EnquiryState } from "@/lib/enquiry-actions";
import { CheckIcon } from "./Icons";

// FREE ENQUIRY FORM — saved to Supabase (table "enquiries").
// You see every enquiry in Admin → Enquiries, with Call / WhatsApp buttons.
export default function ContactForm({ source = "contact", defaultMessage = "" }: { source?: "contact" | "unlock"; defaultMessage?: string }) {
  const [state, action, pending] = useActionState<EnquiryState, FormData>(sendEnquiry, null);

  if (state?.ok) {
    return (
      <div className="rounded-2xl bg-emerald-50 p-6 text-center ring-1 ring-emerald-200" role="status">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-500 text-white"><CheckIcon className="h-6 w-6" /></span>
        <p className="mt-3 font-bold text-emerald-800">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="source" value={source} />
      {/* spam trap — hidden from people */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name *" htmlFor={`${source}-name`}>
          <input id={`${source}-name`} name="name" required minLength={2} maxLength={80} className="input" placeholder="e.g. Rahul Sharma" autoComplete="name" />
        </Field>
        <Field label="Phone number *" htmlFor={`${source}-phone`}>
          <input id={`${source}-phone`} name="phone" type="tel" inputMode="tel" required pattern="[0-9+\s\-]{10,16}" maxLength={16} className="input" placeholder="10-digit mobile" autoComplete="tel" />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email" htmlFor={`${source}-email`}>
          <input id={`${source}-email`} name="email" type="email" maxLength={120} className="input" placeholder="Your email address" autoComplete="email" />
        </Field>
        <Field label="Class / Year" htmlFor={`${source}-class`}>
          <select id={`${source}-class`} name="class_year" className="input" defaultValue="Class 12">
            {["Class 11", "Class 12", "Dropper / Repeater", "Parent", "Other"].map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Message" htmlFor={`${source}-message`}>
        <textarea id={`${source}-message`} name="message" rows={4} maxLength={1500} defaultValue={defaultMessage} className="input" placeholder="Your rank, questions, or what you'd like help with" />
      </Field>
      {state && !state.ok && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 ring-1 ring-rose-200" role="alert">{state.message}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full !py-3.5 text-base disabled:opacity-60">
        {pending ? "Sending…" : "Send Free Enquiry"}
      </button>
      <p className="text-center text-xs text-slate-500">Free — no payment needed. We usually call back within a few hours.</p>
    </form>
  );
}

export function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</label>
      {children}
    </div>
  );
}
