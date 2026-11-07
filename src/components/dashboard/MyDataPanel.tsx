"use client";

// Dashboard → My Profile → "Your data": download a copy, or delete the account.
import { useState, useTransition } from "react";
import { siteConfig } from "@/config/site";
import { deleteMyAccount } from "@/lib/privacy-actions";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { DownloadIcon, TrashIcon } from "../Icons";

export default function MyDataPanel({ isAdmin, consentAt }: { isAdmin: boolean; consentAt: string | null }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function remove() {
    setError("");
    start(async () => {
      const res = await deleteMyAccount(typed);
      if (!res.ok) return setError(res.error);
      try {
        await getBrowserSupabase()?.auth.signOut({ scope: "local" });
      } catch {
        /* already gone */
      }
      window.location.replace("/login?loggedOut=deleted");
    });
  }

  return (
    <section className="card p-5 sm:p-6">
      <h2 className="text-lg font-extrabold text-slate-900">Your data</h2>
      <p className="mt-1 text-sm text-slate-500">
        {consentAt ? <>You accepted the Privacy Policy and Terms on {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(new Date(consentAt))}. </> : null}
        Read how we use it in our <a href="/privacy-policy" className="font-semibold text-brand-700 underline">Privacy Policy</a>.
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <p className="font-bold text-slate-900">Download my data</p>
          <p className="mt-1 text-sm text-slate-600">A file with your profile, purchases, bookings, test results, predictions and more.</p>
          <a href="/api/me/export" className="btn-light mt-3 !py-2 text-sm"><DownloadIcon /> Download my data</a>
        </div>
        <div className="rounded-2xl bg-red-50/60 p-4 ring-1 ring-red-200">
          <p className="font-bold text-red-800">Delete my account</p>
          <p className="mt-1 text-sm text-slate-600">Permanently delete your account and personal data.</p>
          {isAdmin ? (
            <p className="mt-3 text-xs font-semibold text-slate-500">Admin accounts can&apos;t be deleted here — ask another admin to remove your admin role first.</p>
          ) : (
            <button type="button" onClick={() => setOpen(true)} className="btn-light mt-3 !py-2 text-sm !text-red-700"><TrashIcon /> Delete my account</button>
          )}
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="del-title">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[1.75rem] bg-white p-6 shadow-2xl sm:p-7">
            <h3 id="del-title" className="text-xl font-extrabold text-red-700">Delete your account?</h3>
            <p className="mt-1 text-sm text-slate-600">This can&apos;t be undone.</p>

            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-xl bg-red-50 p-3 ring-1 ring-red-200">
                <p className="font-bold text-red-800">Will be deleted</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-slate-700">
                  <li>Your login and profile (name, email, phone)</li>
                  <li>Rank predictions</li>
                  <li>Test attempts and scores</li>
                  <li>Enquiries and reviews</li>
                  <li>Session credits, reward credit and referrals</li>
                  <li>Access to purchased courses and material</li>
                </ul>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <p className="font-bold text-slate-800">Kept, without your name</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-slate-700">
                  <li>Payment and invoice records (amount, date, invoice number) — required by law for tax purposes</li>
                </ul>
                <p className="mt-2 text-xs text-slate-500">Your name, email and phone are removed from them.</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">Tip: <a href="/api/me/export" className="font-semibold underline">download your data</a> first. Unused purchases are not refunded when you delete your account.</p>

            <label htmlFor="del-confirm" className="mt-5 block text-sm font-semibold text-slate-700">Type <strong>DELETE</strong> to confirm</label>
            <input id="del-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" className="input mt-1 font-mono tracking-widest" placeholder="DELETE" />
            {error && <p role="alert" className="mt-2 text-sm font-semibold text-red-600">{error}</p>}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => { setOpen(false); setTyped(""); setError(""); }} disabled={pending} className="btn-light">Cancel</button>
              <button type="button" onClick={remove} disabled={pending || typed.trim() !== "DELETE"} className="btn-primary !bg-red-600 hover:!bg-red-700 disabled:opacity-50">
                {pending ? "Deleting…" : "Permanently delete my account"}
              </button>
            </div>
            <p className="mt-3 text-center text-xs text-slate-500">Questions? Email <a href={`mailto:${siteConfig.email}`} className="underline">{siteConfig.email}</a></p>
          </div>
        </div>
      )}
    </section>
  );
}
