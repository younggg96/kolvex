import { ContentLoading } from "@/components/ui/content-loading";
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
      <ContentLoading variant="form" className="w-full max-w-sm px-6" />
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
