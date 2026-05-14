"use client";

import React, { useState } from "react";
import {
  Link2,
  Check,
  Loader2,
  RefreshCw,
  ShieldCheck,
  KeyRound,
  Landmark,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/lib/i18n";
import type { ConnectionStateProps, InitialSyncStateProps } from "./types";

/**
 * State when user has not connected their broker yet
 */
export function NotConnectedState({
  onConnect,
  onConnectRobinhood,
  connecting,
}: ConnectionStateProps) {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [totpSecret, setTotpSecret] = useState("");

  const canConnectRobinhood = username.trim().length > 0 && password.length > 0;

  const handleRobinhoodSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canConnectRobinhood) return;
    await onConnectRobinhood({
      username: username.trim(),
      password,
      totp_secret: totpSecret.trim() || undefined,
    });
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-3xl w-full space-y-8 p-8">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
          <Link2 className="w-8 h-8 text-primary" />
        </div>
        <div className="space-y-3 text-center">
          <h2 className="text-2xl font-bold">{t("portfolio.connect.title")}</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {t("portfolio.connect.description")}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <ShieldCheck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">{t("portfolio.connect.snaptradeTitle")}</h3>
                <p className="text-xs text-muted-foreground">
                  {t("portfolio.connect.snaptradeDescription")}
                </p>
              </div>
            </div>
            <Button
              size="lg"
              onClick={onConnect}
              disabled={connecting}
              className="w-full gap-2"
            >
              {connecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
              {connecting ? t("portfolio.connect.connecting") : t("portfolio.connect.connectBroker")}
            </Button>
          </div>

          <form
            onSubmit={handleRobinhoodSubmit}
            className="rounded-lg border border-border bg-card p-4 space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Landmark className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <h3 className="font-semibold">{t("portfolio.connect.robinhoodTitle")}</h3>
                <p className="text-xs text-muted-foreground">
                  {t("portfolio.connect.robinhoodDescription")}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                placeholder={t("portfolio.connect.robinhoodUsername")}
                disabled={connecting}
              />
              <Input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                autoComplete="current-password"
                placeholder={t("portfolio.connect.robinhoodPassword")}
                disabled={connecting}
              />
              <Input
                value={totpSecret}
                onChange={(event) => setTotpSecret(event.target.value)}
                autoComplete="one-time-code"
                placeholder={t("portfolio.connect.robinhoodTotp")}
                disabled={connecting}
              />
            </div>
            <Button
              type="submit"
              size="lg"
              disabled={connecting || !canConnectRobinhood}
              className="w-full gap-2"
            >
              {connecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <KeyRound className="w-4 h-4" />
              )}
              {connecting ? t("portfolio.connect.connecting") : t("portfolio.connect.connectRobinhood")}
            </Button>
          </form>
        </div>

        <div className="flex justify-center gap-6 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Check className="w-3 h-3 text-green-500" /> {t("portfolio.connect.secure")}
          </span>
          <span className="flex items-center gap-1.5">
            <Check className="w-3 h-3 text-green-500" /> {t("portfolio.connect.readOnly")}
          </span>
          <span className="flex items-center gap-1.5">
            <Check className="w-3 h-3 text-green-500" /> {t("portfolio.connect.encrypted")}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * State when broker is connected but data hasn't been synced yet
 */
export function InitialSyncState({ onSync, syncing }: InitialSyncStateProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-md w-full text-center space-y-8 p-8">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500/20 to-green-500/5 flex items-center justify-center">
          <Check className="w-8 h-8 text-green-500" />
        </div>
        <div className="space-y-3">
          <h2 className="text-2xl font-bold">{t("portfolio.connect.connectedTitle")}</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {t("portfolio.connect.connectedDescription")}
          </p>
        </div>
        <Button
          size="lg"
          onClick={onSync}
          disabled={syncing}
          className="w-full gap-2"
        >
          {syncing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          {syncing ? t("portfolio.connect.syncing") : t("portfolio.connect.syncPositions")}
        </Button>
      </div>
    </div>
  );
}
