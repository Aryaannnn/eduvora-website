"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { navLinks } from "@/lib/navigation";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { CloseIcon, LogoutIcon, MenuIcon, UserIcon } from "./Icons";
import { Spinner } from "./BuyButton";
import { useLogout } from "@/lib/useLogout";
import Logo from "./Logo";
import PredictorLockBadge from "./predictor/PredictorLockBadge";
import UserMenu from "./UserMenu";

// Pages like /courses/[slug] load per visit, so the part that reads the
// current address waits inside <Suspense>; the plain bar shows meanwhile.
export default function Header() {
  return (
    <Suspense fallback={<HeaderBar pathname="" />}>
      <HeaderWithPath />
    </Suspense>
  );
}

function HeaderWithPath() {
  return <HeaderBar pathname={usePathname()} />;
}

function HeaderBar({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<{ name: string; email: string; role: string } | null>(null);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  // When signed in, show the user menu (Dashboard / Admin Panel / Logout) instead of "Login"
  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    const load = async (u: { id: string; email?: string | null } | null | undefined) => {
      if (!u) return setUser(null);
      const { data: p } = await supabase.from("profiles").select("full_name,role").eq("id", u.id).maybeSingle();
      setUser({ name: p?.full_name || u.email?.split("@")[0] || "Student", email: u.email ?? "", role: p?.role ?? "student" });
    };
    supabase.auth.getSession().then(({ data }) => load(data.session?.user));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      // Run outside the auth callback (Supabase recommends not awaiting inside it)
      setTimeout(() => load(session?.user), 0);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b-2 border-accent-400/70 bg-white/95 backdrop-blur-lg print:hidden">
      <div className="container-page flex h-16 items-center justify-between gap-3 sm:h-20">
        <Logo eager />

        {/* Desktop menu (large screens) */}
        <nav className="hidden items-center gap-0.5 xl:flex" aria-label="Main">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`whitespace-nowrap rounded-lg px-2 py-2 text-[13.5px] font-semibold transition-colors ${
                isActive(l.href) ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {l.label}
              {l.href === "/predictor" && <> <PredictorLockBadge className="-mt-0.5 h-3 w-3 text-accent-600" /></>}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/book-a-slot" className="btn-primary hidden !px-4 !py-2.5 sm:inline-flex">
            Book a Slot
          </Link>
          {user ? (
            <UserMenu user={user} />
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-800 transition-colors hover:border-brand-400 hover:text-brand-700"
            >
              <UserIcon className="h-4 w-4" /> Login
            </Link>
          )}
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-lg text-slate-700 hover:bg-slate-100 xl:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {/* Mobile / tablet menu */}
      <div
        id="mobile-menu"
        className={`grid overflow-hidden border-slate-200 bg-white transition-[grid-template-rows] duration-300 xl:hidden ${
          open ? "grid-rows-[1fr] border-t" : "grid-rows-[0fr]"
        }`}
      >
        <nav className="min-h-0" aria-label="Mobile" onClick={() => setOpen(false)}>
          <div className="container-page grid grid-cols-2 gap-1 py-3">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                tabIndex={open ? 0 : -1}
                className={`rounded-lg px-3 py-3 text-[15px] font-semibold ${
                  isActive(l.href) ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {l.label}
                {l.href === "/predictor" && <> <PredictorLockBadge className="-mt-0.5 h-3.5 w-3.5 text-accent-600" /></>}
              </Link>
            ))}
            <Link href="/book-a-slot" tabIndex={open ? 0 : -1} className="btn-primary col-span-2 mt-2">
              Book Your Counselling Slot
            </Link>
            {user && <MobileLogout tabIndex={open ? 0 : -1} />}
          </div>
        </nav>
      </div>
    </header>
  );
}

// "Logout" at the bottom of the phone menu (signed-in users only)
function MobileLogout({ tabIndex }: { tabIndex: number }) {
  const { logout, loggingOut } = useLogout();
  return (
    <button
      type="button"
      tabIndex={tabIndex}
      onClick={(e) => { e.stopPropagation(); void logout(); }}
      disabled={loggingOut}
      aria-busy={loggingOut}
      className="col-span-2 mt-1 flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-[15px] font-semibold text-red-600 ring-1 ring-red-200 hover:bg-red-50 disabled:cursor-wait disabled:opacity-70"
    >
      {loggingOut ? <><Spinner /> Logging out…</> : <><LogoutIcon /> Logout</>}
    </button>
  );
}
