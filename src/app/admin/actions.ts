"use server";

// =====================================================================
//  ADMIN ACTIONS — every add / edit / delete in the admin panel.
//  Each action: (1) checks the role on the server — adminOrError() = admins only;
//               staffOrError() = admins AND counsellors (only the few staff actions),
//               (2) runs with the admin's own login, so Supabase RLS checks it again,
//               (3) refreshes the public website cache (updateTag) so changes show at once.
// =====================================================================
import { updateTag } from "next/cache";
import { adminOrError, friendlyDbError, isError, staffOrError, type ActionResult } from "@/lib/admin";
import { yearInIndia } from "@/lib/format";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { notifyBookingChanged, notifyBookingConfirmed, notifyMeetLinkReady, notifyPurchasePaid, sendKind } from "@/lib/email/notify";
import { disconnectCalendar, syncBookingCalendar } from "@/lib/google-calendar";

const fail = (error: string): ActionResult => ({ ok: false, error });
const dbResult = (error: { message: string } | null, message?: string): ActionResult =>
  error ? fail(friendlyDbError(error.message)) : { ok: true, message };

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
const int = (v: unknown) => (v === "" || v === null || v === undefined ? null : Math.round(Number(v)));
const isUrl = (s: string) => /^https?:\/\/\S+$/.test(s);

// ---------------------------------------------------------------- PRODUCTS
export type ProductInput = {
  id?: string;
  title: string;
  slug?: string;
  description?: string;
  category: "crash_course" | "study_material" | "previous_paper" | "mock_test";
  college?: string;
  price: number | string;
  original_price?: number | string | null;
  is_free: boolean;
  is_active: boolean;
  thumbnail_url?: string;
  file_path?: string;
  content_links: { title: string; url: string }[];
  details?: string; // JSON text (advanced)
  sort_order?: number | string;
};

export async function saveProduct(input: ProductInput): Promise<ActionResult<{ id: string }>> {
  const s = await adminOrError();
  if (isError(s)) return s;

  const title = input.title?.trim();
  if (!title) return fail("Please enter a title.");
  if (!["crash_course", "study_material", "previous_paper", "mock_test"].includes(input.category)) return fail("Please choose a category.");
  const price = input.is_free ? 0 : int(input.price);
  if (price === null || Number.isNaN(price) || price < 0) return fail("Please enter a valid price in rupees.");
  const original = int(input.original_price);
  if (original !== null && (Number.isNaN(original) || original < 0)) return fail("Original price must be a number.");
  const thumb = input.thumbnail_url?.trim() || null;
  if (thumb && !isUrl(thumb)) return fail("Thumbnail must be a full web address starting with https://");
  const links = (input.content_links ?? []).filter((l) => l.url?.trim());
  for (const l of links) if (!isUrl(l.url.trim())) return fail(`"${l.url}" is not a valid link. Links must start with https://`);

  let details: Record<string, unknown> | undefined;
  if (input.details !== undefined && input.details.trim() !== "") {
    try {
      const parsed = JSON.parse(input.details);
      if (typeof parsed !== "object" || Array.isArray(parsed) || parsed === null) return fail("Extra display info must be a JSON object { ... }.");
      details = parsed;
    } catch {
      return fail("Extra display info is not valid JSON. Check commas and quotes.");
    }
  }

  const row = {
    title,
    slug: slugify(input.slug?.trim() || title),
    description: input.description?.trim() || null,
    category: input.category,
    college: input.college?.trim() || null,
    price,
    original_price: original,
    is_free: input.is_free,
    is_active: input.is_active,
    thumbnail_url: thumb,
    // file_path is kept up to date by the Files section (file-actions.ts) — only set it if given
    ...(input.file_path !== undefined ? { file_path: input.file_path.trim() || null } : {}),
    content_links: links.map((l, i) => ({ title: l.title?.trim() || `Link ${i + 1}`, url: l.url.trim() })),
    sort_order: int(input.sort_order) ?? 0,
    ...(details ? { details } : {}),
  };
  if (!row.slug) return fail("Please enter a title with letters or numbers.");

  if (input.id) {
    const { error } = await s.supabase.from("products").update(row).eq("id", input.id);
    updateTag("products");
    return dbResult(error, "Product saved.");
  }
  const { data: created, error } = await s.supabase.from("products").insert(row).select("id").single();
  updateTag("products");
  if (error) return fail(friendlyDbError(error.message));
  return { ok: true, data: { id: created.id as string }, message: "Product added — now you can add its files below." };
}

export async function setProductFlag(id: string, field: "is_active" | "is_free", value: boolean): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  const patch = field === "is_free" && value ? { is_free: true, price: 0 } : { [field]: value };
  const { error } = await s.supabase.from("products").update(patch).eq("id", id);
  updateTag("products");
  return dbResult(error);
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  const { data: p } = await s.supabase.from("products").select("file_path").eq("id", id).maybeSingle();
  // all of its uploaded files (product_files) — removed from storage too
  const db = getAdminSupabase();
  const { data: files } = db ? await db.from("product_files").select("file_path").eq("product_id", id) : { data: [] };
  const { error } = await s.supabase.from("products").delete().eq("id", id);
  if (!error) {
    const paths = [...new Set([...(files ?? []).map((f) => f.file_path as string), ...(p?.file_path ? [p.file_path] : [])])];
    if (paths.length) await (db ?? s.supabase).storage.from("materials").remove(paths);
  }
  updateTag("products");
  return dbResult(error, "Product deleted.");
}

/** Private class links (admins can read them through this function) */
export async function loadProductLinks(id: string): Promise<ActionResult<{ title: string; url: string }[]>> {
  const s = await adminOrError();
  if (isError(s)) return s;
  const { data, error } = await s.supabase.rpc("get_product_content", { p_product_id: id });
  if (error) return fail(error.message);
  const list = Array.isArray(data) ? data : [];
  return {
    ok: true,
    data: list.map((x: unknown, i: number) =>
      typeof x === "string" ? { title: `Link ${i + 1}`, url: x } : { title: String((x as { title?: string }).title ?? ""), url: String((x as { url?: string }).url ?? "") },
    ),
  };
}

// ---------------------------------------------------------------- SLOTS
const TIME = /^\d{2}:\d{2}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function addSlot(input: { date: string; start: string; end: string; price: number | string }): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  if (!DATE.test(input.date) || !TIME.test(input.start) || !TIME.test(input.end)) return fail("Please fill date, start time and end time.");
  if (input.end <= input.start) return fail("End time must be after start time.");
  const price = int(input.price);
  if (price === null || price < 0) return fail("Please enter a valid price.");
  const { error } = await s.supabase.from("slots").insert({ date: input.date, start_time: input.start, end_time: input.end, price });
  updateTag("slots");
  return dbResult(error, "Slot added.");
}

