// Old link /dashboard/question-bank → the Question Bank inside My Courses & Material (opened).
import { NextResponse, type NextRequest } from "next/server";
import { QUESTION_BANK_SLUG } from "@/lib/courses";
import { getAdminSupabase } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const db = getAdminSupabase();
  const { data } = db ? await db.from("products").select("id").eq("slug", QUESTION_BANK_SLUG).maybeSingle() : { data: null };
  // (My Courses itself checks the login and the mobile number)
  return NextResponse.redirect(new URL(data?.id ? `/dashboard/courses?open=${data.id}#item-${data.id}` : "/dashboard/courses", request.url), 307);
}
