"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteEnquiry, updateEnquiryStatus } from "@/app/admin/actions";
import { csvDateTimeIST, formatDateTime } from "@/lib/format";
import { DownloadIcon, MailIcon, PhoneIcon, SearchIcon, TrashIcon, WhatsAppIcon } from "../Icons";
import { AdminHeader, Notice, downloadCsv } from "./ui";

export type AdminEnquiry = {
  id: string; name: string; phone: string; email: string | null; class_year: string | null; message: string | null;
  source: "contact" | "unlock" | "other"; status: "new" | "contacted" | "converted"; created_at: string;
};

const STATUS = ["new", "contacted", "converted"] as const;
const statusColor: Record<AdminEnquiry["status"], string> = {
  new: "bg-amber-50 text-amber-800",
  contacted: "bg-sky-50 text-sky-800",
  converted: "bg-green-50 text-green-700",
};

// "9876543210" / "+91 98765 43210" → "919876543210"
const intlPhone = (p: string) => {
  const d = p.replace(/\D/g, "");
  return d.length === 10 ? `91${d}` : d;
};

export default function EnquiriesManager({ enquiries }: { enquiries: AdminEnquiry[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | AdminEnquiry["status"]>("all");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const counts = { new: 0, contacted: 0, converted: 0 };
  enquiries.forEach((e) => counts[e.status]++);
  const shown = enquiries.filter((e) => {
    const text = `${e.name} ${e.phone} ${e.email ?? ""} ${e.class_year ?? ""} ${e.message ?? ""}`.toLowerCase();
    return (filter === "all" || e.status === filter) && (!q || text.includes(q.toLowerCase()));
  });

  const run = (fn: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>) =>
    start(async () => {
      const res = await fn();
      setMsg(res.ok ? { kind: "success", text: res.message ?? "Saved." } : { kind: "error", text: res.error });
      if (res.ok) router.refresh();
    });

  const exportCsv = () =>
    downloadCsv(
      "enquiries.csv",
      ["Date", "Name", "Phone", "Email", "Class / Year", "Message", "From", "Status"],
      shown.map((e) => [csvDateTimeIST(e.created_at), e.name, e.phone, e.email, e.class_year, e.message, e.source, e.status]),
    );

  return (
    <>
      <AdminHeader title="Enquiries" subtitle="Free enquiries sent from the contact and unlock pages.">
        <button type="button" onClick={exportCsv} className="btn-light !px-4 !py-2 text-sm"><DownloadIcon className="h-4 w-4" /> Export CSV</button>
      </AdminHeader>

      <div className="mb-4 grid grid-cols-3 gap-3">
        {STATUS.map((s) => (
          <button key={s} type="button" onClick={() => setFilter(filter === s ? "all" : s)} className={`card p-4 text-left transition ${filter === s ? "ring-2 ring-brand-600" : ""}`}>
            <span className="block text-2xl font-extrabold text-slate-900">{counts[s]}</span>
            <span className="text-sm font-semibold capitalize text-slate-500">{s}</span>
          </button>
        ))}
      </div>

      <div className="card mb-4 flex flex-col gap-3 p-4 sm:flex-row">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone, email or message…" className="input !pl-9" aria-label="Search enquiries" />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="input sm:!w-48" aria-label="Filter by status">
          <option value="all">All enquiries</option>
          {STATUS.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
        </select>
      </div>
      {msg && <div className="mb-4"><Notice kind={msg.kind}>{msg.text}</Notice></div>}

      {shown.length === 0 ? (
        <p className="card p-10 text-center text-slate-500">{enquiries.length === 0 ? "No enquiries yet." : "No enquiries match."}</p>
      ) : (
        <ul className={`space-y-3 ${pending ? "opacity-60" : ""}`}>
          {shown.map((e) => {
            const phone = intlPhone(e.phone);
            const wa = `https://wa.me/${phone}?text=${encodeURIComponent(`Hi ${e.name}, this is EDUVORA replying to your enquiry.`)}`;
            return (
              <li key={e.id} className="card p-4 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="text-lg font-extrabold text-slate-900">{e.name}</span>
                      {e.class_year && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">{e.class_year}</span>}
                      {e.source === "unlock" && <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">From unlock page</span>}
                    </p>
                    <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                      <span className="inline-flex items-center gap-1"><PhoneIcon className="h-3.5 w-3.5" /> {e.phone}</span>
                      {e.email && <a href={`mailto:${e.email}`} className="inline-flex items-center gap-1 hover:text-brand-700"><MailIcon className="h-3.5 w-3.5" /> {e.email}</a>}
                    </p>
                    {e.message && <p className="whitespace-pre-line rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200">“{e.message}”</p>}
                    <p className="text-xs text-slate-400">Received {formatDateTime(e.created_at)}</p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col lg:items-end">
                    <div className="flex gap-2">
                      <a href={`tel:+${phone}`} className="btn-primary !px-4 !py-2 text-sm"><PhoneIcon className="h-4 w-4" /> Call</a>
                      <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-primary !bg-[#25D366] !px-4 !py-2 text-sm"><WhatsAppIcon className="h-4 w-4" /> WhatsApp</a>
                    </div>
                    <div className="flex gap-2">
                      <select
                        value={e.status}
                        onChange={(ev) => run(() => updateEnquiryStatus(e.id, ev.target.value as AdminEnquiry["status"]))}
                        className={`rounded-xl border-0 px-3 py-2 text-sm font-bold capitalize ring-1 ring-slate-200 ${statusColor[e.status]}`}
                        aria-label="Enquiry status"
                      >
                        {STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <button
                        type="button"
                        onClick={() => confirm(`Delete the enquiry from ${e.name}? This cannot be undone.`) && run(() => deleteEnquiry(e.id))}
                        className="grid h-10 w-10 place-items-center rounded-xl text-slate-400 ring-1 ring-slate-200 hover:bg-red-50 hover:text-red-600"
                        aria-label={`Delete enquiry from ${e.name}`}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