export async function addSlotsBulk(input: {
  from: string;
  to: string;
  weekdays: number[]; // 1 = Monday … 7 = Sunday
  times: { start: string; end: string }[];
  price: number | string;
}): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  if (!DATE.test(input.from) || !DATE.test(input.to) || input.to < input.from) return fail("Please choose a valid date range.");
  const times = input.times.filter((t) => TIME.test(t.start) && TIME.test(t.end));
  if (times.length === 0) return fail("Add at least one time.");
  if (times.some((t) => t.end <= t.start)) return fail("Each end time must be after its start time.");
  if (input.weekdays.length === 0) return fail("Choose at least one day of the week.");
  const price = int(input.price);
  if (price === null || price < 0) return fail("Please enter a valid price.");

  const rows: { date: string; start_time: string; end_time: string; price: number }[] = [];
  const end = new Date(`${input.to}T00:00:00Z`);
  for (let d = new Date(`${input.from}T00:00:00Z`); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const isoDow = ((d.getUTCDay() + 6) % 7) + 1;
    if (!input.weekdays.includes(isoDow)) continue;
    const date = d.toISOString().slice(0, 10);
    for (const t of times) rows.push({ date, start_time: t.start, end_time: t.end, price });
  }
  if (rows.length === 0) return fail("No dates match the chosen days.");
  if (rows.length > 500) return fail(`That would create ${rows.length} slots. Please choose a shorter range (max 500).`);

  // Skips slots that already exist at the same date + start time
  const { error, count } = await s.supabase
    .from("slots")
    .upsert(rows, { onConflict: "date,start_time", ignoreDuplicates: true, count: "exact" });
  updateTag("slots");
  return dbResult(error, `${count ?? rows.length} slot(s) added (existing ones were skipped).`);
}

export async function setSlotAvailable(id: string, available: boolean): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  const { error } = await s.supabase.from("slots").update({ is_available: available }).eq("id", id);
  updateTag("slots");
  return dbResult(error);
}

export async function deleteSlot(id: string): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  const { error } = await s.supabase.from("slots").delete().eq("id", id);
  updateTag("slots");
  return dbResult(error, "Slot deleted.");
}

// ---------------------------------------------------------------- BOOKINGS
export async function updateBooking(
  id: string,
  patch: { status?: "pending" | "confirmed" | "cancelled" | "completed"; payment_status?: "unpaid" | "pending" | "paid" | "failed" | "refunded" },
): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  const { data: before } = await s.supabase.from("bookings").select("status,payment_status,invoice_number").eq("id", id).maybeSingle();
  const full: Record<string, unknown> = { ...patch };
  // Marked as paid by hand (offline payment) → invoice number + confirmed, like an online payment
  if (patch.payment_status === "paid" && before?.payment_status !== "paid") {
    if (!before?.invoice_number) full.invoice_number = await nextInvoiceNumber();
    full.paid_at = new Date().toISOString();
    if (!patch.status && before?.status === "pending") full.status = "confirmed";
  }
  const { error } = await s.supabase.from("bookings").update(full).eq("id", id);
  updateTag("slots"); // cancelling frees the slot
  if (!error && patch.status === "cancelled" && before?.status !== "cancelled") notifyBookingChanged(id, "cancelled");
  if (!error && patch.payment_status === "paid" && before?.payment_status !== "paid") notifyBookingConfirmed(id);
  // Other status changes (e.g. back to confirmed, or expired) → keep the calendar in step
  else if (!error && patch.status && patch.status !== before?.status && patch.status !== "cancelled" && patch.status !== "completed") {
    const r = await syncBookingCalendar(id);
    if (r.newLink) notifyMeetLinkReady(id);
  }
  return dbResult(error, patch.status === "cancelled" ? "Booking cancelled — the student has been emailed." : "Booking updated.");
}

/** Move a booking to another free slot; the student gets an email with the new time. */
export async function rescheduleBooking(id: string, newSlotId: string): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  const { error } = await s.supabase.rpc("reschedule_booking", { p_booking: id, p_new_slot: newSlotId });
  updateTag("slots");
  if (error) return fail(/function/i.test(error.message) && /find/i.test(error.message) ? "Run supabase/emails-invoices.sql in Supabase first." : error.message);
  notifyBookingChanged(id, "rescheduled");
  return { ok: true, message: "Booking moved — the student has been emailed the new time." };
}

// ---------------------------------------------------------------- GOOGLE MEET
/** Admin pastes a Meet (or Zoom) link by hand → saved and emailed to the student. Empty = remove. */
export async function setMeetLink(id: string, link: string): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  const url = link.trim();
  if (url && (!/^https:\/\/\S+$/.test(url) || url.length > 300)) return fail("Please paste the full link, starting with https:// (for example https://meet.google.com/abc-defg-hij).");
  const { data: b } = await s.supabase.from("bookings").select("status,meet_link").eq("id", id).maybeSingle();
  if (!b) return fail("Booking not found.");
  const { error } = await s.supabase
    .from("bookings")
    .update(url ? { meet_link: url, calendar_status: "manual", calendar_error: null } : { meet_link: null, calendar_status: null })
    .eq("id", id);
  if (error) return fail(/meet_link|calendar_status/.test(error.message) ? "Run supabase/google-calendar.sql in Supabase first." : friendlyDbError(error.message));
  if (url && url !== b.meet_link && b.status === "confirmed") {
    notifyMeetLinkReady(id);
    return { ok: true, message: "Meet link saved — the student has been emailed." };
  }
  return { ok: true, message: url ? "Meet link saved." : "Meet link removed." };
}

/** "Try Google Calendar again" for one booking. */
export async function retryBookingCalendar(id: string): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  const r = await syncBookingCalendar(id);
  if (r.result === "setup_missing") return fail("Run supabase/google-calendar.sql in Supabase first.");
  if (r.result === "not_connected") return fail("Google Calendar is not connected. Connect it in Admin → Settings, or paste a Meet link by hand.");
  if (r.result === "failed") return fail("Google Calendar did not respond. Please paste a Meet link by hand, or try again later.");
  if (r.newLink) notifyMeetLinkReady(id);
  return { ok: true, message: r.newLink ? "Meet link created — the student has been emailed." : "Calendar is up to date." };
}

export async function disconnectGoogleCalendar(): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  await disconnectCalendar();
  await s.supabase.rpc("log_admin_event", { p_action: "google_calendar.disconnect", p_summary: "Disconnected Google Calendar", p_details: {} }).then(() => undefined, () => undefined);
  return { ok: true, message: "Google Calendar disconnected. New bookings will show \"Meet link will be shared soon\"." };
}

