"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n";
import type { DisconnectDialogProps } from "./types";

export function DisconnectDialog({
  open,
  onOpenChange,
  onDisconnect,
  disconnecting,
}: DisconnectDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("portfolio.disconnectDialog.title")}</DialogTitle>
          <DialogDescription>
            {t("portfolio.disconnectDialog.description")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={disconnecting}
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={onDisconnect}
            disabled={disconnecting}
            className="gap-2"
          >
            {disconnecting && <Loader2 className="w-4 h-4 animate-spin" />}
            {t("portfolio.disconnectDialog.disconnect")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
