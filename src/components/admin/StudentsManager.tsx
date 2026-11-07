"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { adjustSessionCredits, adminDeleteAccount, setPredictorAccess, setUserRole } from "@/app/admin/actions";
import { csvDateTimeIST, formatDateTime } from "@/lib/format";
import { LockIcon, SearchIcon, ShieldIcon, TargetIcon } from "../Icons";
import { AdminHeader, Notice, downloadCsv } from "./ui";

type UserRole = "student" | "parent" | "counsellor" | "admin";

export type AdminStudent = {
  id: string; full_name: string | null; email: string | null; phone: string | null; role: string; created_at: string; bought: string[];
  predictor: { access: boolean; reason: "admin" | "paid" | "given" | "removed" | "none"; override: boolean | null };
  /** login providers from Supabase Auth, e.g. ["google"] or ["email"] */
  signedUpWith: string[];
  /** free items this student unlocked (₹0) or free tests they took — newest first */
  freeItems: { title: string; kind: "item" | "test"; at: string }[];
  /** package session credits (null until supabase/packages.sql is run) */
  credits: { total: number; used: number; unlimited: boolean } | null;
};

const PROVIDER: Record<string, { label: string; style: string }> = {
  google: { label: "Google", style: "bg-sky-50 text-sky-700 ring-sky-200" },
  email: { label: "Email", style: "bg-slate-100 text-slate-700 ring-slate-200" },
  phone: { label: "Phone", style: "bg-violet-50 text-violet-700 ring-violet-200" },
};
const providerLabel = (p: string) => PROVIDER[p]?.label ?? p;

function SignedUpWith({ providers }: { providers: string[] }) {
  if (providers.length === 0) return null;
  return (
    <p className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
      Signed up with
      {providers.map((p) => (
        <span key={p} className={`rounded-full px-2 py-0.5 font-bold ring-1 ${PROVIDER[p]?.style ?? PROVIDER.email.style}`}>{providerLabel(p)}</span>
      ))}
    </p>
  );
}

const REASON: Record<AdminStudent["predictor"]["reason"], string> = {
  admin: "Admin",
  paid: "Paid counselling",
  given: "Given by admin",
  removed: "Removed by admin",
  none: "No paid counselling",
};