// ---------------------------------------------------------------- EMAIL LOGS
/** Rebuild an email from the database and send it again. */
export async function resendEmail(logId: string): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  const db = getAdminSupabase();
  if (!db) return fail("Server key missing.");
  const { data: log } = await db.from("email_logs").select("kind,ref_id").eq("id", logId).maybeSingle();
  if (!log?.ref_id) return fail("Email not found.");
  const ok = await sendKind(log.kind as string, log.ref_id as string, logId);
  return ok ? { ok: true, message: "Email sent." } : fail("Could not send — see the error in the list.");
}

// ---------------------------------------------------------------- ENQUIRIES
export async function updateEnquiryStatus(id: string, status: "new" | "contacted" | "converted"): Promise<ActionResult> {
  if (!["new", "contacted", "converted"].includes(status)) return fail("Unknown status.");
  const s = await staffOrError(); // counsellors too (status only — checked in Supabase)
  if (isError(s)) return s;
  const { error } = await s.supabase.from("enquiries").update({ status }).eq("id", id);
  return dbResult(error, `Marked as ${status}.`);
}

export async function deleteEnquiry(id: string): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  const { error } = await s.supabase.from("enquiries").delete().eq("id", id);
  return dbResult(error, "Enquiry deleted.");
}

// ---------------------------------------------------------------- TESTS & QUESTIONS
export type TestInput = { id?: string; title: string; type: "mock" | "mcq"; duration_minutes: number | string; is_free: boolean; is_active: boolean; product_id?: string | null };

export async function saveTest(input: TestInput): Promise<ActionResult<{ id: string }>> {
  const s = await adminOrError();
  if (isError(s)) return s;
  const title = input.title?.trim();
  if (!title) return fail("Please enter a test title.");
  if (!["mock", "mcq"].includes(input.type)) return fail("Type must be Mock or MCQ.");
  const duration = int(input.duration_minutes);
  if (!duration || duration < 1 || duration > 600) return fail("Duration must be between 1 and 600 minutes.");
  if (!input.is_free && !input.product_id) return fail("A paid test must be linked to a product (so buyers can open it). Or tick Free.");

  const row = { title, type: input.type, duration_minutes: duration, is_free: input.is_free, is_active: input.is_active, product_id: input.product_id || null };
  if (input.id) {
    const { error } = await s.supabase.from("tests").update(row).eq("id", input.id);
    updateTag("products");
    return error ? fail(friendlyDbError(error.message)) : { ok: true, data: { id: input.id }, message: "Test saved." };
  }
  const { data, error } = await s.supabase.from("tests").insert(row).select("id").single();
  updateTag("products");
  return error ? fail(friendlyDbError(error.message)) : { ok: true, data: { id: data.id as string }, message: "Test created." };
}

export async function deleteTest(id: string): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  const { error } = await s.supabase.from("tests").delete().eq("id", id);
  updateTag("products");
  return dbResult(error, "Test deleted (with its questions and attempts).");
}

export type QuestionInput = { id?: string; test_id: string; question: string; options: string[]; correct_option: number; explanation?: string; marks: number | string; sort_order?: number };

function validateQuestion(q: QuestionInput): string | null {
  if (!q.question?.trim()) return "Question text is empty.";
  if (!Array.isArray(q.options) || q.options.length !== 4 || q.options.some((o) => !String(o ?? "").trim())) return "All 4 options must be filled.";
  if (![0, 1, 2, 3].includes(Number(q.correct_option))) return "Correct answer must be A, B, C or D.";
  const marks = int(q.marks);
  if (!marks || marks < 1) return "Marks must be 1 or more.";
  return null;
}

const questionRow = (q: QuestionInput) => ({
  test_id: q.test_id,
  question: q.question.trim(),
  options: q.options.map((o) => String(o).trim()),
  correct_option: Number(q.correct_option),
  explanation: q.explanation?.trim() || null,
  marks: int(q.marks) ?? 1,
  sort_order: q.sort_order ?? 0,
});

export async function saveQuestion(q: QuestionInput): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  const problem = validateQuestion(q);
  if (problem) return fail(problem);
  const row = questionRow(q);
  const { error } = q.id
    ? await s.supabase.from("questions").update(row).eq("id", q.id)
    : await s.supabase.from("questions").insert(row);
  updateTag("products");
  return dbResult(error, q.id ? "Question saved." : "Question added.");
}

export async function deleteQuestion(id: string): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  const { error } = await s.supabase.from("questions").delete().eq("id", id);
  updateTag("products");
  return dbResult(error, "Question deleted.");
}

/** Bulk add from CSV. Either ALL rows are added, or none (with a list of problems). */
export async function bulkAddQuestions(testId: string, rows: QuestionInput[]): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  if (rows.length === 0) return fail("The CSV file has no questions.");
  if (rows.length > 1000) return fail("Please upload at most 1000 questions at a time.");
  const problems = rows.map((r, i) => [i, validateQuestion({ ...r, test_id: testId })] as const).filter(([, p]) => p);
  if (problems.length) return fail(problems.slice(0, 8).map(([i, p]) => `Row ${i + 2}: ${p}`).join("\n") + (problems.length > 8 ? `\n…and ${problems.length - 8} more` : ""));

  const { data: last } = await s.supabase.from("questions").select("sort_order").eq("test_id", testId).order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const start = (last?.sort_order ?? 0) + 1;
  const { error } = await s.supabase.from("questions").insert(rows.map((r, i) => questionRow({ ...r, test_id: testId, sort_order: start + i })));
  updateTag("products");
  return dbResult(error, `${rows.length} question(s) added.`);
}

// ---------------------------------------------------------------- REVIEWS
export type ReviewInput = { id?: string; name: string; type: "student" | "parent"; rating: number | string; comment: string; photo_url?: string; is_approved: boolean };

export async function saveReview(r: ReviewInput): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  if (!r.name?.trim()) return fail("Please enter a name.");
  if (!r.comment?.trim()) return fail("Please enter the review text.");
  const rating = int(r.rating);
  if (!rating || rating < 1 || rating > 5) return fail("Rating must be from 1 to 5.");
  const photo = r.photo_url?.trim() || null;
  if (photo && !isUrl(photo)) return fail("Photo must be a full web address starting with https://");
  const row = { name: r.name.trim(), type: r.type === "parent" ? "parent" : "student", rating, comment: r.comment.trim(), photo_url: photo, is_approved: r.is_approved };
  const { error } = r.id ? await s.supabase.from("reviews").update(row).eq("id", r.id) : await s.supabase.from("reviews").insert(row);
  updateTag("reviews");
  return dbResult(error, r.id ? "Review saved." : "Review added.");
}

export async function setReviewApproved(id: string, approved: boolean): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  const { error } = await s.supabase.from("reviews").update({ is_approved: approved }).eq("id", id);
  updateTag("reviews");
  return dbResult(error);
}

