"use client";

import ResetPasswordForm from "@/components/auth/ResetPasswordForm";
import AuthLayout from "./AuthLayout";
import { useTranslation } from "@/lib/i18n";

export default function ResetPasswordPageClient() {
  const { t } = useTranslation();
  return (
    <AuthLayout
      title={t("auth.resetPasswordTitle")}
      subtitle={t("auth.resetPasswordSubtitle")}
    >
      <ResetPasswordForm />
    </AuthLayout>
  );
}
