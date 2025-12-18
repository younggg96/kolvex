"use client";

import { useState, useEffect, FormEvent } from "react";
import { Lock, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updatePassword, getErrorMessage } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { PasswordInput } from "@/components/ui/password-input";

export default function ResetPasswordForm() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle recovery token from URL hash (implicit flow) or check existing session
  useEffect(() => {
    const handleRecoveryToken = async () => {
      const supabase = createClient();
      const hash = window.location.hash;
      
      if (hash && hash.includes("access_token")) {
        // Parse hash parameters
        const hashParams = new URLSearchParams(hash.substring(1));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        
        if (accessToken && refreshToken) {
          // Set the session using tokens from hash
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          
          if (sessionError) {
            console.error("Session set error:", sessionError);
            setError("Invalid or expired reset link. Please request a new one.");
            return;
          }
          
          // Clean up the URL hash
          window.history.replaceState(null, "", window.location.pathname);
          setIsReady(true);
          return;
        }
      }
      
      // No hash tokens - check if there's already a session
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error("Session check error:", error);
        setError("Invalid or expired reset link. Please request a new one.");
        return;
      }
      
      if (data.session) {
        setIsReady(true);
      } else {
        setError("Invalid or expired reset link. Please request a new one.");
      }
    };

    handleRecoveryToken();
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    // Validation
    if (!password || !confirmPassword) {
      toast.error("Please fill in all fields");
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters long");
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      setIsLoading(false);
      return;
    }

    // Call Supabase
    const result = await updatePassword({ password });

    if (result.success) {
      setIsSuccess(true);
      toast.success("Password reset successful! Redirecting to login...");
      setIsLoading(false);

      // Redirect to login
      setTimeout(() => {
        router.push("/auth");
      }, 500);
    } else {
      toast.error(getErrorMessage(result.error));
      setIsLoading(false);
    }
  };

  // Show loading state while checking token
  if (!isReady && !error) {
    return (
      <div className="w-full max-w-sm sm:max-w-md px-4 sm:px-0 animate-fade-in-up">
        <div className="relative bg-white dark:bg-[#0a0e0a] backdrop-blur-xl border border-gray-200 dark:border-[#1a1f1a] rounded-2xl p-6 sm:p-8 shadow-2xl">
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-gray-600 dark:text-white/60 text-sm">Verifying reset link...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state if token is invalid
  if (error) {
    return (
      <div className="w-full max-w-sm sm:max-w-md px-4 sm:px-0 animate-fade-in-up">
        <div className="relative bg-white dark:bg-[#0a0e0a] backdrop-blur-xl border border-gray-200 dark:border-[#1a1f1a] rounded-2xl p-6 sm:p-8 shadow-2xl">
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 w-full">
              <p className="text-red-500 text-sm text-center">{error}</p>
            </div>
            <Link
              href="/auth/forgot-password"
              className="text-primary hover:text-primary/80 text-sm font-medium transition-colors"
            >
              Request a new reset link
            </Link>
            <Link
              href="/auth"
              className="inline-flex items-center gap-2 text-gray-600 dark:text-white/60 hover:text-primary text-sm transition-all duration-200 group"
            >
              <ArrowLeft className="w-[18px] h-[18px] group-hover:-translate-x-1 transition-transform" />
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm sm:max-w-md px-4 sm:px-0 animate-fade-in-up">
      <div className="relative bg-white dark:bg-[#0a0e0a] backdrop-blur-xl border border-gray-200 dark:border-[#1a1f1a] rounded-2xl p-6 sm:p-8 shadow-2xl hover:shadow-primary/5 transition-all duration-500 hover:-translate-y-1">
        {/* Glow Effect */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>

        <div className="relative z-10">
          {/* Form */}
          {!isSuccess ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="password"
                  className="text-gray-800 dark:text-white/90 text-sm font-medium text-left"
                >
                  New Password
                </label>
                <PasswordInput
                  id="password"
                  name="new-password"
                  autoComplete="new-password"
                  className="h-12 bg-gray-50 dark:bg-black/30 hover:border-gray-400 dark:hover:border-white/20 transition-all duration-300"
                  placeholder="Enter new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                />
                <p className="text-xs text-gray-500 dark:text-white/40">
                  Must be at least 6 characters
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <label
                  htmlFor="confirmPassword"
                  className="text-gray-800 dark:text-white/90 text-sm font-medium text-left"
                >
                  Confirm Password
                </label>
                <PasswordInput
                  id="confirmPassword"
                  name="confirm-password"
                  autoComplete="new-password"
                  className="h-12 bg-gray-50 dark:bg-black/30 hover:border-gray-400 dark:hover:border-white/20 transition-all duration-300"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 mt-2 rounded-lg bg-gradient-to-r from-primary to-primary/90 text-white dark:text-background-dark text-sm font-bold tracking-wide hover:shadow-lg hover:shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {isLoading ? "Resetting..." : "Reset Password"}
              </button>
            </form>
          ) : (
            <div className="animate-fade-in">
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mb-4">
                <p className="text-primary text-sm text-center">
                  Password reset successful! Redirecting...
                </p>
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-white/10 to-transparent"></div>
          </div>

          {/* Back to Login */}
          <div className="text-center">
            <Link
              href="/auth"
              className="inline-flex items-center gap-2 text-gray-600 dark:text-white/60 hover:text-primary text-sm transition-all duration-200 group"
            >
              <ArrowLeft className="w-[18px] h-[18px] group-hover:-translate-x-1 transition-transform" />
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
