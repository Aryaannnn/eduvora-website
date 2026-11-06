"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setPredictorAccess, setUserRole } from "@/app/admin/actions";
import { csvDateTimeIST, formatDateTime } from "@/lib/format";
import { LockIcon, SearchIcon, ShieldIcon, TargetIcon } from "../Icons";
import { AdminHeader, Notice, downloadCsv } from "./ui";

export type AdminStudent = {
  id: string; full_name: string | null; email: string | null; phone: string | null; role: string; created_at: string; bought: string[];
  predictor: { access: boolean; reason: "admin" | "paid" | "given" | "removed" | "none"; override: boolean | null };
  /** login providers from Supabase Auth, e.g. ["google"] or ["email"] */
  signedUpWith: string[];
  /** free items this student unlocked (₹0) or free tests they took — newest first */
  freeItems: { title: string; kind: "item" | "test"; at: string }[];
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

  const changeRole = (s: AdminStudent, role: "admin" | "student") => {
    const who = s.full_name || s.email || "this user";
    const text = role === "admin" ? `Make ${who} an ADMIN? They will be able to change products, prices, payments and other users.` : `Remove admin access from ${who}?`;
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

  return (
    <>
      <AdminHeader title="Students" subtitle={`${students.length} registered user${students.length === 1 ? "" : "s"} · ${withAccess} with predictor access.`}>
        <button
          type="button"
          onClick={() => downloadCsv("students.csv", ["Name", "Email", "Phone", "Role", "Signed up with", "Joined", "Bought", "Free items", "Predictor access"], shown.map((s) => [s.full_name, s.email, s.phone, s.role, s.signedUpWith.map(providerLabel).join(" + "), csvDateTimeIST(s.created_at), s.bought.join("; "), s.freeItems.map((f) => `${f.title}${f.kind === "test" ? " (test)" : ""} — ${csvDateTimeIST(f.at)}`).join("; "), `${s.predictor.access ? "Yes" : "No"} (${REASON[s.predictor.reason]})`]))}
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
        <table className="w-full min-w-[1140px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3">Bought</th>
              <th className="px-4 py-3">Free items</th>
              <th className="px-4 py-3">Predictor access</th>
              <th className="px-4 py-3 text-right">Role</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">No users found.</td></tr>}
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
                  ) : s.role === "admin" ? (
                    <button type="button" onClick={() => changeRole(s, "student")} className="btn-light !px-3 !py-1.5 text-xs !text-red-600">Remove admin</button>
                  ) : (
                    <button type="button" onClick={() => changeRole(s, "admin")} className="btn-light !px-3 !py-1.5 text-xs"><ShieldIcon className="h-4 w-4" /> Make admin</button>
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
