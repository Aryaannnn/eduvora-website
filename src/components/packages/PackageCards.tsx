import { siteConfig } from "@/config/site";
import RatingLine from "../reviews/RatingLine";
import { discountPercent, formatPrice } from "@/lib/format";
import { getPackages, sessionsLabel, type Package } from "@/lib/packages";
import BuyButton from "../BuyButton";
import { CalendarIcon, CheckIcon, ShieldIcon } from "../Icons";
import Reveal from "../Reveal";

// =====================================================================
//  COUNSELLING PACKAGE PRICING CARDS
//  Shown on the Book a Slot page and the home page. Edit the packages in
//  Admin → Packages (name, price, sessions, features, "Most Popular", hide).
//  Hidden automatically when there are no active packages.
// =====================================================================
const COLS: Record<number, string> = { 1: "md:!grid-cols-1 max-w-md mx-auto", 2: "lg:grid-cols-2 max-w-4xl mx-auto", 3: "lg:grid-cols-3" };

export default async function PackageCards({ heading = true }: { heading?: boolean }) {
  const packages = await getPackages();
  if (packages.length === 0) return null;
  const founderFirst = siteConfig.founder.name.split(" ")[0];

  return (
    <div id="packages" className="scroll-mt-24">
      {heading && (
        <div className="mx-auto max-w-2xl text-center">
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-accent-700">
            <span className="h-1.5 w-6 rounded-full bg-accent-400" /> Counselling packages
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-brand-700 sm:text-4xl">Choose your counselling plan</h2>
          <p className="mt-3 text-slate-600">Pay once, then book your sessions with {founderFirst} Sir whenever you need them. Every package unlocks the full Rank &amp; College Predictor and direct call support.</p>
        </div>
      )}
      <div className={`grid items-stretch gap-6 md:grid-cols-2 ${COLS[Math.min(packages.length, 3)]} ${heading ? "mt-12" : ""}`}>
        {packages.map((p, i) => (
          <Reveal key={p.id} delay={i * 90} className="h-full">
            <PackageCard p={p} />
          </Reveal>
        ))}
      </div>
      <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs font-semibold text-slate-500">
        <ShieldIcon className="h-3.5 w-3.5 text-emerald-600" /> 100% Secure Payments by Razorpay · invoice by email
      </p>
      {/* "Rating: x/5 from N reviews" — only with 5+ approved reviews */}
      <RatingLine className="mt-2" />
    </div>
  );
}

function PackageCard({ p }: { p: Package }) {
  const popular = !!p.details.popular;
  const off = discountPercent(p.price, p.original_price);
  const perSession = !p.package_unlimited && (p.package_sessions ?? 1) > 1 ? Math.round(p.price / (p.package_sessions ?? 1)) : 0;
  const features = p.details.features ?? [];

  return (
    <article
      className={`relative flex h-full flex-col rounded-[1.75rem] p-6 sm:p-7 ${
        popular ? "bg-brand-700 text-white shadow-2xl shadow-brand-900/30 ring-4 ring-accent-400 lg:-my-3 lg:py-10" : "bg-white text-slate-900 shadow-lg shadow-slate-200/70 ring-1 ring-slate-200"
      }`}
    >
      {popular && (
        <span className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-accent-400 px-4 py-1.5 text-xs font-extrabold uppercase tracking-wider text-brand-950 shadow-lg">
          ★ Most Popular
        </span>
      )}
      <p className={`text-sm font-bold uppercase tracking-wider ${popular ? "text-accent-300" : "text-brand-600"}`}>{p.title}</p>
      {p.details.tagline && <p className={`mt-1 text-sm ${popular ? "text-slate-300" : "text-slate-500"}`}>{p.details.tagline}</p>}

      <div className="mt-5 flex items-baseline gap-2">
        <span className="text-4xl font-extrabold tracking-tight">{formatPrice(p.price)}</span>
        {p.original_price && <span className={`text-sm line-through ${popular ? "text-slate-300" : "text-slate-500"}`}>{formatPrice(p.original_price)}</span>}
        {off > 0 && <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-xs font-bold text-emerald-700">{off}% off</span>}
      </div>
      <p className={`mt-1 inline-flex items-center gap-1.5 text-sm font-semibold ${popular ? "text-white" : "text-slate-700"}`}>
        <CalendarIcon className="h-4 w-4" /> {sessionsLabel(p)}
        {perSession > 0 && <span className={`font-normal ${popular ? "text-slate-300" : "text-slate-500"}`}>· {formatPrice(perSession)} / session</span>}
      </p>

      {features.length > 0 && (
        <ul className="mt-6 space-y-2.5 text-sm">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2.5">
              <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${popular ? "bg-accent-400 text-brand-950" : "bg-emerald-100 text-emerald-700"}`}>
                <CheckIcon className="h-3.5 w-3.5" />
              </span>
              <span className={popular ? "text-slate-100" : "text-slate-700"}>{f}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto pt-7">
        <BuyButton
          productId={p.id}
          label={`Get ${p.title}`}
          className={`${popular ? "btn-accent" : "btn-primary"} w-full !py-3.5 text-base`}
          trust={false}
          ownedHref="/book-a-slot"
          ownedLabel="Book a Session"
          ownedNote="✓ You have this package"
        />
      </div>
    </article>
  );
}
