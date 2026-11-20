"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCopy } from "@/components/decision/shared";
import type { ShareCard, ShareTarget } from "@/lib/contentShare";
import { ShareDialog } from "./ShareDialog";

/** One share entry point for every surface; `icon` keeps dense cards quiet. */
export function ShareButton({
  target,
  preview,
  icon = false,
  className,
  size,
  variant,
}: {
  target: ShareTarget;
  preview?: ShareCard;
  icon?: boolean;
  className?: string;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
}) {
  const c = useCopy();
  const [open, setOpen] = useState(false);
  const label = c("Share", "分享");
  return (
    <>
      <Button
        type="button"
        variant={variant ?? "ghost"}
        size={size ?? (icon ? "icon" : "xs")}
        aria-label={icon ? label : undefined}
        title={icon ? label : undefined}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
        className={cn(
          icon ? "h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground" : "gap-1.5",
          className,
        )}
      >
        <Share2 className={icon ? "h-4 w-4" : "h-3.5 w-3.5"} aria-hidden="true" />
        {!icon && <span>{label}</span>}
      </Button>
      {open && <ShareDialog open={open} onOpenChange={setOpen} target={target} preview={preview} />}
    </>
  );
}
