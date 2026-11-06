"use client";

// =====================================================================
//  "COMPLETE YOUR PROFILE" POPUP
//  Shown to logged-in students who have no mobile number yet (for example
//  after "Continue with Google", which only gives us name + email).
//  • "Save" stores the number in their profile (same as Dashboard → Profile)
//  • "Skip for now" hides it for 7 days on this device
//  Never shown to admins, or on the login / admin / password pages.
// =====================================================================
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { siteConfig } from "@/config/site";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { PhoneIcon } from "../Icons";

const SKIP_DAYS = 7;
const HIDDEN_ON = ["/login", "/auth", "/admin", "/reset-password", "/forgot-password"];
const skipKey = (uid: string) => `eduvora-skip-phone-${uid}`;

function skippedRecently(uid: string) {
  try {
    const at = Number(localStorage.getItem(skipKey(uid)));
    return at > 0 && Date.now() - at < SKIP_DAYS * 86400000;
  } catch {
    return false;
  }
}

export default function CompleteProfilePrompt() {
  return (
    <Suspense fallback={null}>
      <Prompt />
    </Suspense>
  );
}

function Prompt() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; firstName: string } | null>(null);
  const [mobile, setMobile] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const hiddenHere = HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase || hiddenHere) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function check() {
      const { data } = await supabase!.auth.getUser();
      const u = data.user;
      if (!u || skippedRecently(u.id)) return alive && setUser(null);
      const { data: p } = await supabase!.from("profiles").select("full_name,phone,role").eq("id", u.id).maybeSingle();
      if (!alive || !p || p.phone || p.role === "admin") return;
      const firstName = String(p.full_name || "").split(" ")[0];
      // small pause so the page appears first
      timer = setTimeout(() => alive && setUser({ id: u.id, firstName }), 1200);
    }
    void check();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") void check();
      if (event === "SIGNED_OUT") setUser(null);
    });
    return () => {
      alive = false;
      clearTimeout(timer);
      sub.subscription.unsubscribe();
    };
  }, [hiddenHere]);

  if (!user || hiddenHere) return null;

  function skip() {
    try {
      localStorage.setItem(skipKey(user!.id), String(Date.now()));
    } catch {
      /* private window — just close */
    }
    setUser(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!/^[6-9]\d{9}$/.test(mobile)) return setError("Please enter a valid 10-digit mobile number.");
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ phone: `91${mobile}` }).eq("id", user!.id);
    setSaving(false);
    if (error) return setError(/duplicate|unique/i.test(error.message) ? "This number is already used by another account." : "Could not save. Please try again.");
    setUser(null);
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm" onKeyDown={(e) => e.key === "Escape" && skip()}>
      <div role="dialog" aria-modal="true" aria-labelledby="cp-title" className="w-full max-w-md animate-fade-up rounded-[1.75rem] bg-white p-6 shadow-2xl sm:p-8">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
          <PhoneIcon className="h-7 w-7" />
        </span>
        <h2 id="cp-title" className="mt-4 text-center text-2xl font-extrabold text-slate-900">
          Complete your profile{user.firstName ? `, ${user.firstName}` : ""} 👋
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          Add your mobile number so the {siteConfig.businessName} team can reach you about your counselling, bookings and updates.
        </p>
        <form onSubmit={save} className="mt-5 space-y-3" noValidate>
          <label htmlFor="cp-phone" className="text-sm font-semibold text-slate-700">Mobile number</label>
          <div className="flex">
            <span className="inline-flex items-center rounded-l-[0.8rem] border border-r-0 border-slate-300 bg-slate-50 px-3 font-semibold text-slate-600">+91</span>
            <input
              id="cp-phone"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              autoFocus
              value={mobile}
              onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
              className="input !rounded-l-none"
              placeholder="10-digit mobile number"
              autoComplete="tel-national"
            />
          </div>
          {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 ring-1 ring-red-200">{error}</p>}
          <button type="submit" disabled={saving} className="btn-primary w-full !py-3.5 disabled:opacity-60">{saving ? "Saving…" : "Save"}</button>
          <button type="button" onClick={skip} className="w-full rounded-xl py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-800">
            Skip for now
          </button>
        </form>
      </div>
    </div>
  );
}
