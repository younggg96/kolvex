import { Metadata } from "next";
import ForgotPasswordPageClient from "@/components/auth/ForgotPasswordPageClient";

export const metadata: Metadata = {
  title: "Forgot Password | Kolvex",
  description:
    "Reset your password to regain access to your investment dashboard",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordPageClient />;
}

