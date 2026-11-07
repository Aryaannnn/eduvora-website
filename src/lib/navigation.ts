// =====================================================================
//  NAVBAR MENU  ✏️ edit the links here
//  Desktop: Home | Courses | Rank Predictor | Resources ▾ | Reviews | Contact
//  The same grouping is used in the phone slide-in menu.
// =====================================================================

export type NavLink = {
  href: string;
  label: string;
  /** small description shown in the Resources dropdown */
  hint?: string;
  /** shows a small "Free" pill (hidden for students with the full college list) */
  predictorLock?: boolean;
  /** shows a "Coming Soon" badge (the link still works) */
  comingSoon?: boolean;
  /** shows a green "FREE" badge */
  free?: boolean;
};
export type NavGroup = { label: string; children: NavLink[] };
export type NavItem = NavLink | NavGroup;
export const isGroup = (i: NavItem): i is NavGroup => "children" in i;

// Resources dropdown. Only pages that EXIST are listed.
// When you add an "Important Dates" or "Blog" page, add it here, e.g.:
//   { href: "/important-dates", label: "Important Dates", hint: "VITEEE & counselling dates" },
//   { href: "/blog", label: "Blog", hint: "Tips and guides", comingSoon: true },
const resources: NavLink[] = [
  { href: "/free-resources", label: "Free Resources", hint: "Free tests, papers & PDF guides", free: true },
  { href: "/important-dates", label: "Important Dates", hint: "Exam, results & counselling dates" },
  { href: "/fee-calculator", label: "Fee Calculator", hint: "Estimate fees & compare campuses" },
  { href: "/blog", label: "Blog", hint: "Preparation & counselling guides" },
  { href: "/study-material", label: "Study Material", hint: "Admission kits & notes" },
  { href: "/mock-tests", label: "Mock Tests", hint: "Full mocks & MCQ practice" },
  { href: "/previous-year-papers", label: "PYQ Papers", hint: "Previous year VITEEE papers" },
];

export const mainNav: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/courses", label: "Courses" },
  { href: "/predictor", label: "Rank Predictor", predictorLock: true },
  { label: "Resources", children: resources },
  { href: "/reviews", label: "Reviews" },
  { href: "/contact", label: "Contact" },
];
// ("About" lives in the footer and the founder section.)

export const legalLinks = [
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/terms-and-conditions", label: "Terms & Conditions" },
  { href: "/refund-policy", label: "Refund & Cancellation Policy" },
];
