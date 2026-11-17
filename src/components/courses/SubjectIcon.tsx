// Physics (atom) · Chemistry (flask) · Mathematics (sigma) — one icon + colour per subject.
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

export const SUBJECT_UI = {
  physics: { label: "Physics", Icon: AtomIcon, chip: "bg-sky-50 text-sky-800 ring-sky-200", box: "bg-sky-600" },
  chemistry: { label: "Chemistry", Icon: FlaskIcon, chip: "bg-emerald-50 text-emerald-800 ring-emerald-200", box: "bg-emerald-600" },
  mathematics: { label: "Mathematics", Icon: SigmaIcon, chip: "bg-violet-50 text-violet-800 ring-violet-200", box: "bg-violet-600" },
} as const;
export type SubjectKey = keyof typeof SUBJECT_UI;
export const SUBJECT_KEYS: SubjectKey[] = ["physics", "chemistry", "mathematics"];
