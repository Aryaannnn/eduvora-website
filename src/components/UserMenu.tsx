"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { initials } from "@/lib/format";
import { useLogout } from "@/lib/useLogout";
import { Spinner } from "./Spinner";
import { ChevronDownIcon, GridIcon, LogoutIcon, ShieldIcon, UserIcon } from "./Icons";

type MenuUser = { name: string; email: string; role: string };

// Round avatar button in the navbar with Dashboard / Admin Panel / Logout
export default function UserMenu({ user }: { user: MenuUser }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { logout, loggingOut } = useLogout();

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item = "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-1.5 rounded-full border border-slate-300 py-1 pl-1 pr-2 transition hover:border-brand-400"
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-800 text-xs font-extrabold text-white">
          {initials(user.name) || <UserIcon className="h-4 w-4" />}
        </span>
        <ChevronDownIcon className={`h-4 w-4 text-slate-500 transition ${open ? "rotate-180" : ""}`} />
        <span className="sr-only">Account menu</span>
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-full mt-2 w-64 animate-fade-up rounded-2xl bg-white p-2 shadow-2xl ring-1 ring-slate-200" onClick={() => setOpen(false)}>
          <div className="border-b border-slate-100 px-3 pb-3 pt-2">
            <p className="truncate font-bold text-slate-900">{user.name}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>
          <Link role="menuitem" href="/dashboard" className={`${item} mt-1 text-slate-700 hover:bg-slate-100`}>
            <GridIcon /> Dashboard
          </Link>
          {(user.role === "admin" || user.role === "counsellor") && (
            <Link role="menuitem" href={user.role === "admin" ? "/admin" : "/admin/bookings"} className={`${item} text-slate-700 hover:bg-slate-100`}>
              <ShieldIcon className="h-5 w-5" /> {user.role === "admin" ? "Admin Panel" : "Staff Panel"}
            </Link>
          )}
          <button role="menuitem" type="button" onClick={logout} disabled={loggingOut} aria-busy={loggingOut} className={`${item} text-red-600 hover:bg-red-50 disabled:cursor-wait disabled:opacity-70`}>
            {loggingOut ? <><Spinner /> Logging out…</> : <><LogoutIcon /> Logout</>}
          </button>
        </div>
      )}
    </div>
  );
}