// ---------------------------------------------------------------- LEADS (CRM)
const LEAD_STATUSES = ["new", "contacted", "interested", "paid", "not_interested"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

/** Change a lead's status and/or follow-up date ("" = no follow-up). */
export async function updateLead(id: string, patch: { status?: LeadStatus; follow_up_on?: string | null }): Promise<ActionResult> {
  const s = await staffOrError(); // counsellors too
  if (isError(s)) return s;
  const row: Record<string, unknown> = {};
  if (patch.status !== undefined) {
    if (!LEAD_STATUSES.includes(patch.status)) return fail("Unknown status.");
    row.status = patch.status;
  }
  if (patch.follow_up_on !== undefined) {
    const d = patch.follow_up_on || null;
    if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) return fail("Please choose a valid date.");
    row.follow_up_on = d;
  }
  const { error } = await s.supabase.from("leads").update(row).eq("id", id);
  return dbResult(error, patch.follow_up_on !== undefined ? (patch.follow_up_on ? "Follow-up date saved." : "Follow-up removed.") : "Status updated.");
}

export async function addLeadNote(leadId: string, body: string): Promise<ActionResult> {
  const s = await staffOrError(); // counsellors too
  if (isError(s)) return s;
  const text = body.trim();
  if (!text) return fail("Please write a note.");
  if (text.length > 2000) return fail("Please keep the note under 2000 characters.");
  const { error } = await s.supabase.from("lead_notes").insert({ lead_id: leadId, body: text });
  return dbResult(error, "Note added.");
}

export async function deleteLeadNote(noteId: string): Promise<ActionResult> {
  const s = await staffOrError(); // counsellors: only their own notes (Supabase rule)
  if (isError(s)) return s;
  const { data, error } = await s.supabase.from("lead_notes").delete().eq("id", noteId).select("id");
  if (!error && !data?.length) return fail("You can only delete your own notes.");
  return dbResult(error, "Note deleted.");
}

/** Admins only: give a lead to a counsellor (null = nobody). */
export async function assignLead(id: string, staffId: string | null): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  const { error } = await s.supabase.from("leads").update({ assigned_to: staffId || null }).eq("id", id);
  if (error && /assigned_to/.test(error.message) && /column/.test(error.message)) return fail("Run supabase/counsellor.sql in Supabase first.");
  return dbResult(error, staffId ? "Lead assigned." : "Lead unassigned.");
}

// ---------------------------------------------------------------- STAFF: BOOKINGS
/** Admins only: give a booking to a counsellor (null = nobody). */
export async function assignBooking(id: string, staffId: string | null): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  const { error } = await s.supabase.from("bookings").update({ assigned_to: staffId || null }).eq("id", id);
  if (error && /assigned_to/.test(error.message) && /column/.test(error.message)) return fail("Run supabase/counsellor.sql in Supabase first.");
  return dbResult(error, staffId ? "Booking assigned." : "Booking unassigned.");
}

/** Admins + counsellors: the session took place. */
export async function staffCompleteBooking(id: string): Promise<ActionResult> {
  const s = await staffOrError();
  if (isError(s)) return s;
  const { error } = await s.supabase.rpc("staff_complete_booking", { p_booking: id });
  updateTag("slots");
  if (error) return fail(/function/i.test(error.message) && /find/i.test(error.message) ? "Run supabase/counsellor.sql in Supabase first." : error.message);
  return { ok: true, message: "Marked as completed — the student gets the feedback email 1 hour after the session ends." };
}

export async function addBookingNote(bookingId: string, body: string): Promise<ActionResult> {
  const s = await staffOrError();
  if (isError(s)) return s;
  const text = body.trim();
  if (!text) return fail("Please write a note.");
  if (text.length > 2000) return fail("Please keep the note under 2000 characters.");
  const { error } = await s.supabase.from("booking_notes").insert({ booking_id: bookingId, body: text });
  if (error && /booking_notes/.test(error.message)) return fail("Run supabase/counsellor.sql in Supabase first.");
  return dbResult(error, "Note added.");
}

export async function deleteBookingNote(noteId: string): Promise<ActionResult> {
  const s = await staffOrError();
  if (isError(s)) return s;
  const { data, error } = await s.supabase.from("booking_notes").delete().eq("id", noteId).select("id");
  if (!error && !data?.length) return fail("You can only delete your own notes.");
  return dbResult(error, "Note deleted.");
}

// ---------------------------------------------------------------- SESSION FEEDBACK
/** "Publish as review" — only works when the student ticked the permission box (checked in Supabase too). */
export async function publishFeedbackAsReview(feedbackId: string, shownName?: string): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  const { error } = await s.supabase.rpc("publish_feedback_as_review", { p_feedback: feedbackId, p_name: shownName?.trim() || null });
  updateTag("reviews");
  if (error) return fail(/function/i.test(error.message) && /find/i.test(error.message) ? "Run supabase/feedback.sql in Supabase first." : error.message);
  return { ok: true, message: "Published — it now shows on the Reviews page of the website (manage it in Admin → Reviews)." };
}

export async function deleteFeedback(feedbackId: string): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  const { error } = await s.supabase.from("session_feedback").delete().eq("id", feedbackId);
  return dbResult(error, "Feedback deleted.");
}

export async function deleteReview(id: string): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  const { error } = await s.supabase.from("reviews").delete().eq("id", id);
  updateTag("reviews");
  return dbResult(error, "Review deleted.");
}

// ---------------------------------------------------------------- SETTINGS
/** "Our results" numbers. Empty number = hidden on the website. */
export async function saveSiteStats(rows: { id?: string; label: string; value: string; suffix: string }[]): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  if (rows.length > 8) return fail("Please keep it to 8 stats or fewer.");
  for (const r of rows) {
    if (!r.label.trim()) return fail("Every stat needs a label (or remove it).");
    if (r.value.trim() && !/^\d{1,9}$/.test(r.value.trim())) return fail(`"${r.label}": the number must be digits only.`);
  }
  const { data: existing } = await s.supabase.from("site_stats").select("id");
  const keep = new Set(rows.filter((r) => r.id).map((r) => r.id));
  const remove = (existing ?? []).map((e) => e.id as string).filter((id) => !keep.has(id));
  if (remove.length) {
    const { error } = await s.supabase.from("site_stats").delete().in("id", remove);
    if (error) return fail(friendlyDbError(error.message));
  }
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const row = { label: r.label.trim().slice(0, 60), value: r.value.trim() ? Number(r.value.trim()) : null, suffix: r.suffix.trim().slice(0, 5), sort_order: i, updated_at: new Date().toISOString() };
    const { error } = r.id ? await s.supabase.from("site_stats").update(row).eq("id", r.id) : await s.supabase.from("site_stats").insert(row);
    if (error) return fail(friendlyDbError(error.message));
  }
  updateTag("settings"); // Home + About update immediately
  return { ok: true, message: "Saved — the website shows the new numbers now." };
}

