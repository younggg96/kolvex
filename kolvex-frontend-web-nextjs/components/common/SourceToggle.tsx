"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SearchSource = "kol" | "news" | "web";

interface SourceToggleProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

export function SourceToggle({
  icon,
  label,
  active = false,
  onClick,
}: SourceToggleProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      onClick={onClick}
      className={cn(
        "gap-1.5 text-xs font-medium",
        active
          ? "bg-primary/15 text-primary border border-primary/30 hover:bg-primary/20"
          : "text-gray-500 dark:text-white/50 hover:text-gray-700 dark:hover:text-white/80"
      )}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}

