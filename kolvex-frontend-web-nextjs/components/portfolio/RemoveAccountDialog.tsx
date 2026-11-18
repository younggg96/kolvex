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

interface RemoveAccountDialogProps {
  account: { name: string; source?: string } | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  removing: boolean;
}

export function RemoveAccountDialog({
  account,
  onOpenChange,
  onConfirm,
  removing,
}: RemoveAccountDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={account !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {t("portfolio.holdings.removeAccountTitle", { name: account?.name ?? "" })}
          </DialogTitle>
          <DialogDescription>
            {account?.source === "manual"
              ? t("portfolio.holdings.removeAccountDescriptionManual")
              : t("portfolio.holdings.removeAccountDescription")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={removing}>
            {t("common.cancel")}
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={removing} className="gap-2">
            {removing && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("portfolio.holdings.removeAccountConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
