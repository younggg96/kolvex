import * as React from "react";

export interface SeparatorProps {
  className?: string;
  orientation?: "horizontal" | "vertical";
}

export function Separator({
  className = "",
  orientation = "horizontal",
}: SeparatorProps) {
  return (
    <div
      className={`${
        orientation === "horizontal" ? "h-[1px] w-full" : "w-[1px] h-full"
      } bg-border-light dark:bg-border-dark ${className}`}
    />
  );
}
