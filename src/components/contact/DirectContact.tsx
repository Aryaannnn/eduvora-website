// =====================================================================
//  CONTACT BOX — follows Admin → Settings → Contact mode
//  Runs on the SERVER (the number never comes from browser code).
//   Open    → everyone: the full number + Call + WhatsApp, with the Open text
//   Private → paid students and admins: the number + Call + WhatsApp, but ONLY
//             where paidOnly is set (Help page, booking confirmation, payment
//             success). Everyone else (and every other place): the free enquiry
//             form with "We'll call you back within a few hours".
//  The number is never put into the page for anyone who may not see it.
// =====================================================================
import { connection } from "next/server";
import Link from "next/link";
import { Suspense } from "react";
import { siteConfig, whatsappLink } from "@/config/site";
import { getContactAccess } from "@/lib/contact";
import { getContactMode } from "@/lib/contact-mode";
import { CheckIcon, MailIcon, PhoneIcon, WhatsAppIcon } from "../Icons";

type Variant = "card" | "footer";
type Props = {
  variant?: Variant;
  /** Private mode: show the number to paid students & admins here (Help, booking confirmation, payment success) */
  paidOnly?: boolean;
  /** Already on a page with the enquiry form next to it (no "Send an enquiry" link) */
  formNextToIt?: boolean;
};

const founderFirst = siteConfig.founder.name.split(" ")[0];

/** Kept for the /unlock page text */
export const unlockMessage = `Book a counselling session or buy any course or material to get ${founderFirst} Sir's direct number (calls and WhatsApp).`;

export default function DirectContact(props: Props) {
  return (
    <Suspense fallback={props.variant === "footer" ? null : <div className="h-40 animate-pulse rounded-3xl bg-slate-100" aria-hidden />}>
      <DirectContactInner {...props} />
    </Suspense>
  );
}

async function DirectContactInner({ variant = "card", paidOnly = false, formNextToIt = false }: Props) {
  await connection(); // decided on every request — never baked into a cached page
  const [cm, access] = await Promise.all([getContactMode(), getContactAccess()]);
  const showNumber = access.unlocked && (access.open || paidOnly);

  if (!showNumber) return <Enquiry variant={variant} note={cm.privateNote} formNextToIt={formNextToIt} />;

  const tel = `tel:${access.tel}`;
  const wa = whatsappLink(siteConfig.whatsappMessage, access.whatsappDigits);

  if (variant === "footer") {
    return (
      <div className="space-y-2">
        <a href={tel} className="flex gap-2.5 hover:text-white"><PhoneIcon className="mt-0.5 h-4 w-4 shrink-0" />{access.display}</a>
        <a href={wa} target="_blank" rel="noopener noreferrer" className="flex gap-2.5 hover:text-white"><WhatsAppIcon className="mt-0.5 h-4 w-4 shrink-0" />WhatsApp us</a>
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-emerald-200">
      {access.open ? (
        <p className="text-sm font-semibold text-slate-500">Call or WhatsApp {founderFirst} Sir</p>
      ) : (
        <>
          <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
            <CheckIcon className="h-3.5 w-3.5" /> For enrolled students
          </p>
          <p className="mt-3 text-sm font-semibold text-slate-500">{siteConfig.founder.name}&apos;s direct number</p>
        </>
      )}
      <p className="mt-1 text-2xl font-extrabold tracking-wide text-brand-700">{access.display}</p>
      {access.open && <p className="mt-2 text-sm leading-relaxed text-slate-600">{cm.openNote}</p>}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <a href={tel} className="btn-primary !py-3"><PhoneIcon className="h-4 w-4" /> Call Now</a>
        <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-primary !bg-[#25D366] !py-3 hover:!bg-[#1ebe5b]">
          <WhatsAppIcon className="h-5 w-5" /> WhatsApp
        </a>
      </div>
    </div>
  );
}

/** Private mode (or no number set): the free enquiry form instead of the number. */
function Enquiry({ variant, note, formNextToIt }: { variant: Variant; note: string; formNextToIt: boolean }) {
  if (variant === "footer") {
    return (
      <Link href="/contact#enquiry" className="flex gap-2.5 hover:text-white">
        <MailIcon className="mt-0.5 h-4 w-4 shrink-0" />
        <span>Send a free enquiry — {note.charAt(0).toLowerCase() + note.slice(1)}</span>
      </Link>
    );
  }
  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <p className="flex items-center gap-2 text-lg font-extrabold text-slate-900"><PhoneIcon className="h-5 w-5 text-brand-600" /> Want us to call you?</p>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">Send a free enquiry — {note.charAt(0).toLowerCase() + note.slice(1)}</p>
      {!formNextToIt && (
        <Link href="/contact#enquiry" className="btn-primary mt-4 w-full !py-3"><MailIcon className="h-4 w-4" /> Send a free enquiry</Link>
      )}
    </div>
  );
}
