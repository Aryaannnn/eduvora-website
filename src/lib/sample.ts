// SAMPLE items (test content such as "SAMPLE Test — for trying the test system")
// are hidden from all PUBLIC pages once the website is Live
// (src/config/launch.ts → PRE_LAUNCH = false). While PRE_LAUNCH is true they
// still show, so you can try everything out. Admin pages always show them.
//
// Only the word SAMPLE in CAPITAL letters counts, so a real title like
// "VITEEE Sample Paper 2026" is NOT hidden.
import { PRE_LAUNCH } from "@/config/launch";

export const HIDE_SAMPLES = !PRE_LAUNCH;

export const isSampleTitle = (title: string | null | undefined) => /\bSAMPLE\b/.test(title ?? "");

/** true when this item must not be shown to the public right now */
export const hiddenSample = (title: string | null | undefined, isSampleFlag = false) => HIDE_SAMPLES && (isSampleFlag || isSampleTitle(title));

/** Removes SAMPLE items from a list (only when the website is Live). */
export function withoutSamples<T extends { title?: string | null; is_sample?: boolean | null }>(items: T[]): T[] {
  return HIDE_SAMPLES ? items.filter((i) => !hiddenSample(i.title, !!i.is_sample)) : items;
}

/** Same, for products that also list their tests (a SAMPLE test inside a product is removed too). */
export function productsWithoutSamples<T extends { title?: string | null; tests?: { title?: string | null }[] | null }>(items: T[]): T[] {
  if (!HIDE_SAMPLES) return items;
  return withoutSamples(items).map((p) => (Array.isArray(p.tests) ? { ...p, tests: withoutSamples(p.tests) } : p));
}
