import type { Metadata } from "next";
import AuthCard from "@/components/AuthCard";
import ForgotPasswordForm from "@/components/ForgotPasswordForm";

export const metadata: Metadata = { title: "Forgot Password", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Forgot your password?" subtitle="Enter your email and we'll send you a link to set a new one.">
      <ForgotPasswordForm />
    </AuthCard>
  );
}
