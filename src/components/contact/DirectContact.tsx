// =====================================================================
//  DIRECT CALL BOX (+ WhatsApp chat for everyone)
//  Runs on the SERVER. It asks src/lib/contact.ts whether this visitor has
//  paid. Only then is the full number + Call button put into the page.
//  Everyone else gets the masked number ("+91 88719 XXXXX") and the unlock
//  message — plus a WhatsApp chat button, which is open to all.
// =====================================================================
import Link from "next/link";
import { Suspense } from "react";
import { siteConfig, whatsappLink } from "@/config/site";
import { getContactAccess } from "@/lib/contact";
import { CheckIcon, LockIcon, PhoneIcon, WhatsAppIcon } from "../Icons";

type Variant = "card" | "footer";

export const unlockMessage = `Book a counselling session or buy any course or material to get direct access to ${siteConfig.founder.name.split(" ")[0]} Sir's number.`;

/** Green "Chat on WhatsApp" button — works for everyone. */
function WhatsAppButton({ className = "" }: { className?: string }) {
  return (
    <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className={`btn-primary !bg-[#25D366] !py-3 hover:!bg-[#1ebe5b] ${className}`}>
      <WhatsAppIcon className="h-5 w-5" /> Chat on WhatsApp
    </a>
  );
}

export default function DirectContact({ variant = "card" }: { variant?: Variant }) {
  return (
    <Suspense fallback={<Masked variant={variant} loading />}>
      <DirectContactInner variant={variant} />
    </Suspense>
  );
}

async function DirectContactInner({ variant }: { variant: Variant }) {
  const access = await getContactAccess();
  if (!access.unlocked) return <Masked variant={variant} />;

  const wa = whatsappLink();
  const tel = `tel:${access.tel}`;

  if (variant === "footer") {
    return (
      <div className="space-y-2">
        <a href={tel} className="flex gap-2.5 hover:text-white"><PhoneIcon className="mt-0.5 h-4 w-4 shrink-0" />{access.display}</a>
        <a href={wa} target="_blank" rel="noopener noreferrer" className="flex gap-2.5 hover:text-white"><WhatsAppIcon className="mt-0.5 h-4 w-4 shrink-0" />Chat on WhatsApp</a>
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-emerald-200">
      <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
        <CheckIcon className="h-3.5 w-3.5" /> Direct access unlocked
      </p>
      <p className="mt-3 text-sm font-semibold text-slate-500">{siteConfig.founder.name}&apos;s direct number</p>
      <p className="mt-1 text-2xl font-extrabold tracking-wide text-brand-700">{access.display}</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <a href={tel} className="btn-primary !py-3"><PhoneIcon className="h-4 w-4" /> Call Now</a>
        <WhatsAppButton />
      </div>
    </div>
  );
}

/** What unpaid visitors see: the masked number, a lock and the unlock button. */
function Masked({ variant, loading = false }: { variant: Variant; loading?: boolean }) {
  if (variant === "footer") {
    return (
      <div className="space-y-2">
        <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className="flex gap-2.5 hover:text-white"><WhatsAppIcon className="mt-0.5 h-4 w-4 shrink-0" />Chat on WhatsApp</a>
        <p className="flex items-center gap-2.5"><LockIcon className="h-4 w-4 shrink-0 text-accent-400" />{siteConfig.phoneMasked}</p>
        {!loading && <Link href="/unlock" className="inline-block text-xs font-semibold text-accent-400 hover:text-accent-300">Unlock Direct Call →</Link>}
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm font-semibold text-slate-500">{siteConfig.founder.name}&apos;s direct number</p>
      <p className="mt-1 flex items-center gap-2 text-2xl font-extrabold tracking-wide text-brand-700">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-400 text-brand-950"><LockIcon className="h-5 w-5" /></span>
        {siteConfig.phoneMasked}
      </p>
      {!loading && (
        <>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">{unlockMessage}</p>
          <Link href="/book-a-slot" className="btn-accent mt-5 w-full !py-3">
            <LockIcon className="h-4 w-4" /> Unlock Direct Call
          </Link>
          <WhatsAppButton className="mt-3 w-full" />
          <p className="mt-3 text-center text-xs text-slate-500">
            Already paid? <Link href="/login?next=/contact" className="font-semibold text-brand-600 underline">Log in</Link> to see the number. · Just a question?{" "}
            <Link href="/unlock#enquiry" className="font-semibold text-brand-600 underline">Send a free enquiry</Link>
          </p>
        </>
      )}
    </div>
  );
}
