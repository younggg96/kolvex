"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import AuthForm from "@/components/auth/AuthForm";
import AuthLayout from "@/components/auth/AuthLayout";

type AuthMode = "login" | "signup";

export default function AuthPageClient() {
  const [mode, setMode] = useState<AuthMode>("login");
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check for error in URL query params
    const error = searchParams.get("error");
    const errorCode = searchParams.get("error_code");
    const errorDescription = searchParams.get("error_description");

    if (error || errorCode) {
      // Handle different error cases
      if (errorCode === "otp_expired" || error === "access_denied") {
        toast.error(
          "Email verification link has expired. Please request a new one."
        );
      } else if (error === "verification_failed") {
        toast.error("Email verification failed. Please try again.");
      } else if (error === "profile_creation_failed") {
        toast.error("Failed to create user profile. Please contact support.");
      } else if (errorDescription) {
        toast.error(decodeURIComponent(errorDescription));
      } else {
        toast.error("An authentication error occurred. Please try again.");
      }

      // Clean up URL by removing error params
      router.replace("/auth");
    }

    // Also check hash parameters (for client-side redirects from Supabase)
    const hash = window.location.hash;
    if (hash) {
      const hashParams = new URLSearchParams(hash.substring(1));
      const hashError = hashParams.get("error");
      const hashErrorCode = hashParams.get("error_code");
      const hashErrorDescription = hashParams.get("error_description");

      if (hashError || hashErrorCode) {
        if (hashErrorCode === "otp_expired" || hashError === "access_denied") {
          toast.error(
            "Email verification link has expired. Please request a new one."
          );
        } else if (hashErrorDescription) {
          toast.error(decodeURIComponent(hashErrorDescription));
        } else {
          toast.error("An authentication error occurred. Please try again.");
        }

        // Clean up hash
        window.history.replaceState(
          null,
          "",
          window.location.pathname + window.location.search
        );
      }
    }
  }, [searchParams, router]);

  const title = mode === "login" ? "Welcome Back" : "Create Account";
  const subtitle =
    mode === "login"
      ? "Login to access your investment dashboard"
      : "Join us to start tracking your investments";

  return (
    <AuthLayout title={title} subtitle={subtitle}>
      <AuthForm mode={mode} onModeChange={setMode} />
    </AuthLayout>
  );
}
