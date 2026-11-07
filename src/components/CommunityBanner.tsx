import { communityHref, getCommunityLink, type CommunitySource } from "@/lib/community";
import { ArrowRightIcon, CheckIcon, WhatsAppIcon } from "./Icons";

// =====================================================================
//  "Join our free VITEEE WhatsApp community" banner
//  Shown only when a link is set in Admin → Settings — otherwise nothing.
//  The button goes through /go/community (counts the click).
// =====================================================================
export default async function CommunityBanner({ from, compact = false, className = "" }: { from: CommunitySource; compact?: boolean; className?: string }) {
  const link = await getCommunityLink();
  if (!link) return null;
  const href = communityHref(from);

  if (compact) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={`group flex items-center gap-4 rounded-2xl bg-[#25D366]/10 p-4 ring-1 ring-[#25D366]/30 transition hover:bg-[#25D366]/15 ${className}`}>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#25D366] text-white"><WhatsAppIcon className="h-6 w-6" /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-extrabold text-slate-900">Join our free VITEEE WhatsApp community</span>
          <span className="block text-sm text-slate-600">Dates, results and counselling updates on your phone.</span>
        </span>
        <span className="hidden shrink-0 items-center gap-1 text-sm font-bold text-[#128C4B] sm:inline-flex">Join <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" /></span>
      </a>
    );
  }

  return (
    <section className={`container-page ${className}`} aria-label="WhatsApp community">
      <div className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#075E54] via-[#128C4B] to-[#25D366] p-6 text-white shadow-xl shadow-emerald-900/20 sm:p-8">
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10" aria-hidden />
        <div className="absolute -bottom-16 right-24 h-40 w-40 rounded-full bg-white/5" aria-hidden />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white text-[#128C4B] shadow-lg"><WhatsAppIcon className="h-8 w-8" /></span>
            <div>
              <p className="text-xl font-extrabold leading-tight sm:text-2xl">Join our free VITEEE WhatsApp community for updates</p>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-emerald-50">
                {["Important dates & deadlines", "Results & counselling news", "Free tips — no spam"].map((t) => (
                  <li key={t} className="inline-flex items-center gap-1"><CheckIcon className="h-4 w-4" /> {t}</li>
                ))}
              </ul>
            </div>
          </div>
          <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 font-extrabold text-[#075E54] shadow-lg transition hover:scale-[1.02] hover:bg-emerald-50">
            <WhatsAppIcon className="h-5 w-5" /> Join for Free
          </a>
        </div>
      </div>
    </section>
  );
}
