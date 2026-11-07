// Subjects a test question can belong to (same list as in supabase/test-analytics.sql)
export const SUBJECTS = ["Physics", "Chemistry", "Mathematics", "Biology", "English", "Aptitude"] as const;
export type Subject = (typeof SUBJECTS)[number];

/** "physics", "Maths", "PHY" → "Physics" … ("" when unknown) */
export function normaliseSubject(raw: string): Subject | "" {
  const s = raw.trim().toLowerCase();
  if (!s) return "";
  const exact = SUBJECTS.find((x) => x.toLowerCase() === s);
  if (exact) return exact;
  if (/^phy/.test(s)) return "Physics";
  if (/^chem/.test(s)) return "Chemistry";
  if (/^math/.test(s)) return "Mathematics";
  if (/^bio/.test(s)) return "Biology";
  if (/^eng/.test(s)) return "English";
  if (/^(apt|reason|logic)/.test(s)) return "Aptitude";
  return "";
}

/** Colour per subject (charts) */
export const SUBJECT_COLOR: Record<string, string> = {
  Physics: "#2563eb",
  Chemistry: "#16a34a",
  Mathematics: "#9333ea",
  Biology: "#db2777",
  English: "#ea580c",
  Aptitude: "#0891b2",
  General: "#64748b",
};
