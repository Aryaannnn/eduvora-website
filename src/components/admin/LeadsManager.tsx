"use client";

// Admin → Leads: every potential student in one list (merged by account,
// email or phone), with a status pipeline, follow-ups, notes and quick contact.
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { addLeadNote, assignLead, deleteLeadNote, updateLead, type LeadStatus } from "@/app/admin/actions";
import { formatDate, formatDateTime, formatPrice } from "@/lib/format";
import { CalendarIcon, ChevronDownIcon, DownloadIcon, MailIcon, PhoneIcon, SearchIcon, TrashIcon, WhatsAppIcon } from "../Icons";
import { AdminHeader, downloadCsv, Notice } from "./ui";

export type LeadNote = { id: string; body: string; created_at: string; created_by?: string | null };
type Staff = { id: string; full_name: string | null; email: string | null; role: string };
export type AdminLead = {
  id: string; user_id: string | null; email: string | null; phone: string | null; name: string | null; class_year: string | null;
  predicted_rank: string | null; sources: string[]; status: LeadStatus; follow_up_on: string | null; first_seen_at: string;
  last_activity_at: string; status_changed_at: string | null; total_paid: number; notes_count: number; assigned_to?: string | null;
};

const STATUSES: { v: LeadStatus; label: string; cls: string }[] = [
  { v: "new", label: "New", cls: "bg-sky-50 text-sky-700 ring-sky-200" },
  { v: "contacted", label: "Contacted", cls: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
  { v: "interested", label: "Interested", cls: "bg-amber-50 text-amber-800 ring-amber-200" },
  { v: "paid", label: "Paid", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  { v: "not_interested", label: "Not Interested", cls: "bg-slate-100 text-slate-600 ring-slate-200" },
];
const statusOf = (v: string) => STATUSES.find((s) => s.v === v) ?? STATUSES[0];

const SOURCES: Record<string, string> = {
  signup: "Signup",
  enquiry: "Enquiry",
  predictor: "Predictor",
  free_resource: "Free resource",
  free_guide: "Free guide",
  abandoned_payment: "Abandoned payment",
  booking: "Booking",
};

type Added = "all" | "7" | "30" | "90";
type Follow = "all" | "due" | "upcoming" | "none";

const DAY = 86400000;
const intlPhone = (p: string) => (p.length === 10 ? `91${p}` : p);

/** What to say on WhatsApp, based on how they found us. */
function whatsappText(l: AdminLead, founderFirst: string, business: string) {
  const first = (l.name ?? "").split(" ")[0] || "there";
  const why = l.sources.includes("abandoned_payment")
    ? "I saw you started a payment on our website but it didn't go through. Can I help you complete it, or answer any questions?"
    : l.sources.includes("predictor")
      ? `I saw you checked your rank on our Rank Predictor${l.predicted_rank ? ` (${l.predicted_rank})` : ""}. Would you like help choosing the right VIT campus and branch?`
      : l.sources.includes("enquiry")
        ? "Thank you for your enquiry. When is a good time to talk about your VITEEE counselling?"
        : l.sources.includes("free_guide")
          ? "Thanks for downloading our free VITEEE Counselling Checklist! Do you have any questions about your rank, campus or branch?"
        : l.sources.includes("free_resource")
          ? "Hope the free study resource is helping! Would you like guidance for VITEEE and VIT counselling?"
          : "Thank you for signing up. Would you like help with VITEEE preparation or VIT counselling?";
  return `Hi ${first}, this is ${founderFirst} from ${business}. ${why}`;
}

export default function LeadsManager({
  leads, notes, today, founderFirst, business, role = "admin", me = "", staff = null,
}: {
  leads: AdminLead[]; notes: Record<string, LeadNote[]>; today: string; founderFirst: string; business: string;
  /** counsellors: no total paid, no CSV, can't assign */
  role?: "admin" | "counsellor"; me?: string; staff?: Staff[] | null;
}) {
  const isAdmin = role === "admin";
  const staffName = (id: string | null | undefined) => (id ? (staff ?? []).find((m) => m.id === id) : null);
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "open" | LeadStatus>("all");
  const [source, setSource] = useState("all");
  const [added, setAdded] = useState<Added>("all");
  const [follow, setFollow] = useState<Follow>(params.get("f") === "due" ? "due" : "all");
  const [assigned, setAssigned] = useState("all");
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const isDue = (l: AdminLead) => !!l.follow_up_on && l.follow_up_on <= today && !["paid", "not_interested"].includes(l.status);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    const digits = term.replace(/\D/g, "");
    // eslint-disable-next-line react-hooks/purity -- "added in the last N days" filter needs the current time
    const now = Date.now();
    return leads.filter((l) => {
      if (status === "open" ? ["paid", "not_interested"].includes(l.status) : status !== "all" && l.status !== status) return false;
      if (source !== "all" && !l.sources.includes(source)) return false;
      if (added !== "all" && now - new Date(l.first_seen_at).getTime() > Number(added) * DAY) return false;
      if (follow === "due" && !isDue(l)) return false;
      if (follow === "upcoming" && !(l.follow_up_on && l.follow_up_on > today)) return false;
      if (follow === "none" && l.follow_up_on) return false;
      if (assigned === "none" ? !!l.assigned_to : assigned !== "all" && l.assigned_to !== assigned) return false;
      if (term) {
        const text = `${l.name ?? ""} ${l.email ?? ""} ${l.class_year ?? ""}`.toLowerCase();
        if (!text.includes(term) && !(digits.length >= 3 && (l.phone ?? "").includes(digits))) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, q, status, source, added, follow, assigned, today]);

  // Conversion summary
  const summary = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity -- "this week" needs the current time
    const weekAgo = Date.now() - 7 * DAY;
    const total = leads.length;
    const week = leads.filter((l) => new Date(l.first_seen_at).getTime() >= weekAgo).length;
    const contacted = leads.filter((l) => l.status !== "new").length;
    const paid = leads.filter((l) => l.status === "paid").length;
    const due = leads.filter((l) => !!l.follow_up_on && l.follow_up_on <= today && !["paid", "not_interested"].includes(l.status)).length;
    return { total, week, contacted, paid, due, rate: total ? (paid / total) * 100 : 0 };
  }, [leads, today]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, after?: () => void) =>
    start(async () => {
      const res = await fn();
      setMsg(res.ok ? { kind: "success", text: res.message ?? "Saved." } : { kind: "error", text: res.error ?? "Something went wrong." });
      if (res.ok) {
        after?.();
        router.refresh();
      }
    });

  const exportCsv = () =>
    downloadCsv(
      `leads-${today}.csv`,
      ["Name", "Phone", "Email", "Sources", "Class / year", "Predicted rank", "Status", "Follow-up", "Total paid (₹)", "First seen", "Last activity", "Notes"],
      shown.map((l) => [
        l.name ?? "", l.phone ?? "", l.email ?? "", l.sources.map((s) => SOURCES[s] ?? s).join(", "), l.class_year ?? "", l.predicted_rank ?? "",
        statusOf(l.status).label, l.follow_up_on ?? "", Number(l.total_paid) || 0, l.first_seen_at.slice(0, 10), l.last_activity_at.slice(0, 10),
        (notes[l.id] ?? []).map((n) => `[${n.created_at.slice(0, 10)}] ${n.body}`).join(" | "),
      ]),
    );

  const resetFilters = () => { setQ(""); setStatus("all"); setSource("all"); setAdded("all"); setFollow("all"); setAssigned("all"); };

  return (
    <>
      <AdminHeader title="Leads" subtitle="Everyone who showed interest — signups, enquiries, predictor users, free resources and unfinished payments. Duplicates are merged by email or phone.">
        {staff && staff.length > 0 && (
          <select value={assigned} onChange={(e) => setAssigned(e.target.value)} className="input !w-auto" aria-label="Assigned to">
            <option value="all">Assigned: anyone</option>
            <option value={me}>Assigned to me ({leads.filter((l) => l.assigned_to === me).length})</option>
            <option value="none">Not assigned</option>
            {isAdmin && staff.filter((m) => m.id !== me).map((m) => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}
          </select>
        )}
        {isAdmin && <button type="button" onClick={exportCsv} disabled={!shown.length} className="btn-light disabled:opacity-50"><DownloadIcon className="h-4 w-4" /> CSV ({shown.length})</button>}
      </AdminHeader>

      {/* Conversion summary */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: "Leads this week", value: summary.week, sub: `${summary.total} in total` },
          { label: "Contacted", value: summary.contacted, sub: summary.total ? `${Math.round((summary.contacted / summary.total) * 100)}% of leads` : "—" },
          { label: "Paid", value: summary.paid, sub: "became students" },
          { label: "Conversion rate", value: `${summary.rate.toFixed(1)}%`, sub: "paid ÷ all leads" },
          { label: "Follow-ups due", value: summary.due, sub: "today or overdue", alert: summary.due > 0, onClick: () => { resetFilters(); setFollow("due"); } },
        ].map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={c.onClick}
            disabled={!c.onClick}
            className={`card p-4 text-left disabled:cursor-default ${c.alert ? "ring-2 ring-amber-300" : ""} ${c.onClick ? "card-hover" : ""}`}
          >
            <p className="text-xs font-semibold text-slate-500">{c.label}</p>
            <p className={`mt-1 text-2xl font-extrabold ${c.alert ? "text-amber-700" : "text-slate-900"}`}>{c.value}</p>
            <p className="text-xs text-slate-400">{c.sub}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1fr]">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone, email…" className="input !pl-9" aria-label="Search leads" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="input" aria-label="Status">
          <option value="all">All statuses</option>
          <option value="open">Open (not Paid / Not Interested)</option>
          {STATUSES.map((s) => <option key={s.v} value={s.v}>{s.label} ({leads.filter((l) => l.status === s.v).length})</option>)}
        </select>
        <select value={source} onChange={(e) => setSource(e.target.value)} className="input" aria-label="Source">
          <option value="all">All sources</option>
          {Object.entries(SOURCES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={added} onChange={(e) => setAdded(e.target.value as Added)} className="input" aria-label="Date added">
          <option value="all">Any date</option>
          <option value="7">Added last 7 days</option>
          <option value="30">Added last 30 days</option>
          <option value="90">Added last 90 days</option>
        </select>
        <select value={follow} onChange={(e) => setFollow(e.target.value as Follow)} className="input" aria-label="Follow-up">
          <option value="all">Any follow-up</option>
          <option value="due">Follow-up due ({summary.due})</option>
          <option value="upcoming">Follow-up later</option>
          <option value="none">No follow-up set</option>
        </select>
      </div>

      {msg && <div className="mb-4"><Notice kind={msg.kind}>{msg.text}</Notice></div>}

      {shown.length === 0 ? (
        <p className="card p-10 text-center text-slate-500">
          {leads.length === 0 ? "No leads yet. They appear here automatically when people sign up, send an enquiry, use the predictor, get a free resource or start a payment." : "No leads match these filters."}
          {leads.length > 0 && <button type="button" onClick={resetFilters} className="ml-2 font-semibold text-brand-700 underline">Clear filters</button>}
        </p>
      ) : (
        <ul className={`space-y-2 ${pending ? "opacity-70" : ""}`}>
          {shown.slice(0, 300).map((l) => (
            <LeadRow
              key={l.id}
              l={l}
              notes={notes[l.id] ?? []}
              open={open === l.id}
              due={isDue(l)}
              today={today}
              toggle={() => setOpen(open === l.id ? null : l.id)}
              wa={whatsappText(l, founderFirst, business)}
              business={business}
              disabled={pending}
              onStatus={(v) => run(() => updateLead(l.id, { status: v }))}
              onFollow={(d) => run(() => updateLead(l.id, { follow_up_on: d }))}
              onNote={(body, done) => run(() => addLeadNote(l.id, body), done)}
              onDeleteNote={(id) => confirm("Delete this note?") && run(() => deleteLeadNote(id))}
              isAdmin={isAdmin}
              me={me}
              staff={staff}
              assignedName={staffName(l.assigned_to)?.full_name || staffName(l.assigned_to)?.email || null}
              onAssign={(id) => run(() => assignLead(l.id, id))}
            />
          ))}
          {shown.length > 300 && <li className="p-3 text-center text-sm text-slate-500">Showing the 300 most recent — use search or filters (CSV has all {shown.length}).</li>}
        </ul>
      )}
    </>
  );
}

function LeadRow({
  l, notes, open, due, today, toggle, wa, business, disabled, onStatus, onFollow, onNote, onDeleteNote, isAdmin, me, staff, assignedName, onAssign,
}: {
  l: AdminLead; notes: LeadNote[]; open: boolean; due: boolean; today: string; toggle: () => void; wa: string; business: string; disabled: boolean;
  onStatus: (v: LeadStatus) => void; onFollow: (d: string | null) => void; onNote: (body: string, done: () => void) => void; onDeleteNote: (id: string) => void;
  isAdmin: boolean; me: string; staff: Staff[] | null; assignedName: string | null; onAssign: (id: string | null) => void;
}) {
  const [note, setNote] = useState("");
  const st = statusOf(l.status);
  const first = (l.name ?? "").split(" ")[0] || "there";
  const plus = (n: number) => new Date(Date.parse(`${today}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10);

  return (
    <li className={`card overflow-hidden ${due ? "ring-2 ring-amber-300" : ""}`}>
      <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
        <button type="button" onClick={toggle} className="flex min-w-0 flex-1 items-start gap-3 text-left" aria-expanded={open}>
          <ChevronDownIcon className={`mt-1 h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-900">{l.name || l.email || l.phone || "Unknown"}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${st.cls}`}>{st.label}</span>
              {isAdmin && Number(l.total_paid) > 0 && <span className="text-xs font-bold text-emerald-700">{formatPrice(Number(l.total_paid))} paid</span>}
              {l.assigned_to && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">{l.assigned_to === me ? "Assigned to you" : `Assigned: ${assignedName ?? "staff"}`}</span>}
              {due && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">Follow up {l.follow_up_on! < today ? `(was ${formatDate(l.follow_up_on!)})` : "today"}</span>}
            </p>
            <p className="mt-0.5 truncate text-sm text-slate-600">
              {[l.phone ? `+91 ${l.phone}` : null, l.email, l.class_year, l.predicted_rank ? `Rank ${l.predicted_rank.replace(/^Rank /, "")}` : null].filter(Boolean).join(" · ")}
            </p>
            <p className="mt-1 flex flex-wrap gap-1.5 text-xs">
              {l.sources.map((s) => <span key={s} className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">{SOURCES[s] ?? s}</span>)}
              <span className="text-slate-400">· last activity {formatDateTime(l.last_activity_at)}{l.notes_count ? ` · ${l.notes_count} note${l.notes_count === 1 ? "" : "s"}` : ""}</span>
            </p>
          </div>
        </button>
        <div className="flex shrink-0 flex-wrap items-center gap-2 pl-7 lg:pl-0">
          {l.phone && <a href={`tel:+${intlPhone(l.phone)}`} className="btn-primary !px-3 !py-2 text-sm" title="Call"><PhoneIcon className="h-4 w-4" /> Call</a>}
          {l.phone && (
            <a href={`https://wa.me/${intlPhone(l.phone)}?text=${encodeURIComponent(wa)}`} target="_blank" rel="noopener noreferrer" className="btn-primary !bg-[#25D366] !px-3 !py-2 text-sm" title="WhatsApp with a ready message">
              <WhatsAppIcon className="h-4 w-4" /> WhatsApp
            </a>
          )}
          {l.email && (
            <a
              href={`mailto:${l.email}?subject=${encodeURIComponent(`${business} — VITEEE counselling`)}&body=${encodeURIComponent(`Hi ${first},\n\n${wa.replace(/^Hi [^,]+, /, "")}\n\n`)}`}
              className="btn-light !px-3 !py-2 text-sm"
              title="Email"
            >
              <MailIcon className="h-4 w-4" /> Email
            </a>
          )}
          <select value={l.status} onChange={(e) => onStatus(e.target.value as LeadStatus)} disabled={disabled} className={`rounded-xl border-0 px-3 py-2 text-sm font-bold ring-1 ${st.cls}`} aria-label={`Status of ${l.name ?? "lead"}`}>
            {STATUSES.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {open && (
        <div className="grid gap-5 border-t border-slate-100 bg-slate-50/60 p-4 md:grid-cols-2">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-bold text-slate-800"><CalendarIcon className="h-4 w-4" /> Follow-up date</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input type="date" defaultValue={l.follow_up_on ?? ""} key={l.follow_up_on ?? "none"} onChange={(e) => e.target.value && onFollow(e.target.value)} className="input !w-auto !py-1.5 text-sm" aria-label="Follow-up date" />
              {[["Tomorrow", 1], ["In 3 days", 3], ["Next week", 7]].map(([label, n]) => (
                <button key={label} type="button" disabled={disabled} onClick={() => onFollow(plus(n as number))} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100">{label}</button>
              ))}
              {l.follow_up_on && <button type="button" disabled={disabled} onClick={() => onFollow(null)} className="text-xs font-semibold text-red-600 underline">Clear</button>}
            </div>
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-slate-500">First seen</dt><dd className="text-slate-800">{formatDateTime(l.first_seen_at)}</dd>
              <dt className="text-slate-500">Last activity</dt><dd className="text-slate-800">{formatDateTime(l.last_activity_at)}</dd>
              {isAdmin && (<><dt className="text-slate-500">Total paid</dt><dd className="text-slate-800">{Number(l.total_paid) > 0 ? formatPrice(Number(l.total_paid)) : "₹0"}</dd></>)}
              <dt className="text-slate-500">Account</dt><dd className="text-slate-800">{l.user_id ? "Signed up" : "No account yet"}</dd>
              {l.status_changed_at && (<><dt className="text-slate-500">Status changed</dt><dd className="text-slate-800">{formatDateTime(l.status_changed_at)}</dd></>)}
            </dl>
            {isAdmin && staff && staff.length > 0 && (
              <label className="mt-4 block text-sm">
                <span className="font-bold text-slate-800">Assigned to</span>
                <select value={l.assigned_to ?? ""} onChange={(e) => onAssign(e.target.value || null)} disabled={disabled} className="input mt-1 !py-1.5 text-sm">
                  <option value="">Not assigned</option>
                  {staff.map((m) => <option key={m.id} value={m.id}>{m.full_name || m.email}{m.role === "admin" ? " (admin)" : ""}</option>)}
                </select>
              </label>
            )}
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">Notes</p>
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (note.trim()) onNote(note, () => setNote(""));
              }}
            >
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} placeholder="e.g. Called — wants Vellore CSE, call after results" className="input !py-1.5 text-sm" aria-label="New note" />
              <button type="submit" disabled={disabled || !note.trim()} className="btn-primary !px-3 !py-1.5 text-sm disabled:opacity-50">Add</button>
            </form>
            {notes.length === 0 ? (
              <p className="mt-3 text-xs text-slate-400">No notes yet.</p>
            ) : (
              <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                {notes.map((n) => (
                  <li key={n.id} className="group flex items-start gap-2 rounded-xl bg-white p-2.5 text-sm ring-1 ring-slate-200">
                    <div className="min-w-0 flex-1">
                      <p className="whitespace-pre-line text-slate-800">{n.body}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{formatDateTime(n.created_at)}</p>
                    </div>
                    {(isAdmin || n.created_by === me) && (
                      <button type="button" onClick={() => onDeleteNote(n.id)} className="rounded p-1 text-slate-300 hover:text-red-600" aria-label="Delete note"><TrashIcon className="h-3.5 w-3.5" /></button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
