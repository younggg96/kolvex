"use client";

import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";
import AuthLayout from "./AuthLayout";
import { useTranslation } from "@/lib/i18n";

export default function ForgotPasswordPageClient() {
  const { t } = useTranslation();
  return (
    <AuthLayout
      title={t("auth.forgotPasswordTitle")}
      subtitle={t("auth.forgotPasswordSubtitle")}
    >
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