// ---------------------------------------------------------------- STUDENTS
export async function setUserRole(userId: string, role: "admin" | "counsellor" | "student" | "parent"): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  if (!["admin", "counsellor", "student", "parent"].includes(role)) return fail("Unknown role.");
  if (userId === s.user.id) return fail("You can't change your own role (so you don't lock yourself out).");
  const { error } = await s.supabase.from("profiles").update({ role }).eq("id", userId);
  if (error && /profiles_role_check/.test(error.message)) return fail("Run supabase/counsellor.sql in Supabase first.");
  if (!error) {
    // Staff accounts aren't leads; un-assign work from someone who is no longer staff
    const db = getAdminSupabase();
    if (db && (role === "admin" || role === "counsellor")) await db.from("leads").delete().eq("user_id", userId);
    if (db && role !== "admin" && role !== "counsellor") {
      await db.from("leads").update({ assigned_to: null }).eq("assigned_to", userId);
      await db.from("bookings").update({ assigned_to: null }).eq("assigned_to", userId);
    }
  }
  return dbResult(
    error,
    role === "admin" ? "User is now an admin." : role === "counsellor" ? "User is now a counsellor. They must set up 2-step login when they open the staff panel." : `Role changed to ${role}.`,
  );
}

/** Predictor access by hand: "give" / "remove" override, or "auto" (paid counselling decides). */
export async function setPredictorAccess(userId: string, mode: "auto" | "give" | "remove"): Promise<ActionResult> {
  if (!["auto", "give", "remove"].includes(mode)) return fail("Unknown option.");
  const s = await adminOrError();
  if (isError(s)) return s;
  const { error } =
    mode === "auto"
      ? await s.supabase.from("predictor_access_overrides").delete().eq("user_id", userId)
      : await s.supabase
          .from("predictor_access_overrides")
          .upsert({ user_id: userId, has_access: mode === "give", updated_by: s.user.id, updated_at: new Date().toISOString() });
  return dbResult(error, mode === "give" ? "Predictor access given." : mode === "remove" ? "Predictor access removed." : "Back to automatic (paid counselling).");
}

// ---------------------------------------------------------------- PAYMENTS
/**
 * Record a refund. The student loses access to the item and it stops
 * counting in revenue. (Send the money back in Razorpay Dashboard → Payments → Refund.)
 */
export async function markPurchaseRefunded(id: string, note: string): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  const { data: p } = await s.supabase.from("purchases").select("status").eq("id", id).maybeSingle();
  if (!p) return fail("Payment not found.");
  if (p.status !== "paid") return fail("Only paid payments can be marked as refunded.");
  const { error } = await s.supabase
    .from("purchases")
    .update({ status: "refunded", refunded_at: new Date().toISOString(), refund_note: note.trim().slice(0, 300) || null, refunded_by: s.user.id })
    .eq("id", id)
    .eq("status", "paid");
  if (error) return fail(/status_check|refunded_at|refund_note/.test(error.message) ? "Run supabase/refunds.sql in Supabase first." : friendlyDbError(error.message));
  return { ok: true, message: "Marked as refunded — the student no longer has access. Remember to refund the money in Razorpay." };
}

/** Invoice numbers like EDU-2026-0001 (same series as Razorpay payments). */
async function nextInvoiceNumber(): Promise<string> {
  const admin = getAdminSupabase();
  const { data } = admin ? await admin.rpc("next_invoice_number") : { data: null };
  // fallback if supabase/payments.sql hasn't been run yet
  return typeof data === "string" ? data : `EDU-${yearInIndia()}-M${Date.now().toString(36).toUpperCase()}`;
}

/** Record a payment by hand (until Razorpay is connected). */
export async function recordPurchase(input: { user_id: string; product_id: string; amount: number | string; status: "paid" | "failed" }): Promise<ActionResult> {
  if (!["paid", "failed"].includes(input.status)) return fail("Choose Paid or Failed.");
  const s = await adminOrError();
  if (isError(s)) return s;
  if (!input.user_id || !input.product_id) return fail("Choose a student and a product.");
  const amount = int(input.amount);
  if (amount === null || amount < 0) return fail("Enter a valid amount.");
  const invoice = input.status === "paid" ? await nextInvoiceNumber() : null;
  const { data: row, error } = await s.supabase
    .from("purchases")
    .insert({ user_id: input.user_id, product_id: input.product_id, amount, status: input.status, invoice_number: invoice, paid_at: input.status === "paid" ? new Date().toISOString() : null })
    .select("id")
    .single();
  if (!error && row && input.status === "paid") notifyPurchasePaid(row.id);
  return dbResult(error, "Payment recorded.");
}

export async function setPurchaseStatus(id: string, status: "paid" | "failed"): Promise<ActionResult> {
  if (!["paid", "failed"].includes(status)) return fail("Unknown status.");
  const s = await adminOrError();
  if (isError(s)) return s;
  const patch: Record<string, unknown> = { status };
  if (status === "paid") {
    const { data: cur } = await s.supabase.from("purchases").select("invoice_number").eq("id", id).maybeSingle();
    if (!cur?.invoice_number) patch.invoice_number = await nextInvoiceNumber();
    patch.paid_at = new Date().toISOString();
  }
  const { error } = await s.supabase.from("purchases").update(patch).eq("id", id);
  if (!error && status === "paid") notifyPurchasePaid(id);
  return dbResult(error, "Payment updated.");
}

// ---------------------------------------------------------------- COUNSELLING PACKAGES
// A package is a product with category "counselling_package" (supabase/packages.sql).
export type PackageInput = {
  id?: string;
  title: string;
  description?: string;
  tagline?: string;
  price: number | string;
  original_price?: number | string | null;
  sessions?: number | string | null; // ignored when unlimited
  unlimited: boolean;
  features: string; // one per line
  popular: boolean;
  is_active: boolean;
  sort_order?: number | string;
};

export async function savePackage(input: PackageInput): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  const title = input.title?.trim();
  if (!title) return fail("Please enter a package name.");
  const price = int(input.price);
  if (price === null || Number.isNaN(price) || price < 1) return fail("Please enter a price in rupees (at least ₹1).");
  const original = int(input.original_price);
  if (original !== null && (Number.isNaN(original) || original <= price)) return fail("The strike-through price must be higher than the price (or leave it empty).");
  const sessions = input.unlimited ? null : int(input.sessions);
  if (!input.unlimited && (sessions === null || Number.isNaN(sessions) || sessions < 1 || sessions > 100)) return fail("Sessions must be a number from 1 to 100 (or tick Unlimited).");
  const features = input.features.split("\n").map((f) => f.trim()).filter(Boolean).slice(0, 12);

  const details = { tagline: input.tagline?.trim() || undefined, popular: input.popular || undefined, features };
  const row = {
    title,
    description: input.description?.trim() || null,
    category: "counselling_package",
    price,
    original_price: original,
    is_free: false,
    is_active: input.is_active,
    sort_order: int(input.sort_order) ?? 0,
    package_sessions: sessions,
    package_unlimited: input.unlimited,
    details,
  };

  // Only ONE package can be "Most Popular"
  if (input.popular) {
    const { data: others } = await s.supabase.from("products").select("id,details").eq("category", "counselling_package");
    for (const o of (others ?? []) as { id: string; details: Record<string, unknown> }[]) {
      if (o.id !== input.id && o.details?.popular) await s.supabase.from("products").update({ details: { ...o.details, popular: false } }).eq("id", o.id);
    }
  }

  const res = input.id
    ? await s.supabase.from("products").update(row).eq("id", input.id)
    : await s.supabase.from("products").insert({ ...row, slug: `package-${slugify(title)}-${Date.now().toString(36)}` });
  updateTag("products");
  if (res.error && /package_sessions|package_unlimited|products_category_check/.test(res.error.message)) return fail("Run supabase/packages.sql in Supabase first.");
  return dbResult(res.error, input.id ? "Package saved." : "Package added.");
}

