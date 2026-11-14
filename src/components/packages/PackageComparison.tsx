import { formatPrice } from "@/lib/format";
import { getPackages, sessionsLabel } from "@/lib/packages";
import { CheckIcon } from "../Icons";

// Compact "what's included in each package" table (Book a Slot page).
// Built from Admin → Packages: price, sessions and each package's feature list.
// A row is ticked for a package when that package lists the same feature
// (same words — so use the same wording for shared features). Shown only with 2+ packages.
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

export default async function PackageComparison() {
  const packages = await getPackages();
  if (packages.length < 2) return null;
  const cols = packages.slice(0, 4);

  // Every feature, in the order it first appears. Lines about the number of sessions
  // are already in the "Counselling sessions" row, and the predictor row is added for
  // everyone below (every paid package unlocks it), so those aren't repeated.
  const covered = (f: string) => /session/i.test(f) || /predictor/i.test(f);
  const rows: string[] = [];
  const seen = new Set<string>();
  for (const p of cols) for (const f of p.details.features ?? []) {
    const k = norm(f);
    if (k && !seen.has(k) && !covered(f)) {
      seen.add(k);
      rows.push(f.trim());
    }
  }
  // Included in EVERY package (see the text above the package cards)
  const everyone = ["Full Rank & College Predictor", ...(rows.some((r) => /direct call|call support/i.test(r)) ? [] : ["Direct call support"])];
  const hasFeature = (features: string[] | undefined, row: string) => (features ?? []).some((f) => norm(f) === norm(row));

  const Tick = () => (
    <>
      <CheckIcon className="mx-auto h-5 w-5 text-emerald-600" />
      <span className="sr-only">Included</span>
    </>
  );
  const Dash = () => (
    <>
      <span className="text-slate-300" aria-hidden>—</span>
      <span className="sr-only">Not included</span>
    </>
  );

  return (
    <div className="mt-14">
      <h3 className="text-center text-xl font-extrabold text-brand-700 sm:text-2xl">Compare packages</h3>
      <p className="mt-1 text-center text-sm text-slate-500">What&apos;s included in each plan.</p>
      <div className="mx-auto mt-6 max-w-4xl overflow-x-auto rounded-2xl bg-white shadow-lg shadow-slate-200/60 ring-1 ring-slate-200">
        <table className="w-full min-w-[34rem] border-collapse text-sm">
          <caption className="sr-only">Counselling packages compared</caption>
          <thead>
            <tr className="bg-slate-50">
              <th scope="col" className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Included</th>
              {cols.map((p) => (
                <th key={p.id} scope="col" className={`px-3 py-3 text-center ${p.details.popular ? "bg-brand-700 text-white" : "text-slate-900"}`}>
                  <span className="block font-extrabold">{p.title}</span>
                  {p.details.popular && <span className="mt-0.5 block text-[10px] font-extrabold uppercase tracking-wider text-accent-300">Most popular</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr>
              <th scope="row" className="sticky left-0 bg-white px-4 py-3 text-left font-semibold text-slate-700">Price</th>
              {cols.map((p) => <td key={p.id} className={`px-3 py-3 text-center text-base font-extrabold text-slate-900 ${p.details.popular ? "bg-brand-50" : ""}`}>{formatPrice(p.price)}</td>)}
            </tr>
            <tr>
              <th scope="row" className="sticky left-0 bg-white px-4 py-3 text-left font-semibold text-slate-700">Counselling sessions</th>
              {cols.map((p) => <td key={p.id} className={`px-3 py-3 text-center font-bold text-slate-800 ${p.details.popular ? "bg-brand-50" : ""}`}>{sessionsLabel(p)}</td>)}
            </tr>
            {rows.map((r) => (
              <tr key={r}>
                <th scope="row" className="sticky left-0 bg-white px-4 py-3 text-left font-medium text-slate-700">{r}</th>
                {cols.map((p) => <td key={p.id} className={`px-3 py-3 text-center ${p.details.popular ? "bg-brand-50" : ""}`}>{hasFeature(p.details.features, r) ? <Tick /> : <Dash />}</td>)}
              </tr>
            ))}
            {everyone.map((r) => (
              <tr key={r}>
                <th scope="row" className="sticky left-0 bg-white px-4 py-3 text-left font-medium text-slate-700">{r}</th>
                {cols.map((p) => <td key={p.id} className={`px-3 py-3 text-center ${p.details.popular ? "bg-brand-50" : ""}`}><Tick /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-center text-xs text-slate-500 sm:hidden">Swipe the table sideways to see every package →</p>
    </div>
  );
}
