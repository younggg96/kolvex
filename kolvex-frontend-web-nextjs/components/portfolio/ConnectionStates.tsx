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
    <div className="max-w-xl py-6 md:py-10">
      <h2 className="text-[28px] font-bold leading-tight md:text-[32px]">
        {t("portfolio.connect.title")}
      </h2>
      <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-muted-foreground">
        {t("portfolio.connect.description")}
      </p>

      <ul className="mt-8 divide-y divide-border border-y border-border">
        <li className="flex items-start gap-3 py-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-foreground" />
          <div>
            <h3 className="text-[15px] font-semibold">
              {t("portfolio.connect.plaidTitle")}
            </h3>
            <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
              {t("portfolio.connect.plaidDescription")}
            </p>
          </div>
        </li>
        <li className="flex flex-wrap gap-x-6 gap-y-2 py-4 text-[13px] text-muted-foreground">
          {(["secure", "readOnly", "encrypted"] as const).map((key) => (
            <span key={key} className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-positive" />
              {t(`portfolio.connect.${key}`)}
            </span>
          ))}
        </li>
      </ul>

      <Button
        size="lg"
        onClick={onConnectPlaid}
        disabled={connecting}
        className="mt-8 gap-2"
      >
        {connecting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Link2 className="h-4 w-4" />
        )}
        {connecting
          ? t("portfolio.connect.connecting")
          : t("portfolio.connect.connectPlaid")}
      </Button>
    </div>
  );
}

export function InitialSyncState({ onSync, syncing }: InitialSyncStateProps) {
  const { t } = useTranslation();

  return (
    <div className="max-w-xl py-6 md:py-10">
      <h2 className="flex items-center gap-2 text-[28px] font-bold leading-tight md:text-[32px]">
        <Check className="h-7 w-7 shrink-0 text-positive" strokeWidth={2.5} />
        {t("portfolio.connect.connectedTitle")}
      </h2>
      <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-muted-foreground">
        {t("portfolio.connect.connectedDescription")}
      </p>
      <Button
        size="lg"
        onClick={onSync}
        disabled={syncing}
        className="mt-8 gap-2"
      >
        {syncing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        {syncing
          ? t("portfolio.connect.syncing")
          : t("portfolio.connect.syncPositions")}
      </Button>
    </div>
  );
}
