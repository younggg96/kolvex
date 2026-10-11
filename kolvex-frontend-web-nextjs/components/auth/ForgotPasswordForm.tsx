"use client";

import { useState, useRef, type FormEvent } from "react";
import { resetPassword } from "@/lib/supabase/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import {
  AuthField,
  AuthFeedback,
  AuthSubmitButton,
  AuthBackLink,
  authDescription,
  localizedAuthError,
  validateAuthEmail,
} from "./AuthUI";

export default function ForgotPasswordForm() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fieldError, setFieldError] = useState<string>();
  const [error, setError] = useState<string>();
  const busy = useRef(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const invalid = validateAuthEmail(email, t);
    setFieldError(invalid);
    setError(undefined);
    if (invalid) {
      document.getElementById("email")?.focus();
      return;
    }
    busy.current = true;
    setIsLoading(true);
    try {
      const result = await resetPassword({ email: email.trim() });
      if (result.success) setIsSuccess(true);
      else setError(localizedAuthError(result.error, t));
    } catch {
      setError(t("auth.authError"));
    } finally {
      busy.current = false;
      setIsLoading(false);
    }
  }

  return (
    <div>
      {isSuccess ? (
        <div className="space-y-5">
          <AuthFeedback tone="success" message={t("auth.resetEmailSent")} />
          <p className="text-sm leading-6 text-muted-foreground">
            {t("auth.checkInbox")}
          </p>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full"
            onClick={() => {
              setIsSuccess(false);
              setEmail("");
              setFieldError(undefined);
              setError(undefined);
            }}
          >
            {t("auth.tryAnotherEmail")}
          </Button>
        </div>
      ) : (
        <form
          noValidate
          onSubmit={handleSubmit}
          className="flex flex-col gap-5"
          aria-busy={isLoading}
        >
          <AuthField id="email" label={t("auth.email")} error={fieldError}>
            <Input
              variant="auth"
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              disabled={isLoading}
              placeholder={t("auth.emailPlaceholder")}
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setFieldError(undefined);
                setError(undefined);
              }}
              aria-invalid={!!fieldError}
              aria-describedby={authDescription("email", fieldError)}
            />
          </AuthField>
          {error && <AuthFeedback message={error} />}
          <AuthSubmitButton busy={isLoading} busyLabel={t("auth.sending")}>
            {t("auth.sendResetLink")}
          </AuthSubmitButton>
        </form>
      )}
      <AuthBackLink />
    </div>
  );
}
