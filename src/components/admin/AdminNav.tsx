"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { lockScroll } from "@/lib/scroll-lock";
import { useLogout } from "@/lib/useLogout";
import { Spinner } from "../Spinner";
import Logo from "../Logo";
import { ChevronDownIcon, CloseIcon, BookIcon, ChatIcon, CalendarIcon, ChartIcon, ClipboardIcon, ClockIcon, GiftIcon, GridIcon, LogoutIcon, MailIcon, ReceiptIcon, ShieldIcon, StarIcon, TagIcon, TargetIcon, UsersIcon, AwardIcon } from "../Icons";
import { siteConfig } from "@/config/site";

const allLinks = [
  { href: "/admin", label: "Overview", icon: ChartIcon },
  { href: "/admin/leads", label: "Leads", icon: TargetIcon },
  { href: "/admin/products", label: "Products", icon: BookIcon },
  { href: "/admin/packages", label: "Packages", icon: StarIcon },
  { href: "/admin/slots", label: "Slots", icon: ClockIcon },
  { href: "/admin/bookings", label: "Bookings", icon: CalendarIcon },
  { href: "/admin/enquiries", label: "Enquiries", icon: MailIcon },
  { href: "/admin/important-dates", label: "Important Dates", icon: CalendarIcon },
  ...(siteConfig.showBlog ? [{ href: "/admin/blog", label: "Blog", icon: BookIcon }] : []), // src/config/site.ts → showBlog
  { href: "/admin/tests", label: "Tests", icon: ClipboardIcon },
  { href: "/admin/predictor", label: "Predictor", icon: TargetIcon },
  { href: "/admin/reviews", label: "Reviews", icon: StarIcon },
  { href: "/admin/success-stories", label: "Success Stories", icon: AwardIcon },
  { href: "/admin/feedback", label: "Feedback", icon: ChatIcon },
  { href: "/admin/students", label: "Students", icon: UsersIcon },
  { href: "/admin/payments", label: "Payments", icon: ReceiptIcon },
  { href: "/admin/coupons", label: "Coupons", icon: TagIcon },
  { href: "/admin/referrals", label: "Referrals", icon: GiftIcon },
  { href: "/admin/emails", label: "Email Logs", icon: MailIcon },
  { href: "/admin/activity", label: "Activity Log", icon: ShieldIcon },
  { href: "/admin/settings", label: "Settings", icon: GridIcon },
];

// Pages a COUNSELLOR may open (the server checks this again on every page and action)
const STAFF_PAGES = ["/admin/bookings", "/admin/leads", "/admin/students", "/admin/enquiries"];

export default function AdminNav({ role }: { role: "admin" | "counsellor" }) {
  const pathname = usePathname();
  const links = role === "admin" ? allLinks : allLinks.filter((l) => STAFF_PAGES.includes(l.href));
  const { logout, loggingOut } = useLogout();
  const active = (href: string) => (href === "/admin" ? pathname === href : pathname.startsWith(href));
  const current = links.find((l) => active(l.href));
  const [open, setOpen] = useState(false);
  // Sections sheet open (phones): the page behind stays still; Escape closes it
  useEffect(() => {
    if (!open) return;
    const unlock = lockScroll();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      unlock();
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      {/* Desktop sidebar */}
      {/* fixed 260px column, scrolls on its own; hover only changes colours */}
      <aside className="dash-sidebar hidden lg:block">
        <nav aria-label="Admin" className="rounded-[1.25rem] bg-slate-900 p-3 text-slate-300 shadow-xl">
          <div className="mb-3 flex justify-center rounded-xl bg-white p-2"><Logo size="sidebar" /></div>
          <p className="px-3 pb-2 pt-1 text-xs font-bold uppercase tracking-wider text-accent-300">{role === "admin" ? "Admin panel" : "Counsellor panel"}</p>
          <ul className="space-y-1">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={active(l.href) ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${active(l.href) ? "bg-white text-slate-900" : "hover:bg-white/10 hover:text-white"}`}
                >
                  <l.icon className="h-5 w-5" /> {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-3 space-y-1 border-t border-white/10 pt-3">
            <Link href="/dashboard" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-white/10 hover:text-white">
              <GridIcon /> Student view
            </Link>
            <button type="button" onClick={logout} disabled={loggingOut} aria-busy={loggingOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-300 transition-colors hover:bg-red-500/10 disabled:cursor-wait disabled:opacity-70">
              {loggingOut ? <><Spinner /> Logging out…</> : <><LogoutIcon /> Logout</>}
            </button>
          </div>
        </nav>
      </aside>

      {/* Phone / tablet: one button with the current section → a sheet with every section */}
      <div className="mb-4 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-haspopup="dialog"
          className="flex min-h-12 w-full items-center gap-3 rounded-2xl bg-slate-900 px-4 text-left text-[15px] font-bold text-white shadow-md"
        >
          {current ? <current.icon className="h-5 w-5 text-accent-300" /> : <GridIcon />}
          <span className="min-w-0 flex-1 truncate">{current?.label ?? (role === "admin" ? "Admin panel" : "Counsellor panel")}</span>
          <span className="text-xs font-semibold text-slate-400">All sections</span>
          <ChevronDownIcon className="h-5 w-5 text-slate-300" />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label="Admin sections">
          <button type="button" aria-label="Close" className="absolute inset-0 bg-slate-950/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] animate-fade-up overflow-y-auto overscroll-contain rounded-t-3xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl">
            <div className="flex items-center justify-between px-1">
              <p className="font-extrabold text-slate-900">{role === "admin" ? "Admin panel" : "Counsellor panel"}</p>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="-mr-1 grid h-11 w-11 place-items-center rounded-full hover:bg-slate-100">
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
            <ul className="mt-2 grid grid-cols-2 gap-2" onClick={(e) => (e.target as Element).closest("a") && setOpen(false)}>
              {links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={active(l.href) ? "page" : undefined}
                    className={`flex min-h-12 items-center gap-2.5 rounded-xl px-3 py-2.5 text-[15px] font-semibold ring-1 ${active(l.href) ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-700 ring-slate-200 active:bg-slate-50"}`}
                  >
                    <l.icon className="h-5 w-5 shrink-0" /> <span className="min-w-0 leading-tight">{l.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
              <Link href="/dashboard" onClick={() => setOpen(false)} className="flex min-h-12 items-center gap-2.5 rounded-xl px-3 text-[15px] font-semibold text-slate-700 ring-1 ring-slate-200">
                <GridIcon /> Student view
              </Link>
              <button type="button" onClick={logout} disabled={loggingOut} aria-busy={loggingOut} className="flex min-h-12 items-center gap-2.5 rounded-xl px-3 text-[15px] font-semibold text-red-600 ring-1 ring-red-200 disabled:cursor-wait disabled:opacity-70">
                {loggingOut ? <><Spinner /> Logging out…</> : <><LogoutIcon /> Logout</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
