// Physics (atom) · Chemistry (flask) · Mathematics (sigma) · English & Aptitude (open book + spark) — one icon + colour per subject.
import { isFormulaBook, isQuestionBank } from "@/lib/courses";
type P = { className?: string };
const svg = (className: string, children: React.ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
    {children}
  </svg>
);

export const AtomIcon = ({ className = "h-5 w-5" }: P) =>
  svg(className, <><circle cx="12" cy="12" r="1.6" /><ellipse cx="12" cy="12" rx="10" ry="4.2" /><ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(60 12 12)" /><ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(120 12 12)" /></>);
export const FlaskIcon = ({ className = "h-5 w-5" }: P) =>
  svg(className, <><path d="M9 3h6M10 3v6.2L4.6 18.4A1.7 1.7 0 0 0 6.1 21h11.8a1.7 1.7 0 0 0 1.5-2.6L14 9.2V3" /><path d="M7.5 15h9" /></>);
export const SigmaIcon = ({ className = "h-5 w-5" }: P) => svg(className, <path d="M18 7V4H6l6 8-6 8h12v-3" />);

export const BookSparkIcon = ({ className = "h-5 w-5" }: P) =>
  svg(className, <><path d="M12 7.5C10.2 6 7.6 5.5 3 5.5v12c4.6 0 7.2.5 9 2 1.8-1.5 4.4-2 9-2v-12c-1.1 0-2.1 0-3 .1" /><path d="M12 7.5v12" /><path d="M17.5 2v4M15.5 4h4" /></>);

export const SUBJECT_UI = {
  physics: { label: "Physics", short: "Physics", Icon: AtomIcon, chip: "bg-sky-50 text-sky-800 ring-sky-200", box: "bg-sky-600" },
  chemistry: { label: "Chemistry", short: "Chem", Icon: FlaskIcon, chip: "bg-emerald-50 text-emerald-800 ring-emerald-200", box: "bg-emerald-600" },
  mathematics: { label: "Mathematics", short: "Maths", Icon: SigmaIcon, chip: "bg-violet-50 text-violet-800 ring-violet-200", box: "bg-violet-600" },
  english_aptitude: { label: "English & Aptitude", short: "Eng & Apt", Icon: BookSparkIcon, chip: "bg-amber-50 text-amber-900 ring-amber-200", box: "bg-amber-600" },
} as const;
export type SubjectKey = keyof typeof SUBJECT_UI;
/** Physics · Chemistry · Mathematics (the Formula Book and the Question Bank) */
export const PCM_KEYS: SubjectKey[] = ["physics", "chemistry", "mathematics"];
/** All four (the crash courses) */
export const SUBJECT_KEYS: SubjectKey[] = [...PCM_KEYS, "english_aptitude"];
/** The subjects of one product, by its web name (slug) */
export const subjectKeysFor = (slug?: string | null): SubjectKey[] => (slug && (isFormulaBook(slug) || isQuestionBank(slug)) ? PCM_KEYS : SUBJECT_KEYS);
/** Optional subjects are only shown once they have PDFs (English & Aptitude) */
export const OPTIONAL_KEYS: SubjectKey[] = ["english_aptitude"];
/** Subject chips for a course card / details page: Physics, Chemistry, Mathematics always; English & Aptitude once it has PDFs */
export const chipKeysFor = (slug: string, bySubject?: Partial<Record<SubjectKey, number>> | null): SubjectKey[] =>
  subjectKeysFor(slug).filter((k) => !OPTIONAL_KEYS.includes(k) || (bySubject?.[k] ?? 0) > 0);
