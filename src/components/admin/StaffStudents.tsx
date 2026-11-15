"use client";

// Admin → Students as a COUNSELLOR sees it: view only, no payment information
// (data from the staff_students view, which has no amounts or purchases).
import { useState } from "react";
import { formatDateTime } from "@/lib/format";
import { MailIcon, PhoneIcon, SearchIcon, WhatsAppIcon } from "../Icons";
import { AdminHeader } from "./ui";

export type StaffStudent = { id: string; full_name: string | null; email: string | null; phone: string | null; role: string; created_at: string; sessions_booked: number };

const intlPhone = (p: string) => {
  const d = p.replace(/\D/g, "");
  return d.length === 10 ? `91${d}` : d;
};

export default function StaffStudents({ students }: { students: StaffStudent[] }) {
  const [q, setQ] = useState("");
  const shown = students.filter((s) => !q || `${s.full_name ?? ""} ${s.email ?? ""} ${s.phone ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <AdminHeader title="Students" subtitle={`${students.length} registered students and parents (view only).`} />
      <div className="card mb-4 p-4">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email or phone…" className="input !pl-9" aria-label="Search students" />
        </div>
      </div>
      {shown.length === 0 ? (
        <p className="card p-10 text-center text-slate-500">No students found.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Sessions</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3 text-right">Reach out</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.slice(0, 500).map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3">
                    <p className="font-bold text-slate-900">{s.full_name || "—"}</p>
                    <p className="text-xs capitalize text-slate-500">{s.role}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <p>{s.email ?? "—"}</p>
                    <p>{s.phone ?? ""}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{s.sessions_booked}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDateTime(s.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      {s.phone && <a href={`tel:+${intlPhone(s.phone)}`} className="rounded-lg p-2 text-brand-700 ring-1 ring-slate-200 hover:bg-slate-50" aria-label={`Call ${s.full_name ?? ""}`}><PhoneIcon className="h-4 w-4" /></a>}
                      {s.phone && <a href={`https://wa.me/${intlPhone(s.phone)}`} target="_blank" rel="noopener noreferrer" className="rounded-lg p-2 text-[#128C7E] ring-1 ring-slate-200 hover:bg-slate-50" aria-label={`WhatsApp ${s.full_name ?? ""}`}><WhatsAppIcon className="h-4 w-4" /></a>}
                      {s.email && <a href={`mailto:${s.email}`} className="rounded-lg p-2 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50" aria-label={`Email ${s.full_name ?? ""}`}><MailIcon className="h-4 w-4" /></a>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