/** Add or remove session credits for a student (e.g. +1 bonus, −1 correction). */
export async function adjustSessionCredits(userId: string, delta: number, note: string): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  const d = Math.round(Number(delta));
  if (!Number.isFinite(d) || d === 0 || Math.abs(d) > 100) return fail("Enter a number like 2 (add) or -1 (remove).");
  const { error } = await s.supabase
    .from("session_credit_adjustments")
    .insert({ user_id: userId, delta: d, note: note.trim().slice(0, 300) || null, created_by: s.user.id });
  if (error && /session_credit_adjustments/.test(error.message)) return fail("Run supabase/packages.sql in Supabase first.");
  return dbResult(error, `${d > 0 ? "Added" : "Removed"} ${Math.abs(d)} session credit${Math.abs(d) === 1 ? "" : "s"}.`);
}

// ---------------------------------------------------------------- COUPONS (supabase/coupons-referrals.sql)
export type CouponInput = {
  id?: string;
  code: string;
  description?: string;
  discount_type: "percent" | "flat";
  discount_value: number | string;
  max_discount?: number | string | null;
  min_amount?: number | string | null;
  applies_to: "all" | "selected";
  product_ids: string[];
  include_slots: boolean;
  starts_at?: string | null; // "YYYY-MM-DD" (IST)
  ends_at?: string | null;
  max_uses?: number | string | null;
  once_per_student: boolean;
  is_active: boolean;
};
const setupCoupons = (m: string) => /coupons|coupon_redemptions|referral_settings/.test(m) && /does not exist|schema cache|relation/.test(m);

export async function saveCoupon(input: CouponInput): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  const code = input.code.trim().toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) return fail("Code: 3–30 letters, numbers, - or _ (no spaces).");
  const value = int(input.discount_value);
  if (value === null || Number.isNaN(value) || value < 1) return fail("Enter the discount amount.");
  if (input.discount_type === "percent" && value > 100) return fail("A percentage can't be more than 100.");
  const maxDiscount = input.discount_type === "percent" ? int(input.max_discount) : null;
  const minAmount = int(input.min_amount) ?? 0;
  const maxUses = int(input.max_uses);
  if ([maxDiscount, maxUses].some((n) => n !== null && (Number.isNaN(n) || n < 1)) || Number.isNaN(minAmount) || minAmount < 0) return fail("Check the numbers (they must be positive).");
  if (input.applies_to === "selected" && input.product_ids.length === 0 && !input.include_slots) return fail("Choose at least one product, package or single slots.");
  // dates are whole days in India time: from 00:00 of the start day to 23:59 of the end day
  const starts = input.starts_at ? new Date(`${input.starts_at}T00:00:00+05:30`).toISOString() : null;
  const ends = input.ends_at ? new Date(`${input.ends_at}T23:59:59+05:30`).toISOString() : null;
  if (starts && ends && ends < starts) return fail("The end date is before the start date.");

  const row = {
    code,
    description: input.description?.trim().slice(0, 200) || null,
    discount_type: input.discount_type,
    discount_value: value,
    max_discount: maxDiscount,
    min_amount: minAmount,
    applies_to: input.applies_to,
    product_ids: input.applies_to === "selected" ? input.product_ids : [],
    include_slots: input.include_slots,
    starts_at: starts,
    ends_at: ends,
    max_uses: maxUses,
    once_per_student: input.once_per_student,
    is_active: input.is_active,
  };
  const res = input.id ? await s.supabase.from("coupons").update(row).eq("id", input.id) : await s.supabase.from("coupons").insert(row);
  if (res.error && setupCoupons(res.error.message)) return fail("Run supabase/coupons-referrals.sql in Supabase first.");
  if (res.error && /duplicate|unique/i.test(res.error.message)) return fail(`The code ${code} already exists.`);
  return dbResult(res.error, input.id ? "Coupon saved." : `Coupon ${code} created.`);
}

export async function setCouponActive(id: string, active: boolean): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  const { error } = await s.supabase.from("coupons").update({ is_active: active }).eq("id", id);
  return dbResult(error, active ? "Coupon activated." : "Coupon deactivated.");
}

/** Delete only coupons that were never used (used ones stay for the records — deactivate them instead). */
export async function deleteCoupon(id: string): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  const { count } = await s.supabase.from("coupon_redemptions").select("id", { count: "exact", head: true }).eq("coupon_id", id).eq("status", "used");
  if ((count ?? 0) > 0) return fail("This coupon has been used, so it is kept for your records. Deactivate it instead.");
  const { error } = await s.supabase.from("coupons").delete().eq("id", id);
  return dbResult(error, "Coupon deleted.");
}

// ---------------------------------------------------------------- REFERRAL SETTINGS
export async function saveReferralSettings(input: { enabled: boolean; referred_discount: number | string; referrer_reward: number | string }): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  const off = int(input.referred_discount);
  const reward = int(input.referrer_reward);
  if ([off, reward].some((n) => n === null || Number.isNaN(n) || n < 0 || n > 10000)) return fail("Amounts must be between ₹0 and ₹10,000.");
  const { error } = await s.supabase
    .from("referral_settings")
    .update({ enabled: input.enabled, referred_discount: off, referrer_reward: reward, updated_at: new Date().toISOString() })
    .eq("id", 1);
  updateTag("referral-settings");
  if (error && setupCoupons(error.message)) return fail("Run supabase/coupons-referrals.sql in Supabase first.");
  return dbResult(error, "Referral settings saved. New referrals use these amounts.");
}

// ---------------------------------------------------------------- IMPORTANT DATES & UPDATES (supabase/important-dates.sql)
const DATE_CATEGORIES = ["application", "exam", "admit_card", "result", "counselling", "fees", "other"] as const;
const isDay = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
const needDatesSql = (m: string) => /important_dates|site_updates/.test(m) && /does not exist|schema cache|relation/.test(m);

