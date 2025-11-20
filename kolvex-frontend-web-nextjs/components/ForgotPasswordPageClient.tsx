"use client";

import ForgotPasswordForm from "@/components/ForgotPasswordForm";
import AuthLayout from "./AuthLayout";

export default function ForgotPasswordPageClient() {
  return (
    <AuthLayout
      title="Forgot Password"
      subtitle="Enter your email and we'll send you instructions to reset your password."
    >
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
