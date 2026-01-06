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
import type { DisconnectDialogProps } from "./types";

export function DisconnectDialog({
  open,
  onOpenChange,
  onDisconnect,
  disconnecting,
}: DisconnectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Disconnect Broker?</DialogTitle>
          <DialogDescription>
            This will remove the connection and delete all synced data.
            You&apos;ll need to reconnect to view holdings again.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={disconnecting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onDisconnect}
            disabled={disconnecting}
            className="gap-2"
          >
            {disconnecting && <Loader2 className="w-4 h-4 animate-spin" />}
            Disconnect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

