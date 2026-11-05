// =====================================================================
//  LOGIN / SIGN-UP (Supabase)
//  Phone number + OTP and Google sign-in.
//  If Supabase keys are not set in .env.local yet, it runs in DEMO mode.
// =====================================================================
import { getBrowserSupabase } from "./supabase/client";
import { isSupabaseConfigured } from "./supabase/env";

export const AUTH_DEMO_MODE = !isSupabaseConfigured;

export type AuthResult = { ok: boolean; message?: string };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const toE164 = (phone: string) => `+91${phone}`;

// Turns Supabase's technical errors into simple English
function friendly(message: string, mode?: "signin" | "signup"): string {
  const m = message.toLowerCase();
  if (m.includes("signups not allowed") || m.includes("user not found"))
    return mode === "signin" ? "No account found with this number. Please tap Sign Up first." : message;
  if (m.includes("expired") || m.includes("invalid") || m.includes("token"))
    return "That OTP is wrong or has expired. Please check it or tap Resend OTP.";
  if (m.includes("rate limit") || m.includes("too many") || m.includes("security purposes"))
    return "Too many attempts. Please wait a minute and try again.";
  if (m.includes("provider") && m.includes("not enabled"))
    return "This sign-in method is not switched on yet in Supabase. Please contact us.";
  if (m.includes("sms") || m.includes("twilio"))
    return "We couldn't send the SMS right now. Please try again in a moment or use Google sign-in.";
  return message;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Email + password sign-up. If "Confirm email" is on in Supabase, needsConfirmation = true. */
export async function signUpWithEmail(
  email: string,
  password: string,
  profile: { fullName: string; role: "student" | "parent" },
  next: string,
): Promise<AuthResult & { needsConfirmation?: boolean }> {
  if (!EMAIL_RE.test(email)) return { ok: false, message: "Please enter a valid email address." };
  if (password.length < 6) return { ok: false, message: "Password must be at least 6 characters." };
  const supabase = getBrowserSupabase();
  if (!supabase) return { ok: false, message: "Login will work once Supabase is connected." };
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: profile.fullName, role: profile.role }, // saved to the profile by the database trigger
      emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) return { ok: false, message: friendlyEmail(error.message) };
  // Supabase returns a user with no identities when the email is already registered
  if (data.user && data.user.identities?.length === 0)
    return { ok: false, message: "An account with this email already exists. Please tap Sign In." };
  return { ok: true, needsConfirmation: !data.session };
}

/** Email + password sign-in. */
export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  if (!EMAIL_RE.test(email)) return { ok: false, message: "Please enter a valid email address." };
  if (!password) return { ok: false, message: "Please enter your password." };
  const supabase = getBrowserSupabase();
  if (!supabase) return { ok: false, message: "Login will work once Supabase is connected." };
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? { ok: false, message: friendlyEmail(error.message) } : { ok: true };
}

function friendlyEmail(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Wrong email or password. Please try again.";
  if (m.includes("email not confirmed")) return "Please confirm your email first — open the link we sent to your inbox.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "An account with this email already exists. Please tap Sign In.";
  if (m.includes("rate limit") || m.includes("too many") || m.includes("security purposes"))
    return "Too many attempts. Please wait a few minutes and try again.";
  if (m.includes("password")) return message; // e.g. password strength rules
  if (m.includes("signups not allowed") || m.includes("signup is disabled")) return "New sign-ups are closed right now. Please contact us.";
  return message;
}

/**
 * Sends the "reset your password" email. The link in the email opens
 * /auth/callback, which logs the user in for a moment and sends them to /reset-password.
 * For privacy we always show the same message, whether or not the email is registered.
 */
export async function requestPasswordReset(email: string): Promise<AuthResult> {
  if (!EMAIL_RE.test(email)) return { ok: false, message: "Please enter a valid email address." };
  const supabase = getBrowserSupabase();
  if (!supabase) return { ok: false, message: "Password reset will work once Supabase is connected." };
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
  });
  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes("rate limit") || m.includes("security purposes") || m.includes("too many"))
      return { ok: false, message: "Too many requests. Please wait a few minutes and try again." };
    // Any other problem: don't reveal whether the email exists
  }
  return { ok: true };
}

/** Saves the new password for the user who opened the reset link. */
export async function updatePassword(password: string): Promise<AuthResult> {
  const supabase = getBrowserSupabase();
  if (!supabase) return { ok: false, message: "Supabase is not connected." };
  const { error } = await supabase.auth.updateUser({ password });
  if (!error) return { ok: true };
  const m = error.message.toLowerCase();
  if (m.includes("session") || m.includes("expired") || m.includes("jwt"))
    return { ok: false, message: "expired" };
  if (m.includes("different from the old")) return { ok: false, message: "Your new password must be different from your old password." };
  return { ok: false, message: error.message };
}

/** Sends a 6-digit OTP by SMS. Sign In only works for existing accounts. */
export async function sendOtp(
  phone: string,
  mode: "signin" | "signup",
  profile?: { fullName: string; role: "student" | "parent" },
): Promise<AuthResult> {
  if (!/^[6-9]\d{9}$/.test(phone)) return { ok: false, message: "Please enter a valid 10-digit mobile number." };
  const supabase = getBrowserSupabase();
  if (!supabase) {
    await wait(600);
    return { ok: true };
  }
  const { error } = await supabase.auth.signInWithOtp({
    phone: toE164(phone),
    options: {
      shouldCreateUser: mode === "signup",
      // Saved to the new user's profile by the database trigger
      data: mode === "signup" && profile ? { full_name: profile.fullName, role: profile.role } : undefined,
    },
  });
  return error ? { ok: false, message: friendly(error.message, mode) } : { ok: true };
}

/** Checks the OTP the user typed and logs them in. */
export async function verifyOtp(phone: string, otp: string): Promise<AuthResult> {
  if (!/^\d{6}$/.test(otp)) return { ok: false, message: "Please enter the 6-digit OTP." };
  const supabase = getBrowserSupabase();
  if (!supabase) {
    await wait(600);
    return { ok: true };
  }
  const { error } = await supabase.auth.verifyOtp({ phone: toE164(phone), token: otp, type: "sms" });
  return error ? { ok: false, message: friendly(error.message) } : { ok: true };
}

/** Sends the user to Google, then back to /auth/callback on this website. */
export async function signInWithGoogle(next: string): Promise<AuthResult> {
  const supabase = getBrowserSupabase();
  if (!supabase) {
    await wait(400);
    return { ok: false, message: "Google sign-in will work once Supabase is connected (see SUPABASE_SETUP.md)." };
  }
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  return error ? { ok: false, message: friendly(error.message) } : { ok: true };
}

export async function signOut() {
  await getBrowserSupabase()?.auth.signOut();
}

/** Where to go after login: ?next=/something (only paths on this site) */
export function nextPathFromUrl(fallback = "/dashboard"): string {
  if (typeof window === "undefined") return fallback;
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
