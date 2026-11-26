// =====================================================================
//  VIT COUNSELLING GUIDE (/vit-counselling-guide) — shared by the page,
//  Admin → Settings → "VIT Counselling Guide" and the server action.
//
//  ✏️ Every fact is edited in Admin → Settings (stored in Supabase,
//     supabase/vit-guide.sql). The text below is only the starting version.
//  ⚠️ PLACEHOLDERS: anything that changes every year (dates, fees, ranks,
//     the exact document list) is written as  [[FILL: what to fill in]].
//     On the website a placeholder shows as "to be confirmed — check the
//     official VIT website", never as a made-up number. Admin → Settings
//     shows how many are still left to fill in.
//  Formatting inside a section: a blank line starts a new paragraph; a line
//  starting with "- " is a bullet point.
// =====================================================================

export type GuideSection = { id: string; title: string; body: string };
export type GuideFaq = { q: string; a: string };
export type VitGuide = {
  /** e.g. "2027" — the counselling year the facts were checked for */
  year: string;
  /** e.g. "2026-12-01" — when you last checked the facts on the official website */
  checkedOn: string;
  intro: string;
  sections: GuideSection[];
  faqs: GuideFaq[];
};

export const GUIDE_LIMITS = { year: 4, intro: 600, sections: 10, title: 90, body: 3000, faqs: 12, q: 160, a: 800 };

/** [[FILL: …]] */
export const PLACEHOLDER = /\[\[\s*FILL\s*:\s*([^\]]{1,200}?)\s*\]\]/gi;
export const countPlaceholders = (g: VitGuide) =>
  [g.intro, ...g.sections.flatMap((s) => [s.title, s.body]), ...g.faqs.flatMap((f) => [f.q, f.a])].reduce((n, t) => n + (t.match(PLACEHOLDER)?.length ?? 0), 0);
export const hasPlaceholder = (t: string) => new RegExp(PLACEHOLDER.source, "i").test(t);
/** Plain text for SEO / structured data: placeholders become a neutral phrase */
export const plainText = (t: string) => t.replace(PLACEHOLDER, "to be confirmed on the official VIT website").replace(/\s+/g, " ").trim();

export const DEFAULT_GUIDE: VitGuide = {
  year: "",
  checkedOn: "",
  intro:
    "A plain-language guide to the VIT counselling process after the VITEEE result: how the online counselling works, what the official counselling fee is for, which documents to keep ready, how to fill your choices and what to do after a seat is allotted. Always confirm dates and fees on the official VIT website.",
  sections: [
    {
      id: "how-it-works",
      title: "How VIT counselling works",
      body:
        "VIT counselling is conducted online by VIT after the VITEEE result. Candidates are called in phases according to their VITEEE rank — better ranks are called first — and each phase has its own schedule.\n\n- Phase-wise rank ranges for this year: [[FILL: rank range of each counselling phase]]\n- Counselling dates for this year: [[FILL: counselling start and end dates]]\n- Where it happens: only on the official VIT website (vit.ac.in / viteee.vit.ac.in), logged in with your own VITEEE application\n\nIn your phase you choose a campus and a programme from the seats still available at that time, so an earlier phase usually has more options.",
    },
    {
      id: "fees",
      title: "The official counselling fee vs EDUVORA's fee",
      body:
        "VIT charges a counselling fee when you take part in counselling. It is paid only to VIT, only on the official VIT website.\n\n- Official counselling fee this year: [[FILL: official VIT counselling fee (₹) and how it is adjusted or refunded]]\n- Tuition fee categories: VIT has different fee categories, and your category depends on your rank and the campus/programme. Category ranges this year: [[FILL: fee category rank ranges]]\n\nEDUVORA's fee is different: it is for an optional, private one-to-one guidance call with us. It is not paid to VIT, it is not part of the admission process, and it does not reserve or improve any seat.",
    },
    {
      id: "documents",
      title: "Documents usually needed",
      body:
        "Keep clear scans and the originals ready before your phase. The list below is what is usually asked for — always follow the official list for this year: [[FILL: link or note for the official document list]]\n\n- VITEEE admit card and rank card\n- Class 10 marksheet / certificate (proof of date of birth)\n- Class 12 marksheet (or the provisional marksheet if the final one isn't out yet)\n- A government photo ID (for example Aadhaar)\n- Recent passport-size photographs\n- Category / quota certificate, if you are applying under one\n- Any other document VIT lists for your board or nationality",
    },
    {
      id: "choice-filling",
      title: "Choice filling tips",
      body:
        "- Before your phase, write a short list: campus + programme in your order of preference.\n- Check the fee category for each option — the same programme can cost differently on different campuses.\n- Be realistic: compare your rank with the previous year's trends instead of choosing only the most popular branches.\n- Keep one or two backup options you would genuinely accept.\n- Discuss the final list with your parents before your slot opens, not during it.\n- Check the seat availability shown on the official website at the time of your phase.",
    },
    {
      id: "after-allotment",
      title: "What happens after seat allotment",
      body:
        "- You get the allotment details on the official VIT website and by email.\n- Pay the fee asked for by the deadline, only on the official website: [[FILL: fee payment deadline after allotment]]\n- Download and keep the provisional admission letter and every payment receipt.\n- Complete document verification and reporting as instructed: [[FILL: reporting / document verification dates]]\n- If you want to change or upgrade your seat, check the official rules for this year: [[FILL: seat change / upgrade / withdrawal rules]]",
    },
    {
      id: "mistakes",
      title: "Common mistakes to avoid",
      body:
        "- Missing your phase or a payment deadline — set reminders for every official date.\n- Paying anyone outside the official VIT website, or trusting \"management quota\" offers. Admission and fees go only through VIT.\n- Sharing your VIT application number and password with anyone (including us — we will never ask for it).\n- Choosing a programme only because it is popular, without checking the fee category and your interest.\n- Not keeping copies of payment receipts and letters.\n- Waiting for the last minute to scan documents.",
    },
  ],
  faqs: [
    { q: "Is VIT counselling online?", a: "Yes. VIT counselling is conducted online on the official VIT website, in phases by VITEEE rank. You take part with your own VITEEE application login." },
    { q: "How much is the official VIT counselling fee?", a: "The official counselling fee for this year is [[FILL: official VIT counselling fee (₹)]]. It is paid only to VIT on the official website. EDUVORA's guidance fee is separate and optional." },
    { q: "Does EDUVORA allot seats or charge VIT fees?", a: "No. EDUVORA is an independent guidance service. Seats are allotted only by VIT, and all official fees are paid only on the official VIT website." },
    { q: "Which documents do I need for VIT counselling?", a: "Usually your VITEEE admit card and rank card, Class 10 and 12 marksheets, a photo ID, photographs and any category certificate. Always check the official list for the year." },
    { q: "What should I do after I get a seat?", a: "Pay the fee asked for by the deadline on the official website, keep your admission letter and receipts, and complete document verification and reporting as VIT instructs." },
  ],
};

