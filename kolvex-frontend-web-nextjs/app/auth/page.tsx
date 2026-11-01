import { ContentSkeleton } from "@/components/ui/content-skeleton";
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
      <ContentSkeleton label="Loading sign in / 正在加载登录页面" variant="profile" className="w-full max-w-sm px-6" />
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
