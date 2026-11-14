// "Why EDUVORA?" cards — shared by the home page and Admin → Settings.
// The cards are edited in Admin → Settings (stored in the why_settings table,
// supabase/why-eduvora.sql). These defaults are used until that file is run.

export const WHY_ICONS = ["graduation", "users", "headset", "target", "award", "shield", "rocket", "calendar", "book", "chat"] as const;
export type WhyIcon = (typeof WHY_ICONS)[number];
export type WhyCard = { icon: WhyIcon; title: string; text: string; href: string };
export type WhySettings = { enabled: boolean; title: string; cards: WhyCard[] };

export const WHY_LIMITS = { cards: 4, title: 60, text: 200, heading: 80 } as const;

export const DEFAULT_WHY: WhySettings = {
  enabled: true,
  title: "Why EDUVORA?",
  cards: [
    { icon: "graduation", title: "Guided by a current VIT student", text: "Utkarsh studies at VIT Vellore right now, so you get first-hand, up-to-date advice on campuses, branches, fees and hostel life.", href: "/founder" },
    { icon: "users", title: "1,000+ students guided", text: "Over 2 years of helping VITEEE aspirants pick the right campus and branch with confidence.", href: "/reviews" },
    { icon: "headset", title: "Personal 1-to-1 counselling", text: "A private video session about YOUR rank, budget and goals — not a crowded webinar.", href: "/book-a-slot" },
    { icon: "target", title: "Rank & College Predictor", text: "See your likely VITEEE rank from your marks, and the campuses and branches within reach.", href: "/predictor" },
  ],
};

/** Only links inside this website ("/book-a-slot"), or empty for no link. */
export const isSafeHref = (h: string) => h === "" || (/^\/(?!\/)[\w\-./#?=&%]*$/.test(h) && h.length <= 120);

/** Cleans cards coming from the database or the admin form. Returns an error message or the clean cards. */
export function cleanWhyCards(input: unknown): { ok: true; cards: WhyCard[] } | { ok: false; error: string } {
  if (!Array.isArray(input)) return { ok: false, error: "Cards are missing." };
  if (input.length > WHY_LIMITS.cards) return { ok: false, error: `Please keep it to ${WHY_LIMITS.cards} cards.` };
  const cards: WhyCard[] = [];
  for (const [i, raw] of input.entries()) {
    const c = (raw ?? {}) as Record<string, unknown>;
    const n = i + 1;
    const title = String(c.title ?? "").replace(/\s+/g, " ").trim();
    const text = String(c.text ?? "").replace(/\s+/g, " ").trim();
    const href = String(c.href ?? "").trim();
    const icon = (WHY_ICONS as readonly string[]).includes(String(c.icon)) ? (c.icon as WhyIcon) : "graduation";
    if (!title) return { ok: false, error: `Card ${n}: please write a title (or remove the card).` };
    if (title.length > WHY_LIMITS.title) return { ok: false, error: `Card ${n}: the title must be under ${WHY_LIMITS.title} characters.` };
    if (text.length > WHY_LIMITS.text) return { ok: false, error: `Card ${n}: the text must be under ${WHY_LIMITS.text} characters.` };
    if (!isSafeHref(href)) return { ok: false, error: `Card ${n}: the link must be a page on this website, like /book-a-slot (or leave it empty).` };
    cards.push({ icon, title, text, href });
  }
  return { ok: true, cards };
}