/** "1 May 2026" style check-date for the page (en-IN) */
export const prettyDate = (d: string) => {
  const t = Date.parse(`${d}T00:00:00+05:30`);
  return Number.isNaN(t) ? "" : new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(t);
};

const slugId = (s: string, i: number) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || `section-${i + 1}`;
const text = (v: unknown, max: number) => String(v ?? "").replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim().slice(0, max + 1);

/** Checks what the admin typed. */
export function cleanGuide(input: unknown): { ok: true; guide: VitGuide } | { ok: false; error: string } {
  const g = (input ?? {}) as Partial<VitGuide>;
  const L = GUIDE_LIMITS;
  const year = text(g.year, L.year);
  if (year && !/^20\d\d$/.test(year)) return { ok: false, error: "Year: please write 4 digits, e.g. 2027 (or leave it empty)." };
  const checkedOn = text(g.checkedOn, 10);
  if (checkedOn && !/^\d{4}-\d{2}-\d{2}$/.test(checkedOn)) return { ok: false, error: "Please pick the date you last checked the facts (or leave it empty)." };
  const intro = text(g.intro, L.intro);
  if (intro.length > L.intro) return { ok: false, error: `Please keep the introduction under ${L.intro} characters.` };
  if (!Array.isArray(g.sections) || g.sections.length === 0) return { ok: false, error: "Add at least one section." };
  if (g.sections.length > L.sections) return { ok: false, error: `At most ${L.sections} sections.` };
  const sections: GuideSection[] = [];
  const ids = new Set<string>();
  for (const [i, s] of g.sections.entries()) {
    const title = text(s?.title, L.title).replace(/\s+/g, " ");
    const body = text(s?.body, L.body);
    if (!title) return { ok: false, error: `Section ${i + 1}: please write a heading.` };
    if (title.length > L.title) return { ok: false, error: `Section ${i + 1}: please keep the heading under ${L.title} characters.` };
    if (!body) return { ok: false, error: `Section "${title}": please write some text.` };
    if (body.length > L.body) return { ok: false, error: `Section "${title}": please keep it under ${L.body} characters.` };
    let id = slugId(title, i);
    while (ids.has(id)) id = `${id}-${i + 1}`;
    ids.add(id);
    sections.push({ id, title, body });
  }
  const faqs: GuideFaq[] = [];
  for (const [i, f] of (Array.isArray(g.faqs) ? g.faqs : []).entries()) {
    const q = text(f?.q, L.q).replace(/\s+/g, " ");
    const a = text(f?.a, L.a);
    if (!q && !a) continue;
    if (!q || !a) return { ok: false, error: `Question ${i + 1}: please write both the question and the answer (or remove it).` };
    if (q.length > L.q || a.length > L.a) return { ok: false, error: `Question ${i + 1}: please keep the question under ${L.q} and the answer under ${L.a} characters.` };
    faqs.push({ q, a });
  }
  if (faqs.length > L.faqs) return { ok: false, error: `At most ${L.faqs} questions.` };
  return { ok: true, guide: { year, checkedOn, intro, sections, faqs } };
}
