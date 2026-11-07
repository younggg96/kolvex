import { Metadata } from "next";
import { Suspense } from "react";
import AuthPageClient from "@/components/auth/AuthPageClient";
import { AuthLayoutSkeleton } from "@/components/auth/AuthLayout";

export const metadata: Metadata = {
  title: "Sign in | Kolvex",
  description:
    "Sign in to your Kolvex investment decision workspace. Research stocks, track your theses and review the reasons behind your decisions.",
};

export default function AuthPage() {
  return (
    <Suspense fallback={<AuthLayoutSkeleton />}>
      <AuthPageClient />
    </Suspense>
  );
}
