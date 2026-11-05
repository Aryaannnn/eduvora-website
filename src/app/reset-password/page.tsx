import type { Metadata } from "next";
import AuthCard from "@/components/AuthCard";
import ResetPasswordForm from "@/components/ResetPasswordForm";

export const metadata: Metadata = { title: "Set New Password", robots: { index: false } };

export default function ResetPasswordPage() {
  return (
    <AuthCard title="Set a new password" subtitle="Choose a password you haven't used before.">
      <ResetPasswordForm />
    </AuthCard>
  );
}
