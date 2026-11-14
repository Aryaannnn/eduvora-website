// The message that is ready to send when a visitor taps the WhatsApp button.
// It mentions the page they are on, so you know at once what they're asking about.
// ✏️ Change the sentences here. The page heading (e.g. the course name) is added
//    automatically on course, study-material and blog pages.
import { siteConfig } from "@/config/site";

const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, 90);
const under = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);

/**
 * @param pathname the current page, e.g. "/courses/viteee-45-day-crash-course"
 * @param heading  the page's main heading (its <h1>), used on course / material / blog pages
 */
export function whatsappMessageFor(pathname: string, heading?: string | null): string {
  const h = clean(heading);
  const detail = (base: string) => pathname.startsWith(`${base}/`) && h;

  if (detail("/courses")) return `Hi, I have a question about the ${h}`;
  if (under(pathname, "/courses")) return "Hi, I have a question about your VITEEE crash courses";
  if (detail("/study-material")) return `Hi, I have a question about the ${h}`;
  if (under(pathname, "/study-material")) return "Hi, I have a question about your VIT admission kits";
  if (detail("/blog")) return `Hi, I read "${h}" and have a question`;
  if (under(pathname, "/predictor")) return "Hi, I need help with the Rank Predictor";
  if (under(pathname, "/fee-calculator")) return "Hi, I have a question about VIT fees and campuses";
  if (under(pathname, "/mock-tests")) return "Hi, I have a question about your VITEEE mock tests";
  if (under(pathname, "/previous-year-papers")) return "Hi, I have a question about the VITEEE previous year papers";
  if (under(pathname, "/free-resources")) return "Hi, I have a question about the free VITEEE resources";
  if (under(pathname, "/important-dates")) return "Hi, I have a question about VITEEE important dates";
  if (under(pathname, "/book-a-slot")) return "Hi, I need help booking a counselling slot";
  if (under(pathname, "/payment-failed")) return "Hi, my payment didn't go through. Can you help?";
  if (under(pathname, "/unlock")) return "Hi, I have a question about direct call support";
  return siteConfig.whatsappMessage; // "Hi, I need help with VITEEE counselling"
}
