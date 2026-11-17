"use client";

import { useState } from "react";
import { siteConfig } from "@/config/site";
import { CLASS_YEARS, normalizeINPhone, PHONE_INVALID } from "@/lib/phone";
import { saveMyProfile } from "@/lib/profile-actions";
import { useLogout } from "@/lib/useLogout";
import { PhoneIcon, WhatsAppIcon } from "../Icons";
import { Spinner } from "../Spinner";

// "Complete your profile": full name, mobile number (+91), class / year — all required.
// There is no "Skip": the website stays locked until the number is saved (log out is allowed).
export default function CompleteProfileForm({ next, fullName, phone, classYear, email, communityHref }: { next: string; fullName: string; phone: string; classYear: string; email: string; communityHref: string | null }) {
  const [name, setName] = useState(fullName);
  const [mobile, setMobile] = useState(phone);
  const [year, setYear] = useState(classYear);
  const [error, setError] = useState<{ text: string; field?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const { logout, loggingOut } = useLogout();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) return setError({ text: "Please enter your full name.", field: "name" });
    if (!normalizeINPhone(mobile)) return setError({ text: PHONE_INVALID, field: "phone" });
    if (!year) return setError({ text: "Please choose your class / year.", field: "classYear" });
    setSaving(true);
    const r = await saveMyProfile({ fullName: name, phone: mobile, classYear: year, requireClassYear: true });
    if (!r.ok) {
      setSaving(false);
      return setError({ text: r.error, field: r.field });
    }
    window.location.assign(next); // full load, so every part of the site sees the new profile
  }

  const bad = (f: string) => (error?.field === f ? "!ring-2 !ring-red-400" : "");

  return (
    <div className="animate-fade-up rounded-[1.75rem] bg-white p-6 shadow-2xl sm:p-8">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
        <PhoneIcon className="h-7 w-7" />
      </span>
      <h1 className="mt-4 text-center text-2xl font-extrabold text-slate-900">Complete your profile</h1>
      <p className="mt-2 text-center text-sm text-slate-600">
        Please add your mobile number to continue. The {siteConfig.businessName} team uses it for your counselling call, bookings and course updates.
      </p>
      {email && <p className="mt-1 text-center text-xs text-slate-500">Signed in as {email}</p>}

      <form onSubmit={save} className="mt-6 space-y-4" noValidate>
        <div>
          <label htmlFor="cp-name" className="mb-1.5 block text-sm font-semibold text-slate-700">Full name <span className="text-red-600">*</span></label>
          <input id="cp-name" value={name} onChange={(e) => setName(e.target.value)} className={`input ${bad("name")}`} autoComplete="name" maxLength={80} placeholder="e.g. Rahul Sharma" />
        </div>
        <div>
          <label htmlFor="cp-phone" className="mb-1.5 block text-sm font-semibold text-slate-700">Mobile number <span className="text-red-600">*</span></label>
          <div className="flex">
            <span className="inline-flex items-center rounded-l-[0.8rem] border border-r-0 border-slate-300 bg-slate-50 px-3 font-semibold text-slate-600">+91</span>
            <input
              id="cp-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              autoFocus={!phone}
              value={mobile}
              onChange={(e) => setMobile(e.target.value.replace(/[^\d+\s-]/g, "").slice(0, 16))}
              className={`input !rounded-l-none ${bad("phone")}`}
              placeholder="10-digit mobile number"
              aria-describedby="cp-phone-help"
            />
          </div>
          <p id="cp-phone-help" className="mt-1 text-xs text-slate-500">10 digits, starting with 6, 7, 8 or 9.</p>
        </div>
        <div>
          <label htmlFor="cp-year" className="mb-1.5 block text-sm font-semibold text-slate-700">Class / year <span className="text-red-600">*</span></label>
          <select id="cp-year" value={year} onChange={(e) => setYear(e.target.value)} className={`input ${bad("classYear")}`}>
            <option value="">Choose…</option>
            {CLASS_YEARS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>

        {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 ring-1 ring-red-200">{error.text}</p>}

        <button type="submit" disabled={saving} className="btn-primary w-full !py-3.5 text-base disabled:opacity-60">
          {saving && <Spinner />} {saving ? "Saving…" : "Save and continue"}
        </button>
      </form>

      <button type="button" onClick={() => void logout()} disabled={loggingOut} className="mt-3 w-full rounded-xl py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-800">
        {loggingOut ? "Logging out…" : "Log out"}
      </button>

      {communityHref && (
        <a href={communityHref} target="_blank" rel="noopener noreferrer" className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-[#25D366]/10 px-3 py-2.5 text-sm font-bold text-[#128C4B] ring-1 ring-[#25D366]/30 hover:bg-[#25D366]/15">
          <WhatsAppIcon className="h-4 w-4" /> Join our free VITEEE WhatsApp community
        </a>
      )}
    </div>
  );
}