export type ImportantDateInput = {
  id?: string; title: string; category: (typeof DATE_CATEGORIES)[number]; start_date: string; end_date?: string | null;
  description?: string; official_link?: string; is_published: boolean;
};

export async function saveImportantDate(input: ImportantDateInput): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  const title = input.title.trim();
  if (title.length < 2) return fail("Please enter a title.");
  if (!DATE_CATEGORIES.includes(input.category)) return fail("Please choose a type.");
  if (!isDay(input.start_date)) return fail("Please choose the start date.");
  const end = input.end_date && isDay(input.end_date) ? input.end_date : null;
  if (end && end < input.start_date) return fail("The end date is before the start date.");
  const link = input.official_link?.trim() || null;
  if (link && !isUrl(link)) return fail("The official link must start with https://");
  const row = {
    title: title.slice(0, 150),
    category: input.category,
    start_date: input.start_date,
    end_date: end && end !== input.start_date ? end : null,
    description: input.description?.trim().slice(0, 600) || null,
    official_link: link,
    is_published: input.is_published,
    is_sample: false, // anything saved by the admin is real
    updated_at: new Date().toISOString(),
  };
  let res;
  if (input.id) {
    res = await s.supabase.from("important_dates").update(row).eq("id", input.id);
  } else {
    // new events go to the end of the list
    const { data: last } = await s.supabase.from("important_dates").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
    res = await s.supabase.from("important_dates").insert({ ...row, sort_order: ((last?.sort_order as number | undefined) ?? 0) + 1 });
  }
  updateTag("important-dates");
  if (res.error && needDatesSql(res.error.message)) return fail("Run supabase/important-dates.sql in Supabase first.");
  return dbResult(res.error, input.id ? "Event saved." : "Event added.");
}

export async function deleteImportantDate(id: string): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  const { error } = await s.supabase.from("important_dates").delete().eq("id", id);
  updateTag("important-dates");
  return dbResult(error, "Event deleted.");
}

/** Move an event one place up or down (renumbers the list 1, 2, 3…). */
export async function moveImportantDate(id: string, dir: -1 | 1): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  const { data, error } = await s.supabase.from("important_dates").select("id").order("sort_order").order("start_date");
  if (error) return fail(friendlyDbError(error.message));
  const ids = (data ?? []).map((r) => r.id as string);
  const i = ids.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return { ok: true };
  [ids[i], ids[j]] = [ids[j], ids[i]];
  const results = await Promise.all(ids.map((x, n) => s.supabase.from("important_dates").update({ sort_order: n + 1 }).eq("id", x)));
  updateTag("important-dates");
  return dbResult(results.find((r) => r.error)?.error ?? null);
}

/** Put the whole list in date order (earliest first). */
export async function sortImportantDatesByDate(): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  const { data, error } = await s.supabase.from("important_dates").select("id").order("start_date").order("end_date", { nullsFirst: true });
  if (error) return fail(friendlyDbError(error.message));
  const results = await Promise.all((data ?? []).map((r, n) => s.supabase.from("important_dates").update({ sort_order: n + 1 }).eq("id", r.id)));
  updateTag("important-dates");
  return dbResult(results.find((r) => r.error)?.error ?? null, "Sorted by date.");
}

export type SiteUpdateInput = { id?: string; title: string; body?: string; link?: string; is_pinned: boolean; is_published: boolean; published_on?: string };

export async function saveSiteUpdate(input: SiteUpdateInput): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  const title = input.title.trim();
  if (title.length < 2) return fail("Please enter a title.");
  const link = input.link?.trim() || null;
  if (link && !isUrl(link)) return fail("The link must start with https://");
  const row = {
    title: title.slice(0, 150),
    body: input.body?.trim().slice(0, 1000) || null,
    link,
    is_pinned: input.is_pinned,
    is_published: input.is_published,
    // optional date (India time) — a future date shows the post from that day
    ...(input.published_on && isDay(input.published_on) ? { published_at: new Date(`${input.published_on}T09:00:00+05:30`).toISOString() } : {}),
  };
  const res = input.id ? await s.supabase.from("site_updates").update(row).eq("id", input.id) : await s.supabase.from("site_updates").insert(row);
  updateTag("important-dates");
  if (res.error && needDatesSql(res.error.message)) return fail("Run supabase/important-dates.sql in Supabase first.");
  return dbResult(res.error, input.id ? "Update saved." : "Update posted.");
}

export async function deleteSiteUpdate(id: string): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  const { error } = await s.supabase.from("site_updates").delete().eq("id", id);
  updateTag("important-dates");
  return dbResult(error, "Update deleted.");
}

// ---------------------------------------------------------------- VIDEO TESTIMONIALS (supabase/video-testimonials.sql)
export type VideoInput = {
  id?: string; youtube: string; student_name: string; achievement?: string; year?: number | string | null;
  consent_confirmed: boolean; is_published: boolean; sort_order?: number | string;
};

export async function saveVideoTestimonial(input: VideoInput): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  const { youtubeId } = await import("@/lib/youtube");
  const vid = youtubeId(input.youtube);
  if (!vid) return fail("Please paste a valid YouTube link (e.g. https://youtu.be/… or https://www.youtube.com/watch?v=…).");
  const name = input.student_name.trim();
  if (name.length < 2) return fail("Please enter the student's name.");
  const year = int(input.year);
  if (year !== null && (Number.isNaN(year) || year < 2000 || year > 2100)) return fail("Please enter a valid year, e.g. 2025.");
  if (input.is_published && !input.consent_confirmed) return fail("Tick the consent box before showing this video on the website.");

  // keep the original consent time when editing
  let consentAt: string | null = null;
  if (input.consent_confirmed && input.id) {
    const { data: old } = await s.supabase.from("video_testimonials").select("consent_confirmed,consent_at").eq("id", input.id).maybeSingle();
    consentAt = old?.consent_confirmed ? (old.consent_at as string | null) : null;
  }
  const row = {
    youtube_id: vid,
    student_name: name.slice(0, 80),
    achievement: input.achievement?.trim().slice(0, 120) || null,
    year,
    consent_confirmed: input.consent_confirmed,
    consent_at: input.consent_confirmed ? consentAt ?? new Date().toISOString() : null,
    consent_by: input.consent_confirmed ? s.user.id : null,
    is_published: input.is_published && input.consent_confirmed,
    sort_order: int(input.sort_order) ?? 0,
  };
  const res = input.id ? await s.supabase.from("video_testimonials").update(row).eq("id", input.id) : await s.supabase.from("video_testimonials").insert(row);
  updateTag("reviews");
  if (res.error && /video_testimonials/.test(res.error.message)) return fail("Run supabase/video-testimonials.sql in Supabase first.");
  return dbResult(res.error, input.id ? "Video saved." : "Video added.");
}