export default function StudentsManager({ students, currentUserId, setupMissing = false }: { students: AdminStudent[]; currentUserId: string; setupMissing?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [onlyFree, setOnlyFree] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const shown = students.filter(
    (s) => (!onlyFree || s.freeItems.length > 0) && (!q || `${s.full_name ?? ""} ${s.email ?? ""} ${s.phone ?? ""}`.toLowerCase().includes(q.toLowerCase())),
  );
  const freeUsers = students.filter((s) => s.freeItems.length > 0).length;

  // Deletion request (student asked by email/WhatsApp): type DELETE to confirm
  const deleteAccount = (s: AdminStudent) => {
    const who = s.full_name || s.email || "this student";
    const typed = prompt(
      `Delete the account of ${who}?\n\n• Deleted: login, profile, predictions, test results, enquiries, reviews, credits.\n• Kept without name/email/phone: payment and invoice records (tax).\n• They get a confirmation email.\n\nThis can't be undone. Type DELETE to confirm:`,
      "",
    );
    if (typed === null) return;
    start(async () => {
      const res = await adminDeleteAccount(s.id, typed);
      setMsg(res.ok ? { kind: "success", text: res.message ?? "Deleted." } : { kind: "error", text: res.error });
      if (res.ok) router.refresh();
    });
  };

  const changeRole = (s: AdminStudent, role: UserRole) => {
    if (role === s.role) return;
    const who = s.full_name || s.email || "this user";
    const text =
      role === "admin" ? `Make ${who} an ADMIN? They will be able to change products, prices, payments, settings and other users.`
      : role === "counsellor" ? `Make ${who} a COUNSELLOR?\n\nThey can open: Bookings (no amounts), Leads, Students (no payments) and Enquiries.\nThey can NOT see revenue, payments, prices, coupons, settings or exports.\nThey must set up 2-step login (authenticator app) the first time.`
      : `Change ${who} to ${role}? They lose any staff access.`;
    if (!confirm(text)) return;
    start(async () => {
      const res = await setUserRole(s.id, role);
      setMsg(res.ok ? { kind: "success", text: res.message ?? "Saved." } : { kind: "error", text: res.error });
      if (res.ok) router.refresh();
    });
  };

  const changePredictor = (s: AdminStudent, mode: "auto" | "give" | "remove") => {
    const who = s.full_name || s.email || "this student";
    const text =
      mode === "give" ? `Give ${who} access to the Rank & College Predictor (e.g. paid offline)?`
      : mode === "remove" ? `Remove predictor access from ${who}? (Even if they paid for counselling.)`
      : `Go back to automatic for ${who}? (Access only with a paid counselling booking.)`;
    if (!confirm(text)) return;
    start(async () => {
      const res = await setPredictorAccess(s.id, mode);
      setMsg(res.ok ? { kind: "success", text: res.message ?? "Saved." } : { kind: "error", text: res.error });
      if (res.ok) router.refresh();
    });
  };
  const withAccess = students.filter((s) => s.predictor.access && s.role !== "admin").length;

  const adjustCredits = (s: AdminStudent) => {
    const who = s.full_name || s.email || "this student";
    const raw = prompt(`Adjust session credits for ${who}.\n\nType a number: 2 = give 2 sessions, -1 = take 1 away.`, "1");
    if (raw === null) return;
    const delta = Number(raw);
    if (!Number.isInteger(delta) || delta === 0) return alert("Please type a whole number like 2 or -1.");
    const note = prompt("Reason (optional) — e.g. Paid offline, Bonus session, Correction", "") ?? "";
    start(async () => {
      const res = await adjustSessionCredits(s.id, delta, note);
      setMsg(res.ok ? { kind: "success", text: res.message ?? "Saved." } : { kind: "error", text: res.error });
      if (res.ok) router.refresh();
    });
  };

  return (
    <>
      <AdminHeader title="Students" subtitle={`${students.length} registered user${students.length === 1 ? "" : "s"} · ${withAccess} with predictor access.`}>
        <button
          type="button"
          onClick={() => downloadCsv("students.csv", ["Name", "Email", "Phone", "Role", "Signed up with", "Joined", "Bought", "Free items", "Sessions", "Predictor access"], shown.map((s) => [s.full_name, s.email, s.phone, s.role, s.signedUpWith.map(providerLabel).join(" + "), csvDateTimeIST(s.created_at), s.bought.join("; "), s.freeItems.map((f) => `${f.title}${f.kind === "test" ? " (test)" : ""} — ${csvDateTimeIST(f.at)}`).join("; "), s.credits ? (s.credits.unlimited ? "Unlimited" : `${Math.max(s.credits.total - s.credits.used, 0)} of ${s.credits.total} left`) : "", `${s.predictor.access ? "Yes" : "No"} (${REASON[s.predictor.reason]})`]))}
          className="btn-light"
        >
          Export CSV
        </button>
      </AdminHeader>
      <div className="card mb-4 p-4">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 h-4 w-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, email or phone…" className="input !pl-9" aria-label="Search students" />
        </div>
        <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={onlyFree} onChange={(e) => setOnlyFree(e.target.checked)} className="h-4 w-4 accent-emerald-600" />
          Only students who used free resources ({freeUsers}) — good for follow-up calls
        </label>
      </div>
      {setupMissing && <div className="mb-4"><Notice kind="error">Predictor access switches need supabase/predictor-access.sql — run it in Supabase → SQL Editor.</Notice></div>}
      {msg && <div className="mb-4"><Notice kind={msg.kind}>{msg.text}</Notice></div>}

      <div className={`card overflow-x-auto ${pending ? "opacity-60" : ""}`}>
        <table className="w-full min-w-[1260px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3">Bought</th>
              <th className="px-4 py-3">Free items</th>
              <th className="px-4 py-3">Sessions</th>
              <th className="px-4 py-3">Predictor access</th>
              <th className="px-4 py-3 text-right">Role</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500">No users found.</td></tr>}
            {shown.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-900">{s.full_name || "—"}</p>
                  <p className="text-xs capitalize text-slate-500">{s.role}</p>
                  <SignedUpWith providers={s.signedUpWith} />
                </td>
                <td className="px-4 py-3 text-slate-600">
                  <p className="break-all">{s.email || "—"}</p>
                  <p className="text-xs">{s.phone ? `+${s.phone}` : ""}</p>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDateTime(s.created_at)}</td>
                <td className="px-4 py-3 text-slate-600">
                  {s.bought.length ? <ul className="list-disc pl-4 text-xs">{s.bought.map((b, i) => <li key={i}>{b}</li>)}</ul> : <span className="text-xs text-slate-400">Nothing yet</span>}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {s.freeItems.length ? (
                    <ul className="space-y-1 text-xs">
                      {s.freeItems.map((f, i) => (
                        <li key={i}>
                          <span className="mr-1 rounded bg-emerald-100 px-1 py-px text-[10px] font-extrabold uppercase text-emerald-700">{f.kind === "test" ? "Test" : "Free"}</span>
                          {f.title}
                          <span className="block text-[11px] text-slate-400">{formatDateTime(f.at)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : <span className="text-xs text-slate-400">—</span>}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs">
                  {s.credits ? (
                    <>
                      <p className="font-bold text-slate-800">
                        {s.credits.unlimited ? "Unlimited" : s.credits.total > 0 || s.credits.used > 0 ? `${Math.max(s.credits.total - s.credits.used, 0)} of ${s.credits.total} left` : "—"}
                      </p>
                      {s.credits.used > 0 && <p className="text-slate-500">{s.credits.used} booked</p>}
                      {s.role !== "admin" && <button type="button" onClick={() => adjustCredits(s)} className="mt-1 font-semibold text-brand-700 underline">Adjust</button>}
                    </>
                  ) : <span className="text-slate-400">Run packages.sql</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${s.predictor.access ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-slate-100 text-slate-600"}`}>
                    {s.predictor.access ? <TargetIcon className="h-3.5 w-3.5" /> : <LockIcon className="h-3.5 w-3.5" />}
                    {s.predictor.access ? "Yes" : "No"}
                  </span>
                  <p className="mt-1 text-[11px] text-slate-500">{REASON[s.predictor.reason]}</p>
                  {s.role !== "admin" && !setupMissing && (
                    <select
                      value={s.predictor.override === true ? "give" : s.predictor.override === false ? "remove" : "auto"}
                      onChange={(e) => changePredictor(s, e.target.value as "auto" | "give" | "remove")}
                      className="mt-1.5 rounded-lg border-0 bg-white px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200"
                      aria-label={`Predictor access for ${s.full_name || s.email || "student"}`}
                    >
                      <option value="auto">Automatic (paid counselling)</option>
                      <option value="give">Give access</option>
                      <option value="remove">Remove access</option>
                    </select>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {s.id === currentUserId ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500"><ShieldIcon className="h-4 w-4" /> You</span>
                  ) : (
                    <div className="flex flex-col items-end gap-1.5">
                      <label className="sr-only" htmlFor={`role-${s.id}`}>Role of {s.full_name || s.email || "user"}</label>
                      <select
                        id={`role-${s.id}`}
                        value={s.role}
                        onChange={(e) => changeRole(s, e.target.value as UserRole)}
                        disabled={pending}
                        className={`rounded-lg border-0 px-2 py-1.5 text-xs font-bold ring-1 ${s.role === "admin" ? "bg-red-50 text-red-700 ring-red-200" : s.role === "counsellor" ? "bg-indigo-50 text-indigo-700 ring-indigo-200" : "bg-white text-slate-700 ring-slate-200"}`}
                      >
                        <option value="student">Student</option>
                        <option value="parent">Parent</option>
                        <option value="counsellor">Counsellor (staff)</option>
                        <option value="admin">Admin</option>
                      </select>
                      {s.role !== "admin" && s.role !== "counsellor" && (
                        <button type="button" onClick={() => deleteAccount(s)} className="text-xs font-semibold text-red-600 underline">Delete account</button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
