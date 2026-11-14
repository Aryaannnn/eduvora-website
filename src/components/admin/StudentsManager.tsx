"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { adjustSessionCredits, adminDeleteAccount, setPredictorAccess, setUserRole } from "@/app/admin/actions";
import { csvDateTimeIST, formatDateTime } from "@/lib/format";
import { LockIcon, SearchIcon, ShieldIcon, TargetIcon } from "../Icons";
import { AdminHeader, Notice, downloadCsv } from "./ui";

type UserRole = "student" | "parent" | "counsellor" | "admin";

const ROLES: Record<UserRole, { label: string; badge: string; select: string }> = {
  student: { label: "Student", badge: "bg-sky-50 text-sky-700 ring-sky-200", select: "bg-white text-slate-700 ring-slate-200" },
  parent: { label: "Parent", badge: "bg-amber-50 text-amber-800 ring-amber-200", select: "bg-amber-50 text-amber-800 ring-amber-200" },
  counsellor: { label: "Counsellor", badge: "bg-indigo-50 text-indigo-700 ring-indigo-200", select: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
  admin: { label: "Admin", badge: "bg-red-50 text-red-700 ring-red-200", select: "bg-red-50 text-red-700 ring-red-200" },
};
const roleInfo = (r: string) => ROLES[r as UserRole] ?? ROLES.student;
const WHAT_CHANGES: Record<UserRole, string> = {
  student: "They lose any staff access and see the normal student dashboard.",
  parent: "They lose any staff access and see the normal dashboard.",
  counsellor: "They can open Bookings (no amounts), Leads, Students (no payments) and Enquiries. They can NOT see revenue, payments, prices, coupons, settings or exports. They must set up 2-step login the first time.",
  admin: "They get FULL control: products, prices, payments, settings and other users' roles. They must set up 2-step login the first time.",
};

function RoleBadge({ role }: { role: string }) {
  const r = roleInfo(role);
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${r.badge}`}>{r.label}</span>;
}

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
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");
  // Roles changed on this screen (shown at once, without reloading the page)
  const [changedRoles, setChangedRoles] = useState<Record<string, UserRole>>({});
  const roleOf = (s: AdminStudent) => changedRoles[s.id] ?? s.role;
  // The "Change role?" popup
  const [ask, setAsk] = useState<{ s: AdminStudent; from: string; to: UserRole } | null>(null);
  const [typedEmail, setTypedEmail] = useState("");
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const shown = students.filter(
    (s) => (roleFilter === "all" || roleOf(s) === roleFilter) && (!onlyFree || s.freeItems.length > 0) && (!q || `${s.full_name ?? ""} ${s.email ?? ""} ${s.phone ?? ""}`.toLowerCase().includes(q.toLowerCase())),
  );
  const freeUsers = students.filter((s) => s.freeItems.length > 0).length;
  const roleCount = (r: UserRole) => students.filter((s) => roleOf(s) === r).length;

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
    if (role === roleOf(s)) return;
    setTypedEmail("");
    setAsk({ s, from: roleOf(s), to: role });
  };

  const confirmRole = () => {
    if (!ask) return;
    const { s, to } = ask;
    start(async () => {
      const res = await setUserRole(s.id, to, to === "admin" ? typedEmail : undefined);
      if (res.ok) {
        setChangedRoles((m) => ({ ...m, [s.id]: res.data?.newRole ?? to }));
        setMsg({ kind: "success", text: `${s.full_name || s.email || "User"}: ${res.message ?? "Role changed."}` });
        router.refresh(); // quietly re-syncs the list (no page reload)
      } else {
        setMsg({ kind: "error", text: res.error });
      }
      setAsk(null);
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
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter by role">
          {(["all", "student", "parent", "counsellor", "admin"] as const).filter((r) => r !== "parent" || roleCount("parent") > 0).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRoleFilter(r)}
              aria-pressed={roleFilter === r}
              className={`rounded-full px-3 py-1 text-xs font-bold ring-1 transition ${roleFilter === r ? "bg-slate-900 text-white ring-slate-900" : r === "all" ? "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50" : `${ROLES[r].badge} hover:brightness-95`}`}
            >
              {r === "all" ? `All (${students.length})` : `${ROLES[r].label}s (${roleCount(r)})`}
            </button>
          ))}
        </div>
      </div>
      {setupMissing && <div className="mb-4"><Notice kind="error">Predictor access switches need supabase/predictor-access.sql — run it in Supabase → SQL Editor.</Notice></div>}
      {msg && <div className="mb-4" role="status"><Notice kind={msg.kind}>{msg.text}</Notice></div>}
      {ask && (
        <RoleDialog
          name={ask.s.full_name || ask.s.email || "this user"}
          email={ask.s.email}
          from={ask.from}
          to={ask.to}
          typedEmail={typedEmail}
          setTypedEmail={setTypedEmail}
          busy={pending}
          onCancel={() => !pending && setAsk(null)}
          onConfirm={confirmRole}
        />
      )}

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
                  <p className="mt-0.5"><RoleBadge role={roleOf(s)} /></p>
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
                      {roleOf(s) !== "admin" && <button type="button" onClick={() => adjustCredits(s)} className="mt-1 font-semibold text-brand-700 underline">Adjust</button>}
                    </>
                  ) : <span className="text-slate-400">Run packages.sql</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${s.predictor.access ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-slate-100 text-slate-600"}`}>
                    {s.predictor.access ? <TargetIcon className="h-3.5 w-3.5" /> : <LockIcon className="h-3.5 w-3.5" />}
                    {s.predictor.access ? "Yes" : "No"}
                  </span>
                  <p className="mt-1 text-[11px] text-slate-500">{REASON[s.predictor.reason]}</p>
                  {roleOf(s) !== "admin" && !setupMissing && (
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
                        value={roleOf(s)}
                        onChange={(e) => changeRole(s, e.target.value as UserRole)}
                        disabled={pending}
                        className={`rounded-lg border-0 px-2 py-1.5 text-xs font-bold ring-1 ${roleInfo(roleOf(s)).select}`}
                      >
                        <option value="student">Student</option>
                        {roleOf(s) === "parent" && <option value="parent">Parent</option>}
                        <option value="counsellor">Counsellor</option>
                        <option value="admin">Admin</option>
                      </select>
                      {roleOf(s) !== "admin" && roleOf(s) !== "counsellor" && (
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

/** "Change Riya's role from Student to Counsellor?" — Confirm / Cancel. Making an admin needs their email typed. */
function RoleDialog({
  name, email, from, to, typedEmail, setTypedEmail, busy, onCancel, onConfirm,
}: {
  name: string; email: string | null; from: string; to: UserRole; typedEmail: string;
  setTypedEmail: (v: string) => void; busy: boolean; onCancel: () => void; onConfirm: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const cancelRef = useRef(onCancel);
  useEffect(() => { cancelRef.current = onCancel; });
  const needsEmail = to === "admin";
  const emailOk = !needsEmail || (!!email && typedEmail.trim().toLowerCase() === email.trim().toLowerCase());
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>("input, button")?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") cancelRef.current(); };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, []);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div ref={box} role="dialog" aria-modal="true" aria-labelledby="role-dialog-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 id="role-dialog-title" className="text-lg font-extrabold text-slate-900">
          Change {name}&apos;s role from {roleInfo(from).label} to {ROLES[to].label}?
        </h2>
        <p className="mt-2 flex items-center gap-2 text-sm"><RoleBadge role={from} /> <span aria-hidden>→</span> <RoleBadge role={to} /></p>
        <p className="mt-3 text-sm text-slate-600">{WHAT_CHANGES[to]}</p>
        <p className="mt-2 text-xs text-slate-500">It applies the next time they open a page. The change is saved in the Activity Log.</p>
        {needsEmail && (
          <div className="mt-4 rounded-xl bg-red-50 p-3 ring-1 ring-red-200">
            <label htmlFor="role-confirm-email" className="text-sm font-bold text-red-800">
              To confirm, type their email{email ? <>: <span className="break-all font-mono">{email}</span></> : ""}
            </label>
            <input
              id="role-confirm-email"
              type="email"
              autoComplete="off"
              value={typedEmail}
              onChange={(e) => setTypedEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && emailOk && !busy) onConfirm(); }}
              className="input mt-2"
              placeholder="their@email.com"
            />
            {!email && <p className="mt-1 text-xs text-red-700">This account has no email, so it can&apos;t be made an admin.</p>}
          </div>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className="btn-light">Cancel</button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy || !emailOk}
            className={`btn-primary disabled:cursor-not-allowed disabled:opacity-50 ${to === "admin" ? "!bg-red-600 hover:!bg-red-700" : ""}`}
          >
            {busy ? "Saving…" : `Yes, make ${ROLES[to].label}`}
          </button>
        </div>
      </div>
    </div>
  );
}