export async function setVideoPublished(id: string, value: boolean): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  const { error } = await s.supabase.from("video_testimonials").update({ is_published: value }).eq("id", id);
  updateTag("reviews");
  if (error && /check/i.test(error.message)) return fail("Confirm the student's consent first (Edit → consent box).");
  return dbResult(error);
}

export async function deleteVideoTestimonial(id: string): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  const { error } = await s.supabase.from("video_testimonials").delete().eq("id", id);
  updateTag("reviews");
  return dbResult(error, "Video deleted.");
}

// ---------------------------------------------------------------- WHATSAPP COMMUNITY (supabase/whatsapp-community.sql)
/** Empty link = every "Join our WhatsApp community" banner is hidden. */
export async function saveCommunityLink(link: string): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  const v = link.trim();
  if (v && !/^https:\/\/(chat\.whatsapp\.com|(www\.)?whatsapp\.com\/channel|wa\.me)\/\S+$/.test(v)) {
    return fail("Paste a WhatsApp community / group / channel invite link, e.g. https://chat.whatsapp.com/… or https://whatsapp.com/channel/…");
  }
  const { error } = await s.supabase.from("community_settings").update({ whatsapp_link: v || null, updated_at: new Date().toISOString() }).eq("id", 1);
  updateTag("community");
  if (error && /community_settings/.test(error.message)) return fail("Run supabase/whatsapp-community.sql in Supabase first.");
  return dbResult(error, v ? "Saved — the WhatsApp community banner is now shown." : "Link removed — the banner is hidden everywhere.");
}

// ---------------------------------------------------------------- BLOG (supabase/blog.sql)
export type BlogPostInput = {
  id?: string; title: string; slug: string; excerpt?: string; category: string; cover_image_url?: string;
  content_html: string; seo_title?: string; seo_description?: string; status: "draft" | "published"; published_on?: string;
};

export async function saveBlogPost(input: BlogPostInput): Promise<ActionResult<{ id: string; slug: string }>> {
  const s = await adminOrError();
  if (isError(s)) return s;
  const { BLOG_CATEGORIES, readingMinutes, slugify: blogSlug } = await import("@/lib/blog-shared");
  const { cleanArticleHtml } = await import("@/lib/blog");

  const title = input.title.trim();
  if (title.length < 3) return fail("Please enter a title.");
  const slug = blogSlug(input.slug || title);
  if (!slug) return fail("Please enter a web address (slug) with letters or numbers.");
  if (!(BLOG_CATEGORIES as readonly string[]).includes(input.category)) return fail("Please choose a category.");
  const cover = input.cover_image_url?.trim() || null;
  if (cover && !/^https:\/\//.test(cover)) return fail("The cover image must be a https:// link (upload one with the button).");
  const html = cleanArticleHtml(input.content_html ?? ""); // allow-list cleaning on the server
  if (input.status === "published" && html.replace(/<[^>]+>/g, "").trim().length < 20) return fail("Write a little more before publishing.");

  // first time published → published now (or on the chosen date)
  let publishedAt: string | null = null;
  if (input.status === "published") {
    if (input.published_on && /^\d{4}-\d{2}-\d{2}$/.test(input.published_on)) publishedAt = new Date(`${input.published_on}T09:00:00+05:30`).toISOString();
    else if (input.id) {
      const { data: old } = await s.supabase.from("blog_posts").select("published_at").eq("id", input.id).maybeSingle();
      publishedAt = (old?.published_at as string | null) ?? null;
    }
    publishedAt ??= new Date().toISOString();
  }

  const row = {
    title: title.slice(0, 160),
    slug,
    excerpt: input.excerpt?.trim().slice(0, 300) || null,
    category: input.category,
    cover_image_url: cover,
    content_html: html,
    seo_title: input.seo_title?.trim().slice(0, 70) || null,
    seo_description: input.seo_description?.trim().slice(0, 170) || null,
    reading_minutes: readingMinutes(html),
    status: input.status,
    published_at: publishedAt,
    is_sample: false, // anything saved by the admin is a real post
    updated_at: new Date().toISOString(),
  };
  const res = input.id
    ? await s.supabase.from("blog_posts").update(row).eq("id", input.id).select("id,slug").single()
    : await s.supabase.from("blog_posts").insert(row).select("id,slug").single();
  updateTag("blog");
  if (res.error && /blog_posts/.test(res.error.message) && /does not exist|schema cache|relation/.test(res.error.message)) return fail("Run supabase/blog.sql in Supabase first.");
  if (res.error && /duplicate|unique/i.test(res.error.message)) return fail(`Another post already uses the address /blog/${slug}. Change the slug.`);
  if (res.error) return fail(friendlyDbError(res.error.message));
  return { ok: true, data: { id: res.data.id as string, slug: res.data.slug as string }, message: input.status === "published" ? "Published! 🎉" : "Draft saved." };
}

export async function deleteBlogPost(id: string): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  const { error } = await s.supabase.from("blog_posts").delete().eq("id", id);
  updateTag("blog");
  return dbResult(error, "Post deleted.");
}

// ---------------------------------------------------------------- ACTIVITY LOG (supabase/admin-security.sql)
/** Recorded after a successful authenticator-app check. */
export async function logAdminSignIn(firstSetup: boolean): Promise<ActionResult> {
  const s = await adminOrError(); // also confirms the 2FA login
  if (isError(s)) return s;
  const { error } = await s.supabase.rpc("log_admin_event", {
    p_action: firstSetup ? "security.2fa_setup" : "security.signin",
    p_summary: firstSetup ? "Turned on 2-step verification and signed in" : "Signed in to the admin panel with 2-step verification",
    p_details: {},
  });
  return dbResult(error);
}

// ---------------------------------------------------------------- ACCOUNT DELETION (supabase/privacy.sql)
/** An admin deletes a student's account on request (type DELETE). Payment records are kept, anonymised. */
export async function adminDeleteAccount(userId: string, confirmText: string): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  if (confirmText.trim() !== "DELETE") return fail("Type DELETE to confirm.");
  if (userId === s.user.id) return fail("You can't delete your own admin account here.");
  const { data: p } = await s.supabase.from("profiles").select("full_name,email,role").eq("id", userId).maybeSingle();
  if (p?.role === "admin") return fail("Remove the admin role first, then delete the account.");
  const who = (p?.full_name as string | null) || (p?.email as string | null) || "a student";
  const { deleteAccount } = await import("@/lib/account");
  const res = await deleteAccount(userId, "admin", s.user.id);
  if (!res.ok) return fail(res.error);
  await s.supabase.rpc("log_admin_event", { p_action: "account.delete", p_summary: `Deleted the account of ${who} (on request)`, p_details: {} }).then(() => undefined, () => undefined);
  return { ok: true, message: `Account of ${who} deleted. Payment records were kept without personal details. A confirmation email was sent.` };
}
