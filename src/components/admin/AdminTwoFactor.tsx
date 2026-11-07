"use client";

// =====================================================================
//  ADMIN 2-STEP VERIFICATION (Supabase MFA, TOTP)
//  • First time: scan the QR code with Google Authenticator / Microsoft
//    Authenticator / Authy, then type the 6-digit code.
//  • Every new admin login: type the current 6-digit code.
//  After a correct code the login becomes "aal2" — only then do /admin
//  and the database treat this account as an admin.
// =====================================================================
import { useEffect, useRef, useState } from "react";
import { logAdminSignIn } from "@/app/admin/actions";
import { useLogout } from "@/lib/useLogout";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { Spinner } from "../BuyButton";
import { ShieldIcon } from "../Icons";

type Stage = { kind: "loading" } | { kind: "setup"; factorId: string; qr: string; secret: string } | { kind: "verify"; factorId: string } | { kind: "error"; message: string };

export default function AdminTwoFactor({ next, email }: { next: string; email: string }) {
  const [stage, setStage] = useState<Stage>({ kind: "loading" });
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const started = useRef(false);
  const { logout, loggingOut } = useLogout();

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      const supabase = getBrowserSupabase();
      if (!supabase) return setStage({ kind: "error", message: "Supabase is not connected." });
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) return setStage({ kind: "error", message: error.message });
      const verified = data.totp.find((f) => f.status === "verified");
      if (verified) return setStage({ kind: "verify", factorId: verified.id });

      // remove half-finished setups, then start a fresh one
      for (const f of data.all.filter((x) => x.factor_type === "totp" && x.status !== "verified")) await supabase.auth.mfa.unenroll({ factorId: f.id });
      const res = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `EDUVORA admin ${new Date().toISOString().slice(0, 10)}`, issuer: "EDUVORA" });
      if (res.error) {
        const m = res.error.message;
        return setStage({ kind: "error", message: /disabled|not enabled/i.test(m) ? "2-step verification (TOTP) is turned off in Supabase → Authentication → Multi-Factor. Turn it on and reload." : m });
      }
      setStage({ kind: "setup", factorId: res.data.id, qr: res.data.totp.qr_code, secret: res.data.totp.secret });
    })();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (stage.kind !== "setup" && stage.kind !== "verify") return;
    if (!/^\d{6}$/.test(code)) return setError("Enter the 6-digit code from your authenticator app.");
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    setBusy(true);
    setError("");
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: stage.factorId, code });
    if (error) {
      setBusy(false);
      setCode("");
      return setError(/invalid|expired/i.test(error.message) ? "That code is wrong or expired. Wait for a new code and try again (check your phone's time is automatic)." : error.message);
    }
    await logAdminSignIn(stage.kind === "setup").catch(() => undefined); // Activity Log
    window.location.replace(next); // full reload so the server sees the new 2FA login
  }

  return (
    <div className="card p-6 sm:p-8">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-600 text-white"><ShieldIcon className="h-7 w-7" /></span>
      <h1 className="mt-4 text-center text-2xl font-extrabold text-brand-700">
        {stage.kind === "setup" ? "Set up 2-step verification" : "Admin verification"}
      </h1>
      <p className="mt-1 text-center text-sm text-slate-500">{email}</p>

      {stage.kind === "loading" && <p className="py-10 text-center text-slate-500"><Spinner /> Loading…</p>}
      {stage.kind === "error" && <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700 ring-1 ring-red-200">{stage.message}</p>}

      {stage.kind === "setup" && (
        <ol className="mt-6 space-y-4 text-sm text-slate-700">
          <li><strong>1.</strong> Install <strong>Google Authenticator</strong> (or Microsoft Authenticator / Authy) on your phone.</li>
          <li>
            <strong>2.</strong> In the app tap <strong>+</strong> → <strong>Scan a QR code</strong> and scan this:
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={stage.qr} alt="QR code for your authenticator app" width={200} height={200} className="mx-auto mt-3 rounded-xl bg-white p-2 ring-1 ring-slate-200" />
            <button type="button" onClick={() => setShowSecret((v) => !v)} className="mx-auto mt-2 block text-xs font-semibold text-brand-700 underline">
              {showSecret ? "Hide the setup key" : "Can't scan? Type a key instead"}
            </button>
            {showSecret && <p className="mt-2 break-all rounded-lg bg-slate-100 p-2 text-center font-mono text-sm tracking-wider text-slate-800">{stage.secret}</p>}
          </li>
          <li><strong>3.</strong> Type the 6-digit code the app shows:</li>
        </ol>
      )}
      {stage.kind === "verify" && <p className="mt-6 text-center text-sm text-slate-600">Open your authenticator app and type the 6-digit code for <strong>EDUVORA</strong>.</p>}

      {(stage.kind === "setup" || stage.kind === "verify") && (
        <form onSubmit={submit} className="mt-4">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            placeholder="123456"
            aria-label="6-digit code"
            className="input text-center !text-2xl font-extrabold tracking-[0.5em]"
          />
          {error && <p role="alert" className="mt-2 text-sm font-semibold text-red-600">{error}</p>}
          <button type="submit" disabled={busy || code.length !== 6} className="btn-primary mt-4 w-full !py-3.5 disabled:opacity-60">
            {busy ? <><Spinner /> Checking…</> : stage.kind === "setup" ? "Turn on 2-step verification" : "Verify"}
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-xs text-slate-500">
        Lost your phone? Another admin can remove your old authenticator in Supabase → Authentication → Users → your account → Multi-Factor, then you set it up again.
      </p>
      <button type="button" onClick={logout} disabled={loggingOut} className="mx-auto mt-3 block text-sm font-semibold text-slate-500 underline hover:text-slate-800">
        {loggingOut ? "Logging out…" : "Log out"}
      </button>
    </div>
  );
}
