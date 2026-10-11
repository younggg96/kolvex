"use client";

import { useState, useRef, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { getAuthRedirect } from "@/lib/supabase/redirect";
import { signUp, signIn, signInWithGoogle } from "@/lib/supabase/auth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useTranslation } from "@/lib/i18n";
import {
  AuthField,
  AuthFeedback,
  AuthSubmitButton,
  authDescription,
  localizedAuthError,
  validateAuthEmail,
} from "./AuthUI";

type AuthMode = "login" | "signup";
type FieldErrors = { email?: string; password?: string; name?: string };
interface AuthFormProps {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
}

export default function AuthForm({ mode, onModeChange }: AuthFormProps) {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [feedback, setFeedback] = useState<{
    message: string;
    tone: "error" | "success";
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const busyRef = useRef(false);
  const busy = isLoading || isGoogleLoading;
  const redirectTo = getAuthRedirect(searchParams.get("redirectTo"));
  const emailId = `email-${mode}`;
  const passwordId = `password-${mode}`;

  function changeMode(value: string) {
    if (busyRef.current) return;
    setErrors({});
    setFeedback(null);
    onModeChange(value as AuthMode);
  }
  function clearError(field: keyof FieldErrors) {
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFeedback(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current) return;
    const next: FieldErrors = { email: validateAuthEmail(email, t) };
    if (mode === "signup" && !name.trim()) next.name = t("auth.enterName");
    if (!password) next.password = t("auth.passwordRequired");
    else if (mode === "signup" && password.length < 6)
      next.password = t("auth.passwordMinimum");
    setErrors(next);
    setFeedback(null);
    const first =
      mode === "signup" && next.name
        ? "name"
        : next.email
          ? emailId
          : next.password
            ? passwordId
            : null;
    if (first) {
      document.getElementById(first)?.focus();
      return;
    }
    busyRef.current = true;
    setIsLoading(true);
    let redirecting = false;
    try {
      const result =
        mode === "login"
          ? await signIn({ email: email.trim(), password })
          : await signUp({ email: email.trim(), password, name: name.trim() });
      if (!result.success)
        setFeedback({
          message: localizedAuthError(result.error, t),
          tone: "error",
        });
      else if (mode === "login") {
        toast.success(t("auth.loginSuccess"));
        redirecting = true;
        // Fetch a fresh document with the new cookies, bypassing routes cached
        // before login (including their unauthenticated redirects).
        window.location.replace(redirectTo);
      } else
        setFeedback({ message: t("auth.accountCreated"), tone: "success" });
    } catch {
      setFeedback({ message: t("auth.authError"), tone: "error" });
    } finally {
      if (!redirecting) {
        busyRef.current = false;
        setIsLoading(false);
      }
    }
  }

  async function handleGoogleSignIn() {
    if (busyRef.current) return;
    busyRef.current = true;
    setIsGoogleLoading(true);
    setFeedback(null);
    try {
      const result = await signInWithGoogle(redirectTo);
      if (!result.success) {
        setFeedback({
          message: localizedAuthError(result.error, t),
          tone: "error",
        });
        busyRef.current = false;
        setIsGoogleLoading(false);
      }
    } catch {
      setFeedback({ message: t("auth.googleSignInFailed"), tone: "error" });
      busyRef.current = false;
      setIsGoogleLoading(false);
    }
  }

  return (
    <Tabs value={mode} onValueChange={changeMode}>
      <TabsList
        aria-label={t("auth.modeLabel")}
        variant="auth"
        className="mb-6"
      >
        <TabsTrigger
          value="login"
          disabled={busy}
          className="py-3 disabled:opacity-50"
        >
          {t("auth.signIn")}
        </TabsTrigger>
        <TabsTrigger
          value="signup"
          disabled={busy}
          className="py-3 disabled:opacity-50"
        >
          {t("auth.signUp")}
        </TabsTrigger>
      </TabsList>
      <TabsContent value={mode} className="outline-none">
        <form
          noValidate
          onSubmit={handleSubmit}
          className="flex flex-col gap-5"
          aria-busy={isLoading}
        >
          {mode === "signup" && (
            <AuthField id="name" label={t("auth.name")} error={errors.name}>
              <Input
                variant="auth"
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                disabled={busy}
                placeholder={t("auth.namePlaceholder")}
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  clearError("name");
                }}
                aria-invalid={!!errors.name}
                aria-describedby={authDescription("name", errors.name)}
              />
            </AuthField>
          )}
          <AuthField id={emailId} label={t("auth.email")} error={errors.email}>
            <Input
              variant="auth"
              id={emailId}
              name={emailId}
              type="email"
              autoComplete={mode === "login" ? "username" : "email"}
              autoCapitalize="none"
              spellCheck={false}
              required
              disabled={busy}
              placeholder={t("auth.emailPlaceholder")}
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                clearError("email");
              }}
              aria-invalid={!!errors.email}
              aria-describedby={authDescription(emailId, errors.email)}
            />
          </AuthField>
          <AuthField
            id={passwordId}
            label={t("auth.password")}
            error={errors.password}
            hint={mode === "signup" ? t("auth.passwordMinimum") : undefined}
          >
            <PasswordInput
              key={passwordId}
              variant="auth"
              id={passwordId}
              name={passwordId}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              required
              minLength={mode === "signup" ? 6 : undefined}
              disabled={busy}
              placeholder={t(
                mode === "login"
                  ? "auth.passwordPlaceholder"
                  : "auth.newPasswordPlaceholder",
              )}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                clearError("password");
              }}
              aria-invalid={!!errors.password}
              aria-describedby={authDescription(
                passwordId,
                errors.password,
                mode === "signup",
              )}
            />
          </AuthField>
          {mode === "login" && (
            <Link
              href="/auth/forgot-password"
              className="-mt-2 self-end rounded-sm text-sm font-medium text-positive underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/60"
            >
              {t("auth.forgotPassword")}
            </Link>
          )}
          {feedback && <AuthFeedback {...feedback} />}
          <AuthSubmitButton
            busy={isLoading}
            disabled={isGoogleLoading}
            busyLabel={t(
              mode === "login" ? "auth.signingIn" : "auth.signingUp",
            )}
          >
            {t(mode === "login" ? "auth.signIn" : "auth.createAccount")}
          </AuthSubmitButton>
        </form>
        <div className="my-6 flex items-center gap-4" aria-hidden="true">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">{t("auth.or")}</span>
          <div className="h-px flex-1 bg-border" />
        </div>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={handleGoogleSignIn}
          disabled={busy}
          aria-busy={isGoogleLoading}
          className="w-full gap-3"
        >
          <Image
            src="/logo/google.svg"
            alt=""
            width={20}
            height={20}
            className="h-5 w-5"
          />
          <span role={isGoogleLoading ? "status" : undefined}>
            {t(isGoogleLoading ? "auth.connecting" : "auth.continueWithGoogle")}
          </span>
        </Button>
      </TabsContent>
    </Tabs>
  );
}
