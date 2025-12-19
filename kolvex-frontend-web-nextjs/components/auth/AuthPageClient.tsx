"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import AuthForm from "@/components/auth/AuthForm";
import AuthLayout from "@/components/auth/AuthLayout";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "login" | "signup";

export default function AuthPageClient() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [isProcessingOAuth, setIsProcessingOAuth] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasProcessedHash = useRef(false);

  // Handle OAuth hash callback - runs only once on mount
  useEffect(() => {
    // Prevent double processing (React Strict Mode)
    if (hasProcessedHash.current) return;

    const hash = window.location.hash;
    if (!hash || hash.length <= 1) return;

    const hashParams = new URLSearchParams(hash.substring(1));
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");
    const type = hashParams.get("type");
    const hashError = hashParams.get("error");

    // Handle password recovery redirect
    if (type === "recovery" && accessToken) {
      hasProcessedHash.current = true;
      router.replace(`/auth/reset-password${hash}`);
      return;
    }

    // Handle OAuth success - access_token present without error
    if (accessToken && refreshToken && !hashError) {
      hasProcessedHash.current = true;
      setIsProcessingOAuth(true);

      const handleOAuthCallback = async () => {
        try {
          const supabase = createClient();

          // Set the session using the tokens from the URL hash
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            console.error("OAuth session error:", sessionError);
            toast.error("Failed to complete sign in. Please try again.");
            setIsProcessingOAuth(false);
            window.history.replaceState(null, "", window.location.pathname);
            return;
          }

          if (data.session) {
            toast.success("Successfully signed in!");

            // Get the stored redirect URL from cookie or default to dashboard
            const redirectTo = document.cookie
              .split("; ")
              .find((row) => row.startsWith("auth_redirect_to="))
              ?.split("=")[1];

            // Use window.location for a full page navigation
            window.location.href = redirectTo
              ? decodeURIComponent(redirectTo)
              : "/dashboard";
          } else {
            toast.error("Failed to complete sign in. Please try again.");
            setIsProcessingOAuth(false);
            window.history.replaceState(null, "", window.location.pathname);
          }
        } catch (err) {
          console.error("OAuth callback error:", err);
          toast.error("An error occurred during sign in. Please try again.");
          setIsProcessingOAuth(false);
          window.history.replaceState(null, "", window.location.pathname);
        }
      };

      handleOAuthCallback();
      return;
    }

    // Handle hash errors
    if (hashError) {
      hasProcessedHash.current = true;
      const hashErrorDescription = hashParams.get("error_description");
      if (hashErrorDescription) {
        toast.error(decodeURIComponent(hashErrorDescription));
      } else {
        toast.error("An authentication error occurred. Please try again.");
      }
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []); // Empty dependency - only run once on mount

  // Handle URL query param errors
  useEffect(() => {
    const error = searchParams.get("error");
    const errorCode = searchParams.get("error_code");
    const errorDescription = searchParams.get("error_description");

    if (error || errorCode) {
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

      router.replace("/auth");
    }
  }, [searchParams, router]);

  // Show loading state while processing OAuth
  if (isProcessingOAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground text-lg">Completing sign in...</p>
        </div>
      </div>
    );
  }

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
