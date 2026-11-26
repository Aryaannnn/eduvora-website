import { ShieldIcon } from "./Icons";

// "We are not VIT" notice — on the VIT Counselling Guide (box), and as one line near the
// top of the predictor, booking and parents pages.
export const OFFICIAL_NOTICE =
  "EDUVORA is an independent guidance service. Official registration, counselling and fee payment happen only on vit.ac.in / viteee.vit.ac.in. We will never ask for your VIT application password.";

const Sites = () => (
  <>
    <a href="https://vit.ac.in" target="_blank" rel="noopener noreferrer" className="font-bold underline underline-offset-2">vit.ac.in</a>
    {" / "}
    <a href="https://viteee.vit.ac.in" target="_blank" rel="noopener noreferrer" className="font-bold underline underline-offset-2">viteee.vit.ac.in</a>
  </>
);

export default function OfficialNotice({ variant = "line", className = "" }: { variant?: "line" | "box"; className?: string }) {
  if (variant === "box") {
    return (
      <aside role="note" aria-label="Official VIT website notice" className={`flex items-start gap-3 rounded-2xl bg-amber-50 p-5 text-amber-950 ring-1 ring-amber-300 ${className}`}>
        <ShieldIcon className="mt-0.5 h-6 w-6 shrink-0 text-amber-600" />
        <div className="text-sm leading-relaxed sm:text-base">
          <p className="font-extrabold">EDUVORA is an independent guidance service.</p>
          <p className="mt-1">
            Official registration, counselling and fee payment happen only on <Sites />. <strong>We will never ask for your VIT application password.</strong>
          </p>
        </div>
      </aside>
    );
  }
  return (
    <p role="note" className={`flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-950 ring-1 ring-amber-200 sm:text-sm ${className}`}>
      <ShieldIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      <span>
        EDUVORA is an independent guidance service. Official registration, counselling and fee payment happen only on <Sites />. We will never ask for your VIT application password.
      </span>
    </p>
  );
}
