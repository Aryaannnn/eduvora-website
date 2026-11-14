"use client";

// One-time "Please accept the Privacy Policy and Terms" for logged-in users
// who haven't accepted yet (e.g. signed up with Google, or older accounts).
// The date is saved in their profile (profiles.consent_at).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { acceptPrivacyTerms } from "@/lib/privacy-actions";
import { loadBrowserSupabase, useHasLoginCookie } from "@/lib/supabase/lazy";
import { useLogout } from "@/lib/useLogout";
import { ShieldIcon } from "../Icons";

const SKIP = ["/privacy-policy", "/terms-and-conditions", "/refund-policy", "/login", "/auth", "/admin-verify"];

export default function ConsentPrompt() {
  return (
    <Suspense fallback={null}>
      <Prompt />
    </Suspense>
  );
}

function Prompt() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { logout, loggingOut } = useLogout();
  const skipHere = SKIP.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  // Only for logged-in browsers (visitors never download the login library)
  const loggedIn = useHasLoginCookie();
  useEffect(() => {
    if (!loggedIn) return;
    let alive = true;
    let unsubscribe: (() => void) | undefined;
    void loadBrowserSupabase().then((supabase) => {
      if (!supabase || !alive) return;
      const check = async () => {
        const { data } = await supabase.auth.getUser();
        if (!data.user) return alive && setShow(false);
        const { data: p, error } = await supabase.from("profiles").select("consent_at").eq("id", data.user.id).maybeSingle();
        if (!alive || error || !p) return; // not set up yet → don't block anyone
        setShow(!p.consent_at);
      };
      void check();
      const { data: sub } = supabase.auth.onAuthStateChange((e) => {
        if (e === "SIGNED_IN") void check();
        if (e === "SIGNED_OUT") setShow(false);
      });
      unsubscribe = () => sub.subscription.unsubscribe();
    });
    return () => {
      alive = false;
      unsubscribe?.();
    };
  }, [loggedIn]);

  if (!show || skipHere) return null;

  async function accept() {
    setBusy(true);
    setError("");
    const res = await acceptPrivacyTerms();
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setShow(false);
  }

  return (
    <div className="fixed inset-0 z-[75] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="consent-title">
      <div className="w-full max-w-md rounded-[1.75rem] bg-white p-6 shadow-2xl sm:p-8">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600 ring-1 ring-brand-100"><ShieldIcon className="h-7 w-7" /></span>
        <h2 id="consent-title" className="mt-4 text-center text-xl font-extrabold text-slate-900">Your privacy</h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          Before you continue, please read and accept how we use your data. You can download or delete your data any time from My Profile.
        </p>
        <p className="mt-4 text-center text-sm">
          <Link href="/privacy-policy" target="_blank" className="font-semibold text-brand-700 underline">Privacy Policy</Link>
          {" · "}
          <Link href="/terms-and-conditions" target="_blank" className="font-semibold text-brand-700 underline">Terms &amp; Conditions</Link>
        </p>
        {error && <p role="alert" className="mt-3 text-center text-sm font-semibold text-red-600">{error}</p>}
        <button type="button" onClick={accept} disabled={busy} className="btn-primary mt-5 w-full !py-3.5 disabled:opacity-60">
          {busy ? "Saving…" : "I agree to the Privacy Policy and Terms & Conditions"}
        </button>
        <button type="button" onClick={logout} disabled={loggingOut} className="mt-2 w-full rounded-xl py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-50">
          {loggingOut ? "Logging out…" : "I don't agree — log me out"}
        </button>
      </div>
    </div>
  );
}
