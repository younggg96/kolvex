"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type SearchSource = "kol" | "news" | "web";

interface SourceToggleProps {
  icon: React.ReactNode;
  label: string;
  tooltip?: string;
  active?: boolean;
  onClick?: () => void;
}

export function SourceToggle({
  icon,
  label,
  tooltip,
  active = false,
  onClick,
}: SourceToggleProps) {
  const button = (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      onClick={onClick}
      className={cn(
        "gap-1.5 text-xs font-medium rounded-lg",
        active
          ? "bg-primary/15 text-primary border border-primary/30 hover:bg-primary/20"
          : "text-gray-500 dark:text-white/50 hover:text-gray-700 dark:hover:text-white/80 hover:bg-gray-100 dark:hover:bg-white/10"
      )}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );

  if (tooltip) {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
}

