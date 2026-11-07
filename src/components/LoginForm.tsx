"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { siteConfig } from "@/config/site";
import {
  AUTH_DEMO_MODE,
  nextPathFromUrl,
  sendOtp,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
  verifyOtp,
} from "@/lib/auth";
import { track } from "@/lib/analytics";
import { Field } from "./ContactForm";
import { CheckIcon, GoogleIcon, MailIcon, PhoneIcon } from "./Icons";

type Mode = "signin" | "signup";
type Method = "email" | "phone";
type Step = "details" | "otp" | "check-email" | "done";

const RESEND_SECONDS = 30;
// Which login options are shown — switch them on/off in src/config/site.ts → loginMethods
const methods = siteConfig.loginMethods;

// Sign In / Sign Up with email + password, phone OTP, or Google.
/** initialMode "signup" opens the Sign Up tab (/login?mode=signup, used by the predictor) */
export default function LoginForm({ initialMode = "signin" }: { initialMode?: Mode }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [method, setMethod] = useState<Method>(methods.email ? "email" : "phone");
  const [step, setStep] = useState<Step>("details");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"Student" | "Parent">("Student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState("");
  const [agree, setAgree] = useState(false);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState<"" | "submit" | "verify" | "google">("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [seconds, setSeconds] = useState(0);

  // Countdown for "Resend OTP"
  useEffect(() => {
    if (seconds <= 0) return;
    const id = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [seconds]);

  function reset(m: Mode = mode) {
    setMode(m);
    setStep("details");
    setOtp("");
    setError("");
    setInfo("");
  }

  function goNext() {
    router.replace(nextPathFromUrl());
    router.refresh();
  }

  // Checks shared by every sign-up method
  function signupChecks(): string {
    if (mode !== "signup") return "";
    if (name.trim().length < 2) return "Please enter your full name.";
    if (!agree) return "Please accept the Terms & Privacy Policy to continue.";
    return "";
  }

  const profile = () => ({ fullName: name.trim(), role: role === "Parent" ? ("parent" as const) : ("student" as const) });

  // ---------- Email + password ----------
  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    const problem = signupChecks();
    if (problem) return setError(problem);

    setLoading("submit");
    if (mode === "signup") {
      const res = await signUpWithEmail(email.trim(), password, profile(), nextPathFromUrl());
      setLoading("");
      if (!res.ok) return setError(res.message ?? "Could not create your account.");
      track("sign_up", { method: "email" });
      if (res.needsConfirmation) return setStep("check-email");
      return goNext();
    }
    const res = await signInWithEmail(email.trim(), password);
    setLoading("");
    if (!res.ok) return setError(res.message ?? "Could not sign in.");
    track("login", { method: "email" });
    goNext();
  }

  // ---------- Phone OTP ----------
  async function handleSendOtp(e?: React.FormEvent) {
    e?.preventDefault();
    setError("");
    setInfo("");
    const problem = signupChecks();
    if (problem) return setError(problem);
    if (!/^[6-9]\d{9}$/.test(phone)) return setError("Please enter a valid 10-digit mobile number.");

    setLoading("submit");
    const res = await sendOtp(phone, mode, profile());
    setLoading("");
    if (!res.ok) return setError(res.message ?? "Could not send OTP. Please try again.");
    setStep("otp");
    setOtp("");
    setSeconds(RESEND_SECONDS);
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading("verify");
    const res = await verifyOtp(phone, otp);
    setLoading("");
    if (!res.ok) return setError(res.message ?? "Wrong OTP. Please try again.");
    track(mode === "signup" ? "sign_up" : "login", { method: "phone" });
    if (AUTH_DEMO_MODE) return setStep("done");
    goNext();
  }

  // ---------- Google ----------
  async function handleGoogle() {
    setError("");
    setInfo("");
    setLoading("google");
    track(mode === "signup" ? "sign_up" : "login", { method: "google" }); // counted when they press the button
    const res = await signInWithGoogle(nextPathFromUrl());
    // On success the browser leaves for Google, so keep the spinner showing
    if (!res.ok) {
      setLoading("");
      setInfo(res.message ?? "");
    }
  }

  // ---------- "Check your email" (when Supabase "Confirm email" is on) ----------
  if (step === "check-email") {
    return (
      <div className="animate-fade-up text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand-50 text-brand-600"><MailIcon className="h-8 w-8" /></span>
        <p className="mt-4 text-xl font-extrabold text-slate-900">Check your email 📩</p>
        <p className="mt-2 text-sm text-slate-600">
          We sent a confirmation link to <strong className="text-slate-900">{email}</strong>. Open it to activate your account, then sign in.
        </p>
        <p className="mt-3 text-xs text-slate-500">Can&apos;t find it? Check your Spam or Promotions folder.</p>
        <button type="button" onClick={() => reset("signin")} className="btn-primary mt-6 w-full">Go to Sign In</button>
      </div>
    );
  }

  // ---------- Demo success (only when Supabase isn't connected) ----------
  if (step === "done") {
    return (
      <div className="animate-fade-up text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-green-100 text-green-600"><CheckIcon className="h-8 w-8" /></span>
        <p className="mt-4 text-xl font-extrabold text-slate-900">You&apos;re in! 🎉</p>
        <DemoNote text="Demo mode — Supabase is not connected yet, so no account was created." />
        <Link href="/" className="btn-primary mt-6 w-full">Go to Home</Link>
      </div>
    );
  }

  const showMethodSwitch = methods.email && methods.phone && step === "details";
  const busy = loading !== "";

  return (
    <div>
      {/* Sign In / Sign Up tabs */}
      <div role="tablist" aria-label="Sign in or sign up" className="grid grid-cols-2 rounded-2xl bg-slate-100 p-1.5">
        {(["signin", "signup"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => reset(m)}
            className={`rounded-xl py-2.5 text-sm font-bold transition ${mode === m ? "bg-white text-brand-700 shadow" : "text-slate-600 hover:text-slate-900"}`}
          >
            {m === "signin" ? "Sign In" : "Sign Up"}
          </button>
        ))}
      </div>

      <p className="mt-5 text-center text-sm text-slate-600">
        {mode === "signin" ? "Welcome back! Sign in to continue." : "New here? Create your free account in a minute."}
      </p>

      {step === "details" && (
        <div key={mode} className="animate-fade-up">
          {/* Google — the quickest way in (on/off: src/config/site.ts → loginMethods.google) */}
          {methods.google && (
            <>
              <button
                type="button"
                onClick={handleGoogle}
                disabled={busy}
                className="mt-5 flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-slate-200 bg-white px-4 py-4 text-base font-extrabold text-slate-800 shadow-sm transition hover:border-brand-300 hover:bg-slate-50 hover:shadow-md disabled:opacity-60"
              >
                {loading === "google" ? <Spinner dark /> : <GoogleIcon className="h-6 w-6" />}
                Continue with Google
              </button>
              {mode === "signup" && (
                <p className="mt-2 text-center text-[11px] text-slate-500">
                  By continuing with Google you agree to our <Link href="/terms-and-conditions" className="underline">Terms</Link> &amp; <Link href="/privacy-policy" className="underline">Privacy Policy</Link>.
                </p>
              )}
              {(methods.email || methods.phone) && (
                <div className="my-5 flex items-center gap-3 text-xs font-semibold text-slate-400">
                  <span className="h-px flex-1 bg-slate-200" /> or continue with {methods.email ? "email" : "phone"} <span className="h-px flex-1 bg-slate-200" />
                </div>
              )}
            </>
          )}

          {/* Email / Phone switch (only if both are on) */}
          {showMethodSwitch && (
            <div className="mt-5 grid grid-cols-2 gap-2">
              {(["email", "phone"] as Method[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={method === m}
                  onClick={() => { setMethod(m); setError(""); }}
                  className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold ring-1 transition ${method === m ? "bg-brand-50 text-brand-700 ring-brand-500" : "text-slate-600 ring-slate-300 hover:ring-brand-300"}`}
                >
                  {m === "email" ? <MailIcon className="h-4 w-4" /> : <PhoneIcon className="h-4 w-4" />}
                  {m === "email" ? "Email" : "Phone"}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={method === "email" ? handleEmail : handleSendOtp} className="mt-5 space-y-4" noValidate>
            {mode === "signup" && (
              <>
                <Field label="Full name" htmlFor="auth-name">
                  <input id="auth-name" value={name} onChange={(e) => setName(e.target.value)} className="input" autoComplete="name" placeholder="e.g. Rahul Sharma" />
                </Field>
                <div>
                  <p className="mb-1.5 text-sm font-semibold text-slate-700">I am a</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(["Student", "Parent"] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        aria-pressed={role === r}
                        onClick={() => setRole(r)}
                        className={`rounded-xl py-3 text-sm font-bold ring-1 transition ${role === r ? "bg-brand-50 text-brand-700 ring-brand-500" : "text-slate-600 ring-slate-300 hover:ring-brand-300"}`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {method === "email" ? (
              <>
                <Field label="Email" htmlFor="auth-email">
                  <input id="auth-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="Your email address" />
                </Field>
                <Field label="Password" htmlFor="auth-password">
                  <div className="relative">
                    <input
                      id="auth-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input !pr-16"
                      placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute inset-y-0 right-3 my-auto h-fit text-xs font-bold text-brand-700"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </Field>
                {mode === "signin" && (
                  <div className="-mt-2 text-right">
                    <Link href="/forgot-password" className="inline-block py-1 text-sm font-semibold text-brand-600 underline-offset-2 hover:text-accent-700 hover:underline">
                      Forgot password?
                    </Link>
                  </div>
                )}
              </>
            ) : (
              <Field label="Mobile number" htmlFor="auth-phone">
                <div className="flex">
                  <span className="inline-flex items-center rounded-l-[0.8rem] border border-r-0 border-slate-300 bg-slate-50 px-3 font-semibold text-slate-600">+91</span>
                  <input
                    id="auth-phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    className="input !rounded-l-none"
                    placeholder="10-digit mobile number"
                  />
                </div>
              </Field>
            )}

            {mode === "signup" && (
              <label className="flex items-start gap-2.5 text-sm text-slate-600">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600" />
                <span>
                  I agree to the <Link href="/terms-and-conditions" className="font-semibold text-brand-700 underline">Terms</Link> and{" "}
                  <Link href="/privacy-policy" className="font-semibold text-brand-700 underline">Privacy Policy</Link>.
                </span>
              </label>
            )}

            <Messages error={error} info={info} />

            <button type="submit" disabled={busy} className="btn-primary w-full !py-3.5 text-base disabled:opacity-60">
              {loading === "submit" && <Spinner />}
              {method === "phone" ? "Send OTP" : mode === "signin" ? "Sign In" : "Create Account"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-600">
            {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
            <button type="button" onClick={() => reset(mode === "signin" ? "signup" : "signin")} className="font-bold text-brand-700 hover:underline">
              {mode === "signin" ? "Sign Up" : "Sign In"}
            </button>
          </p>
        </div>
      )}

      {/* OTP step (phone only) */}
      {step === "otp" && (
        <form onSubmit={handleVerify} className="mt-6 animate-fade-up space-y-4">
          <p className="text-center text-sm text-slate-600">
            We sent a 6-digit OTP to <strong className="text-slate-900">+91 {phone}</strong>{" "}
            <button type="button" onClick={() => setStep("details")} className="font-semibold text-brand-700 hover:underline">Change</button>
          </p>
          {AUTH_DEMO_MODE && <DemoNote text="Demo mode (Supabase not connected): no SMS is sent. Type any 6 digits." />}
          <label htmlFor="auth-otp" className="sr-only">Enter OTP</label>
          <input
            id="auth-otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="input text-center !text-2xl font-bold tracking-[0.6em]"
            placeholder="••••••"
          />
          <Messages error={error} info="" />
          <button type="submit" disabled={busy || otp.length !== 6} className="btn-primary w-full !py-3.5 text-base disabled:opacity-60">
            {loading === "verify" && <Spinner />} {mode === "signin" ? "Verify & Sign In" : "Verify & Create Account"}
          </button>
          <p className="text-center text-sm text-slate-600">
            {seconds > 0 ? (
              <>Resend OTP in <strong>{seconds}s</strong></>
            ) : (
              <button type="button" onClick={() => handleSendOtp()} className="font-bold text-brand-700 hover:underline">Resend OTP</button>
            )}
          </p>
        </form>
      )}
    </div>
  );
}

function Messages({ error, info }: { error: string; info: string }) {
  if (error) return <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-200">{error}</p>;
  if (info) return <p role="status" className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 ring-1 ring-amber-200">{info}</p>;
  return null;
}

function DemoNote({ text }: { text: string }) {
  return <p className="mt-3 rounded-xl bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-900 ring-1 ring-amber-200">{text}</p>;
}

function Spinner({ dark = false }: { dark?: boolean }) {
  return <span className={`h-4 w-4 animate-spin rounded-full border-2 ${dark ? "border-slate-300 border-t-slate-700" : "border-white/40 border-t-white"}`} aria-hidden />;
}
