"use client";

// =====================================================================
//  NAVBAR
//  Desktop:  Home | Courses | Rank Predictor | Resources ▾ | Reviews | Contact
//            + "Book a Slot" + Login / user menu
//  Phone:    ☰ opens a slide-in menu with big links, the same grouping,
//            and "Book a Slot" highlighted at the bottom.
//  ✏️ Links: src/lib/navigation.ts
// =====================================================================
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { isGroup, mainNav, type NavGroup, type NavLink } from "@/lib/navigation";
import { loadBrowserSupabase, useHasLoginCookie } from "@/lib/supabase/lazy";
import { useLogout } from "@/lib/useLogout";
import { Spinner } from "./Spinner";
import { CalendarIcon, ChevronDownIcon, CloseIcon, LogoutIcon, MenuIcon, UserIcon } from "./Icons";
import Logo from "./Logo";
import PredictorLockBadge from "./predictor/PredictorLockBadge";
import UserMenu from "./UserMenu";

type User = { name: string; email: string; role: string };

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
  // When the home page is built ahead of time, Next.js reports it as "/index" — treat it as "/"
  const p = usePathname();
  return <HeaderBar pathname={p === "/index" ? "/" : p} />;
}

const isActiveFor = (pathname: string) => (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

function Badges({ link, size = "sm" }: { link: NavLink; size?: "sm" | "lg" }) {
  return (
    <>
      {link.predictorLock && <PredictorLockBadge className={`-mt-0.5 ${size === "lg" ? "ml-2" : "ml-1"}`} />}
      {link.free && (
        <span className="ml-1.5 rounded-full bg-emerald-500 px-1.5 py-0.5 align-middle text-[10px] font-extrabold uppercase tracking-wide text-white">Free</span>
      )}
      {link.comingSoon && (
        <span className="ml-1.5 rounded-full bg-accent-100 px-1.5 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide text-accent-800">Coming Soon</span>
      )}
    </>
  );
}

function HeaderBar({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const isActive = isActiveFor(pathname);
  // After logging in, come back to this page (home → "/"; login pages → dashboard)
  const loginHref = !pathname || pathname.startsWith("/login") || pathname.startsWith("/auth") ? "/login" : pathname === "/" ? "/login?next=/" : `/login?next=${encodeURIComponent(pathname)}`;

  // When signed in, show the user menu (Dashboard / Admin Panel / Logout) instead of "Login".
  // Visitors who aren't logged in never download the login library (faster pages).
  const loggedIn = useHasLoginCookie();
  useEffect(() => {
    if (!loggedIn) return;
    let alive = true;
    let unsubscribe: (() => void) | undefined;
    void loadBrowserSupabase().then((supabase) => {
      if (!supabase || !alive) return;
      const load = async (u: { id: string; email?: string | null } | null | undefined) => {
        if (!u) return setUser(null);
        const { data: p } = await supabase.from("profiles").select("full_name,role").eq("id", u.id).maybeSingle();
        if (alive) setUser({ name: p?.full_name || u.email?.split("@")[0] || "Student", email: u.email ?? "", role: p?.role ?? "student" });
      };
      supabase.auth.getSession().then(({ data }) => load(data.session?.user));
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        // Run outside the auth callback (Supabase recommends not awaiting inside it)
        setTimeout(() => load(session?.user), 0);
      });
      unsubscribe = () => data.subscription.unsubscribe();
    });
    return () => {
      alive = false;
      unsubscribe?.();
    };
  }, [loggedIn]);

  return (
    <>
    <header className="sticky top-0 z-40 border-b-2 border-accent-400/70 bg-white/95 backdrop-blur-lg print:hidden">
      <div className="container-page flex h-16 items-center justify-between gap-3 sm:h-20">
        <Logo eager />

        {/* ---------- Desktop menu ---------- */}
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {mainNav.map((item) =>
            isGroup(item) ? (
              <Dropdown key={item.label} group={item} isActive={isActive} />
            ) : (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-[14.5px] font-semibold transition-colors ${
                  isActive(item.href) ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {item.label}
                <Badges link={item} />
              </Link>
            ),
          )}
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/book-a-slot" className="btn-primary hidden !px-4 !py-2.5 sm:inline-flex">
            Book a Slot
          </Link>
          {user ? (
            <UserMenu user={user} />
          ) : (
            <Link
              href={loginHref}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-800 transition-colors hover:border-brand-400 hover:text-brand-700"
            >
              <UserIcon className="h-4 w-4" /> Login
            </Link>
          )}
          <button
            type="button"
            className="grid h-11 w-11 place-items-center rounded-xl text-slate-700 hover:bg-slate-100 lg:hidden"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label="Open menu"
          >
            <MenuIcon />
          </button>
        </div>
      </div>

    </header>
    {/* Outside the <header>: its blur effect would trap a "fixed" panel inside the header bar */}
    <MobileMenu open={open} onClose={() => setOpen(false)} isActive={isActive} user={user} loginHref={loginHref} />
    </>
  );
}

// ---------- Desktop "Resources ▾" dropdown (hover, click or keyboard) ----------
function Dropdown({ group, isActive }: { group: NavGroup; isActive: (href: string) => boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = group.children.some((c) => isActive(c.href));

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const show = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const hideSoon = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  };

  return (
    <div ref={ref} className="relative" onMouseEnter={show} onMouseLeave={hideSoon}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        className={`flex items-center gap-1 whitespace-nowrap rounded-lg px-3 py-2 text-[14.5px] font-semibold transition-colors ${
          active || open ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        }`}
      >
        {group.label}
        <ChevronDownIcon className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-1/2 top-full z-50 w-72 -translate-x-1/2 pt-2">
          <ul className="animate-fade-up rounded-2xl bg-white p-2 shadow-2xl shadow-slate-900/15 ring-1 ring-slate-200">
            {group.children.map((c) => (
              <li key={c.href}>
                <Link
                  href={c.href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive(c.href) ? "page" : undefined}
                  className={`block rounded-xl px-3 py-2.5 transition-colors ${isActive(c.href) ? "bg-brand-50" : "hover:bg-slate-50"}`}
                >
                  <span className={`block text-sm font-bold ${isActive(c.href) ? "text-brand-700" : "text-slate-900"}`}>
                    {c.label}
                    <Badges link={c} />
                  </span>
                  {c.hint && <span className="block text-xs text-slate-500">{c.hint}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------- Phone / tablet slide-in menu ----------
function MobileMenu({ open, onClose, isActive, user, loginHref }: { open: boolean; onClose: () => void; isActive: (href: string) => boolean; user: User | null; loginHref: string }) {
  const closeBtn = useRef<HTMLButtonElement>(null);

  // Lock page scrolling, close with Escape, focus the close button
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const t = setTimeout(() => closeBtn.current?.focus(), 50);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [open, onClose]);

  const tab = open ? 0 : -1;
  const linkClass = (href: string) =>
    `flex items-center rounded-2xl px-4 py-3.5 text-[17px] font-bold transition-colors ${isActive(href) ? "bg-brand-50 text-brand-700" : "text-slate-800 active:bg-slate-100"}`;

  return (
    <div id="mobile-menu" className={`fixed inset-0 z-[60] overflow-hidden lg:hidden print:hidden ${open ? "" : "pointer-events-none"}`} aria-hidden={!open} inert={!open}>
      {/* dim background */}
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close menu"
        onClick={onClose}
        className={`absolute inset-0 bg-slate-950/50 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
      />
      {/* panel */}
      <nav
        aria-label="Mobile"
        className={`absolute inset-y-0 right-0 flex w-[min(88vw,22rem)] flex-col bg-white shadow-2xl transition-transform duration-300 ease-out ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
          <Logo size="sidebar" />
          <button ref={closeBtn} type="button" onClick={onClose} tabIndex={tab} aria-label="Close menu" className="grid h-11 w-11 place-items-center rounded-xl text-slate-700 hover:bg-slate-100">
            <CloseIcon />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          <ul className="space-y-1">
            {mainNav.map((item) =>
              isGroup(item) ? (
                <li key={item.label} className="pt-2">
                  <p className="px-4 pb-1 text-xs font-bold uppercase tracking-[0.15em] text-slate-400">{item.label}</p>
                  <ul className="space-y-1">
                    {item.children.map((c) => (
                      <li key={c.href}>
                        <Link href={c.href} onClick={onClose} tabIndex={tab} aria-current={isActive(c.href) ? "page" : undefined} className={`${linkClass(c.href)} !py-3 !text-base !font-semibold`}>
                          <span>
                            {c.label}
                            <Badges link={c} size="lg" />
                            {c.hint && <span className="block text-xs font-medium text-slate-500">{c.hint}</span>}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <div className="mx-4 mt-2 border-t border-slate-100" />
                </li>
              ) : (
                <li key={item.href}>
                  <Link href={item.href} onClick={onClose} tabIndex={tab} aria-current={isActive(item.href) ? "page" : undefined} className={linkClass(item.href)}>
                    {item.label}
                    <Badges link={item} size="lg" />
                  </Link>
                </li>
              ),
            )}
          </ul>
        </div>

        {/* Highlighted actions at the bottom */}
        <div className="space-y-2 border-t border-slate-100 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <Link href="/book-a-slot" onClick={onClose} tabIndex={tab} className="btn-accent w-full !py-4 text-base">
            <CalendarIcon className="h-5 w-5" /> Book a Slot
          </Link>
          {user ? (
            <MobileLogout tabIndex={tab} />
          ) : (
            <Link href={loginHref} onClick={onClose} tabIndex={tab} className="btn-light w-full !py-3.5">
              <UserIcon className="h-4 w-4" /> Login / Sign Up
            </Link>
          )}
        </div>
      </nav>
    </div>
  );
}

// "Logout" at the bottom of the phone menu (signed-in users only)
function MobileLogout({ tabIndex }: { tabIndex: number }) {
  const { logout, loggingOut } = useLogout();
  return (
    <button
      type="button"
      tabIndex={tabIndex}
      onClick={() => void logout()}
      disabled={loggingOut}
      aria-busy={loggingOut}
      className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-3 text-[15px] font-semibold text-red-600 ring-1 ring-red-200 hover:bg-red-50 disabled:cursor-wait disabled:opacity-70"
    >
      {loggingOut ? <><Spinner /> Logging out…</> : <><LogoutIcon /> Logout</>}
    </button>
  );
}
