"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  signUp,
  signIn,
  signInWithGoogle,
  getErrorMessage,
} from "@/lib/supabase/auth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import Image from "next/image";
import { useTranslation } from "@/lib/i18n";

type AuthMode = "login" | "signup";

interface AuthFormProps {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
}

export default function AuthForm({ mode, onModeChange }: AuthFormProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Get redirect URL from query params, default to /dashboard
  const redirectTo = searchParams.get("redirectTo") || "/dashboard";

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    // Basic validation
    if (!email || !password) {
      toast.error(t("auth.fillAllFields"));
      setIsLoading(false);
      return;
    }

    if (mode === "signup" && !name) {
      toast.error(t("auth.enterName"));
      setIsLoading(false);
      return;
    }

    // Call Supabase Auth
    if (mode === "login") {
      // Sign in
      const result = await signIn({ email, password });

      if (result.success) {
        toast.success(t("auth.loginSuccess"));
        setTimeout(() => {
          router.push(redirectTo);
        }, 1000);
      } else {
        toast.error(getErrorMessage(result.error));
      }
      setIsLoading(false);
    } else {
      // Sign up
      const result = await signUp({ email, password, name });

      if (result.success) {
        toast.success(t("auth.accountCreated"));
        setIsLoading(false);
      } else {
        toast.error(getErrorMessage(result.error));
        setIsLoading(false);
      }
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      const result = await signInWithGoogle(redirectTo);

      if (!result.success) {
        toast.error(getErrorMessage(result.error));
        setIsGoogleLoading(false);
      }
      // If successful, the user will be redirected to Google's OAuth page
      // No need to reset loading state as the page will redirect
    } catch (error: any) {
      toast.error(t("auth.googleSignInFailed"));
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="relative border-t border-border pt-6">

        <div className="relative z-10">
          {/* Mode Toggle */}
          <div className="relative mb-7 flex gap-2 rounded-md border border-border bg-muted p-1.5">
            {/* Sliding Background Indicator */}
            <div
              className={`absolute top-1.5 bottom-1.5 w-[calc(50%-10px)] bg-card rounded transition-all duration-200 ${
                mode === "login" ? "left-1.5" : "left-[calc(50%+4px)]"
              }`}
            ></div>

            <Button
              variant="ghost"
              type="button"
              onClick={() => onModeChange("login")}
              aria-pressed={mode === "login"}
              className={`flex-1 py-2.5 px-4 rounded text-sm font-semibold relative z-10 hover:!bg-transparent ${
                mode === "login"
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Login
            </Button>
            <Button
              variant="ghost"
              type="button"
              onClick={() => onModeChange("signup")}
              aria-pressed={mode === "signup"}
              className={`flex-1 py-2.5 px-4 rounded text-sm font-semibold relative z-10 hover:!bg-transparent ${
                mode === "signup"
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign Up
            </Button>
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-4 transition-all duration-300"
          >
            {/* Login Email & Password */}
            {mode === "login" && (
              <>
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="email-login"
                    className="text-gray-800 dark:text-white/90 text-sm font-medium text-left"
                  >
                    Email Address
                  </label>
                  <Input
                    id="email-login"
                    name="email-login"
                    type="email"
                    autoComplete="username email"
                    className="h-12 bg-gray-50 dark:bg-black/30 hover:border-gray-400 dark:hover:border-white/20 transition-all duration-300"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="password-login"
                    className="text-gray-800 dark:text-white/90 text-sm font-medium text-left"
                  >
                    Password
                  </label>
                  <PasswordInput
                    id="password-login"
                    name="password-login"
                    autoComplete="current-password"
                    className="h-12 bg-gray-50 dark:bg-black/30 hover:border-gray-400 dark:hover:border-white/20 transition-all duration-300"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </>
            )}

            {/* Signup Email & Password */}
            {mode === "signup" && (
              <>
                <div className="flex flex-col gap-2">
                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor="name"
                      className="text-gray-800 dark:text-white/90 text-sm font-medium text-left"
                    >
                      Full Name
                    </label>
                    <Input
                      id="name"
                      name="name"
                      type="text"
                      autoComplete="name"
                      className="h-12 bg-gray-50 dark:bg-black/30 hover:border-gray-400 dark:hover:border-white/20 transition-all duration-300"
                      placeholder="Enter your full name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <label
                    htmlFor="email-signup"
                    className="text-gray-800 dark:text-white/90 text-sm font-medium text-left"
                  >
                    Email Address
                  </label>
                  <Input
                    id="email-signup"
                    name="email-signup"
                    type="email"
                    autoComplete="email"
                    className="h-12 bg-gray-50 dark:bg-black/30 hover:border-gray-400 dark:hover:border-white/20 transition-all duration-300"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="password-signup"
                    className="text-gray-800 dark:text-white/90 text-sm font-medium text-left"
                  >
                    Password
                  </label>
                  <PasswordInput
                    id="password-signup"
                    name="password-signup"
                    autoComplete="new-password"
                    className="h-12 bg-gray-50 dark:bg-black/30 hover:border-gray-400 dark:hover:border-white/20 transition-all duration-300"
                    placeholder="Create a password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </>
            )}

            <div
              className={`transition-all duration-300 overflow-hidden ${
                mode === "login" ? "max-h-8 opacity-100" : "max-h-0 opacity-0"
              }`}
            >
              <div className="flex justify-end">
                <Link
                  href="/auth/forgot-password"
                  className="text-primary text-xs hover:text-primary/80 transition-all duration-200 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={isLoading}
              className="w-full"
            >
              {isLoading
                ? "Processing..."
                : mode === "login"
                ? "Login"
                : "Create Account"}
            </Button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-white/10 to-transparent"></div>
            <span className="text-gray-500 dark:text-white/40 text-xs font-medium">
              OR
            </span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-white/10 to-transparent"></div>
          </div>

          {/* Social Login */}
          <div className="flex flex-col gap-3">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleGoogleSignIn}
              disabled={isGoogleLoading || isLoading}
              className="w-full gap-2"
            >
              <Image
                src="/logo/google.svg"
                alt="Google"
                width={24}
                height={24}
                className="object-contain w-5 h-5"
              />
              <span>
                {isGoogleLoading ? "Connecting..." : "Continue with Google"}
              </span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
