"use client";

import React from "react";
import { Check, Loader2, RefreshCw, Link2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import type { ConnectionStateProps, InitialSyncStateProps } from "./types";

export function NotConnectedState({
  onConnectPlaid,
  connecting,
}: ConnectionStateProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-xl w-full space-y-8 p-8 text-center">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Link2 className="w-8 h-8 text-primary" />
        </div>
        <div className="space-y-3">
          <h2 className="text-2xl font-bold">
            {t("portfolio.connect.title")}
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {t("portfolio.connect.description")}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 space-y-4 text-left">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">
                {t("portfolio.connect.plaidTitle")}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                {t("portfolio.connect.plaidDescription")}
              </p>
            </div>
          </div>
          <Button
            size="lg"
            onClick={onConnectPlaid}
            disabled={connecting}
            className="w-full gap-2"
          >
            {connecting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Link2 className="w-4 h-4" />
            )}
            {connecting
              ? t("portfolio.connect.connecting")
              : t("portfolio.connect.connectPlaid")}
          </Button>
        </div>

        <div className="flex justify-center gap-6 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Check className="w-3 h-3 text-green-500" />{" "}
            {t("portfolio.connect.secure")}
          </span>
          <span className="flex items-center gap-1.5">
            <Check className="w-3 h-3 text-green-500" />{" "}
            {t("portfolio.connect.readOnly")}
          </span>
          <span className="flex items-center gap-1.5">
            <Check className="w-3 h-3 text-green-500" />{" "}
            {t("portfolio.connect.encrypted")}
          </span>
        </div>
      </div>
    </div>
  );
}

export function InitialSyncState({ onSync, syncing }: InitialSyncStateProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-md w-full text-center space-y-8 p-8">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center">
          <Check className="w-8 h-8 text-green-500" />
        </div>
        <div className="space-y-3">
          <h2 className="text-2xl font-bold">
            {t("portfolio.connect.connectedTitle")}
          </h2>
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
          {syncing
            ? t("portfolio.connect.syncing")
            : t("portfolio.connect.syncPositions")}
        </Button>
      </div>
    </div>
  );
}
