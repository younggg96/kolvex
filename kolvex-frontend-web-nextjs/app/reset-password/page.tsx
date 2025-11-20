import { Metadata } from "next";
import ResetPasswordPageClient from "@/components/ResetPasswordPageClient";

export const metadata: Metadata = {
  title: "Reset Password | Kolvex",
  description: "Create a new password for your account",
};

export default function ResetPasswordPage() {
  return <ResetPasswordPageClient />;
}
