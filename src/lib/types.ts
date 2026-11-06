// Shapes of the data that comes from Supabase (matches supabase/setup.sql)

export type ProductCategory = "crash_course" | "study_material" | "previous_paper" | "mock_test" | "counselling_package";

// Extra display info stored in products.details (all optional)
export type ProductDetails = {
  short?: string;
  badge?: string;
  duration?: string;
  mode?: string;
  start_date?: string;
  features?: string[];
  syllabus?: { title: string; topics: string[] }[];
  includes?: string[];
  faqs?: { q: string; a: string }[];
  contents?: string[];
  format?: string;
  color?: string; // Tailwind gradient, e.g. "from-indigo-600 to-blue-500"
  test_type?: "mock" | "mcq";
  questions_count?: number;
  duration_label?: string;
};

export type TestSummary = {
  id: string;
  title: string;
  type: "mock" | "mcq";
  is_free: boolean;
  duration_minutes: number;
  total_marks: number;
};

export type Product = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: ProductCategory;
  college: string | null;
  price: number;
  original_price: number | null;
  is_free: boolean;
  thumbnail_url: string | null;
  file_path: string | null;
  details: ProductDetails;
  tests?: TestSummary[];
};

export type Slot = {
  id: string;
  date: string; // "2026-11-10"
  start_time: string; // "10:00:00"
  end_time: string;
  price: number;
};

export type Review = {
  id: string;
  name: string;
  type: "student" | "parent";
  rating: number;
  comment: string;
  photo_url: string | null;
  is_verified?: boolean; // written by a student who paid → "Verified Student" badge
};

export type SiteStat = { id: string; label: string; value: number | null; suffix: string; sort_order: number };
