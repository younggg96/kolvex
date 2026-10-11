"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { getErrorMessage } from "@/lib/supabase/auth";

export function AuthField({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label
        htmlFor={id}
        className="text-sm font-medium leading-5 text-foreground"
      >
        {label}
      </Label>
      {children}
      {hint && !error && (
        <p
          id={`${id}-hint`}
          className="text-xs leading-5 text-muted-foreground"
        >
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-xs leading-5 text-negative">
          {error}
        </p>
      )}
    </div>
  );
}

export function authDescription(id: string, error?: string, hint = false) {
  return (
    [hint && !error ? `${id}-hint` : "", error ? `${id}-error` : ""]
      .filter(Boolean)
      .join(" ") || undefined
  );
}

export function AuthFeedback({
  message,
  tone = "error",
}: {
  message: string;
  tone?: "error" | "success";
}) {
  const Icon = tone === "error" ? AlertCircle : CheckCircle2;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className="flex items-start gap-2.5 py-1 text-sm leading-6"
    >
      <Icon
        size={18}
        className={`mt-0.5 shrink-0 ${tone === "error" ? "text-negative" : "text-positive"}`}
        aria-hidden="true"
      />
      <p className={tone === "error" ? "text-negative" : "text-foreground"}>
        {message}
      </p>
    </div>
  );
}

export function AuthSubmitButton({
  busy,
  busyLabel,
  children,
  disabled,
  ...props
}: ButtonProps & { busy: boolean; busyLabel: string }) {
  return (
    <Button
      type="submit"
      size="lg"
      className="relative w-full"
      disabled={busy || disabled}
      aria-busy={busy}
      {...props}
    >
      {busy && (
        <Loader2
          size={16}
          className="absolute left-4 animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
      )}
      <span role={busy ? "status" : undefined}>
        {busy ? busyLabel : children}
      </span>
    </Button>
  );
}

export function AuthBackLink() {
  const { t } = useTranslation();
  return (
    <div className="mt-6 border-t border-border pt-5">
      <Link
        href="/auth"
        className="inline-flex items-center gap-2 rounded-sm text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/60"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        {t("auth.backToLogin")}
      </Link>
    </div>
  );
}

export function validateAuthEmail(email: string, t: (key: string) => string) {
  if (!email.trim()) return t("auth.emailRequired");
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ? undefined
    : t("auth.emailInvalid");
}

export function localizedAuthError(error: unknown, t: (key: string) => string) {
  const message = getErrorMessage(error).toLowerCase();
  const translations: [string, string][] = [
    ["invalid email or password", "auth.invalidCredentials"],
    ["account with this email already exists", "auth.accountExists"],
    ["verify your email", "auth.verifyEmail"],
    ["at least 6", "auth.passwordMinimum"],
    ["valid email", "auth.emailInvalid"],
    ["network", "auth.networkError"],
    ["too many", "auth.tooManyAttempts"],
  ];
  const match = translations.find(([text]) => message.includes(text));
  return t(match ? match[1] : "auth.authError");
}
