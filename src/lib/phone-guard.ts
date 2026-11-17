// Server check: a student (or parent) without a mobile number can't book, buy or
// use the predictor — even if they call the API directly. Admins / counsellors pass.
import "server-only";
import { NextResponse } from "next/server";
import type { Session } from "./dashboard";
import { needsPhone, PHONE_NEEDED } from "./phone";

/** No profile row yet counts as "student without a number". */
export const sessionNeedsPhone = (s: Session) => needsPhone(s.profile ?? { role: "student", phone: null });

/** null = OK, otherwise a 403 JSON the browser understands ({ needPhone: true } → /complete-profile) */
export function phoneRequired(s: Session, headers?: HeadersInit): NextResponse | null {
  if (!sessionNeedsPhone(s)) return null;
  return NextResponse.json({ error: PHONE_NEEDED, needPhone: true }, { status: 403, headers });
}
