import { Metadata } from "next";
import { Suspense } from "react";
import AuthPageClient from "@/components/AuthPageClient";

export const metadata: Metadata = {
  title: "Authentication | Kolvex AI",
  description:
    "Welcome to Kolvex AI. Login to access your investment dashboard and track your portfolio performance",
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
