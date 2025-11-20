"use client";

import { useState, FormEvent } from "react";
import { KeyRound, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { resetPassword, getErrorMessage } from "@/lib/supabase/auth";
import { toast } from "sonner";
import { Input } from "./ui/input";
import { Button } from "./ui/button";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    // Basic validation
    if (!email) {
      toast.error("Please enter your email address");
      setIsLoading(false);
      return;
    }

    // Call Supabase
    const result = await resetPassword({ email });

    if (result.success) {
      setIsSuccess(true);
      toast.success(
        "Password reset email sent! Please check your inbox and follow the instructions."
      );
    } else {
      toast.error(getErrorMessage(result.errorCode, result.error));
    }
    setIsLoading(false);
  };

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
                  htmlFor="email"
                  className="text-gray-800 dark:text-white/90 text-sm font-medium text-left"
                >
                  Email Address
                </label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  className="h-12 bg-gray-50 dark:bg-black/30 hover:border-gray-400 dark:hover:border-white/20 transition-all duration-300"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 mt-2 rounded-lg bg-gradient-to-r from-primary to-primary/90 text-white dark:text-background-dark text-sm font-bold tracking-wide hover:shadow-lg hover:shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {isLoading ? "Sending..." : "Send Reset Link"}
              </button>
            </form>
          ) : (
            <div className="animate-fade-in">
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mb-4">
                <p className="text-primary text-sm text-center">
                  Email sent successfully! Please check your inbox.
                </p>
              </div>
              <div className="text-center text-gray-600 dark:text-white/60 text-xs mb-4">
                <p>Didn&apos;t receive the email? Check your spam folder.</p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setIsSuccess(false);
                  setEmail("");
                }}
                className="w-full h-12 bg-gray-50 dark:bg-black/30 border-gray-300 dark:border-white/10 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-black/50 hover:border-gray-400 dark:hover:border-white/20"
              >
                Try Another Email
              </Button>
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
