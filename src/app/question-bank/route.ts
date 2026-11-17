// /question-bank (menu, footer, old links) → the single "VITEEE Question Bank" product page
// while it is switched on, otherwise the Courses page.
import { NextResponse, type NextRequest } from "next/server";
import { QUESTION_BANK_SLUG } from "@/lib/courses";
import { getProductBySlug } from "@/lib/data";

export async function GET(request: NextRequest) {
  const qb = await getProductBySlug(QUESTION_BANK_SLUG);
  return NextResponse.redirect(new URL(qb ? `/courses/${QUESTION_BANK_SLUG}` : "/courses", request.url), 307);
}
