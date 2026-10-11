"use client";

import { useState, useEffect, useRef, type FormEvent } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { updatePassword } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/client";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import {
  AuthField,
  AuthFeedback,
  AuthSubmitButton,
  AuthBackLink,
  authDescription,
  localizedAuthError,
} from "./AuthUI";

export default function ResetPasswordForm() {
  const router = useRouter();
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [invalidLink, setInvalidLink] = useState(false);
  const [error, setError] = useState<string>();
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>(
    {},
  );
  const busy = useRef(false);
  const redirectTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    let alive = true;
    async function handleRecoveryToken() {
      try {
        const supabase = createClient();
        const hash = window.location.hash;
        if (hash && hash.includes("access_token")) {
          const hashParams = new URLSearchParams(hash.substring(1));
          const accessToken = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token");
          if (accessToken && refreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (!alive) return;
            if (sessionError) {
              setInvalidLink(true);
              return;
            }
            window.history.replaceState(null, "", window.location.pathname);
            setIsReady(true);
            return;
          }
        }
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (!alive) return;
        if (sessionError || !data.session) setInvalidLink(true);
        else setIsReady(true);
      } catch {
        if (alive) setInvalidLink(true);
      }
    }
    handleRecoveryToken();
    return () => {
      alive = false;
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || !isReady) return;
    const next: typeof errors = {};
    if (!password) next.password = t("auth.passwordRequired");
    else if (password.length < 6) next.password = t("auth.passwordMinimum");
    if (!confirmPassword) next.confirm = t("auth.confirmPasswordRequired");
    else if (password !== confirmPassword)
      next.confirm = t("auth.passwordMismatch");
    setErrors(next);
    setError(undefined);
    const first = next.password
      ? "password"
      : next.confirm
        ? "confirmPassword"
        : null;
    if (first) {
      document.getElementById(first)?.focus();
      return;
    }
    busy.current = true;
    setIsLoading(true);
    try {
      const result = await updatePassword({ password });
      if (result.success) {
        setIsSuccess(true);
        redirectTimer.current = setTimeout(() => router.push("/auth"), 500);
      } else setError(localizedAuthError(result.error, t));
    } catch {
      setError(t("auth.authError"));
    } finally {
      busy.current = false;
      setIsLoading(false);
    }
  }

  if (!isReady && !invalidLink)
    return (
      <div>
        <div
          role="status"
          className="flex min-h-28 items-center justify-center gap-3 text-sm text-muted-foreground"
        >
          <Loader2
            size={18}
            className="animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
          {t("auth.verifyingResetLink")}
        </div>
        <AuthBackLink />
      </div>
    );
  if (invalidLink)
    return (
      <div className="space-y-5">
        <AuthFeedback message={t("auth.invalidResetLink")} />
        <Button asChild variant="outline" size="lg" className="w-full">
          <Link href="/auth/forgot-password">
            {t("auth.requestNewResetLink")}
          </Link>
        </Button>
        <AuthBackLink />
      </div>
    );

  return (
    <div>
      {isSuccess ? (
        <AuthFeedback tone="success" message={t("auth.passwordResetSuccess")} />
      ) : (
        <form
          noValidate
          onSubmit={handleSubmit}
          className="flex flex-col gap-5"
          aria-busy={isLoading}
        >
          <AuthField
            id="password"
            label={t("auth.newPassword")}
            error={errors.password}
            hint={t("auth.passwordMinimum")}
          >
            <PasswordInput
              variant="auth"
              id="password"
              name="new-password"
              autoComplete="new-password"
              required
              minLength={6}
              disabled={isLoading}
              placeholder={t("auth.newPasswordPlaceholder")}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setErrors((current) => ({ ...current, password: undefined }));
                setError(undefined);
              }}
              aria-invalid={!!errors.password}
              aria-describedby={authDescription(
                "password",
                errors.password,
                true,
              )}
            />
          </AuthField>
          <AuthField
            id="confirmPassword"
            label={t("auth.confirmPassword")}
            error={errors.confirm}
          >
            <PasswordInput
              variant="auth"
              id="confirmPassword"
              name="confirm-password"
              autoComplete="new-password"
              required
              disabled={isLoading}
              placeholder={t("auth.confirmPasswordPlaceholder")}
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                setErrors((current) => ({ ...current, confirm: undefined }));
                setError(undefined);
              }}
              aria-invalid={!!errors.confirm}
              aria-describedby={authDescription(
                "confirmPassword",
                errors.confirm,
              )}
            />
          </AuthField>
          {error && <AuthFeedback message={error} />}
          <AuthSubmitButton busy={isLoading} busyLabel={t("auth.resetting")}>
            {t("auth.resetPassword")}
          </AuthSubmitButton>
        </form>
      )}
      <AuthBackLink />
    </div>
  );
}
