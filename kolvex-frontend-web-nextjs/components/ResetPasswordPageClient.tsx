"use client";

import ResetPasswordForm from "@/components/ResetPasswordForm";
import AuthLayout from "./AuthLayout";

export default function ResetPasswordPageClient() {
  return (
    <AuthLayout
      title="Reset Password"
      subtitle="Create a new password for your account"
    >
      <ResetPasswordForm />
    </AuthLayout>
  );
}
