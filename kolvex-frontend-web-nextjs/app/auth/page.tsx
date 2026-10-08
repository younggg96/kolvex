import { Metadata } from "next";
import { Suspense } from "react";
import AuthPageClient from "@/components/auth/AuthPageClient";

export const metadata: Metadata = {
  title: "Sign in | Kolvex",
  description:
    "Sign in to your Kolvex investment decision workspace. Research stocks, track your theses and review the reasons behind your decisions.",
};

function AuthPageFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<AuthPageFallback />}>
      <AuthPageClient />
    </Suspense>
  );
}
