import Link from "next/link";
import { siteConfig } from "@/config/site";
import { ArrowRightIcon } from "../Icons";

// "Related pages" at the bottom of the main public pages: helps students find the
// next useful page, and helps Google understand how the pages belong together.
// ✏️ Which pages link where: the map below.
type P = { href: string; title: string; text: string };
const PAGES: Record<string, P> = {
  predictor: { href: "/predictor", title: "VITEEE Rank Predictor", text: "Enter your marks and see your likely VITEEE rank range — free." },
  courses: { href: "/courses", title: "VITEEE Crash Courses", text: "60, 45, 30 and 10-day PDF revision courses for every subject." },
  booking: { href: "/book-a-slot", title: "Book VITEEE Counselling", text: "One-to-one call: VIT campus, branch and fee category plan." },
  dates: { href: "/important-dates", title: "VITEEE 2027 Important Dates", text: "Application, exam, result and VIT counselling schedule." },
  free: { href: "/free-resources", title: "Free VITEEE Resources", text: "Free mock tests, previous year papers and PDF guides." },
  mocks: { href: "/mock-tests", title: "VITEEE Mock Tests", text: "Full-length mock tests and MCQ practice with instant results." },
  papers: { href: "/previous-year-papers", title: "VITEEE Previous Year Papers", text: "Memory-based papers to practise the real exam pattern." },
  parents: { href: "/parents", title: "Guide for Parents", text: "VIT counselling and VIT fee categories, explained for parents." },
  reviews: { href: "/reviews", title: "Student Reviews", text: "What students and parents say about EDUVORA counselling." },
  founder: { href: "/founder", title: `About ${siteConfig.founder.name}`, text: "The counsellor behind EDUVORA." },
  blog: { href: "/blog", title: "VITEEE Blog", text: "Preparation tips and VIT counselling guides." },
  guide: { href: "/vit-counselling-guide", title: "VIT Counselling Guide", text: "Phases, the official fee, documents and choice filling." },
};
const RELATED: Record<string, (keyof typeof PAGES)[]> = {
  "/predictor": ["guide", "booking", "dates"],
  "/courses": ["predictor", "mocks", "free"],
  "/course": ["predictor", "booking", "papers"],
  "/book-a-slot": ["guide", "predictor", "parents"],
  "/important-dates": ["predictor", "booking", "courses"],
  "/free-resources": ["mocks", "papers", "predictor"],
  "/mock-tests": ["papers", "courses", "free"],
  "/previous-year-papers": ["mocks", "courses", "predictor"],
  "/reviews": ["booking", "founder", "predictor"],
  "/about": ["founder", "booking", "reviews"],
  "/founder": ["booking", "reviews", "blog"],
  "/parents": ["guide", "booking", "dates"],
  "/blog": ["predictor", "booking", "dates"],
  "/contact": ["booking", "parents", "predictor"],
  "/vit-counselling-guide": ["predictor", "dates", "parents"],
};

export default function RelatedPages({ current }: { current: keyof typeof RELATED }) {
  const list = (RELATED[current] ?? []).map((k) => PAGES[k]).filter((p) => p.href !== "/blog" || siteConfig.showBlog);
  if (!list.length) return null;
  return (
    <nav aria-labelledby="related-pages" className="border-t border-slate-200 bg-slate-50">
      <div className="container-page py-10 sm:py-12">
        <h2 id="related-pages" className="text-lg font-extrabold text-brand-700 sm:text-xl">Related pages</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {list.map((p) => (
            <li key={p.href}>
              <Link href={p.href} className="card card-hover flex h-full items-center justify-between gap-3 p-4">
                <span>
                  <span className="block font-bold text-slate-900">{p.title}</span>
                  <span className="block text-sm text-slate-600">{p.text}</span>
                </span>
                <ArrowRightIcon className="h-4 w-4 shrink-0 text-brand-600" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
