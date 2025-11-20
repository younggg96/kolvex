"use client";

import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

interface LiveButtonProps {
  isEnabled: boolean;
  onLiveToggle: (isLive: boolean) => void;
  className?: string;
}

export default function LiveButton({
  isEnabled,
  onLiveToggle,
  className,
}: LiveButtonProps) {
  const [isLive, setIsLive] = useState(false);

  const handleToggle = () => {
    if (!isEnabled) return;

    const newLiveState = !isLive;
    setIsLive(newLiveState);
    onLiveToggle(newLiveState);
  };

  // Reset live state when disabled
  useEffect(() => {
    if (!isEnabled && isLive) {
      setIsLive(false);
      onLiveToggle(false);
    }
  }, [isEnabled, isLive, onLiveToggle]);

  return (
    <Button
      variant={"ghost"}
      size="sm"
      onClick={handleToggle}
      disabled={!isEnabled}
      className={cn(
        "relative gap-1.5 transition-all duration-200",
        isLive && "text-primary hover:text-primary/90",
        !isEnabled && "opacity-50 cursor-not-allowed",
        className
      )}
      aria-label={isLive ? "Stop live updates" : "Start live updates"}
    >
      {isLive ? (
        <>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
          </span>
          <span className="text-xs font-bold">LIVE</span>
        </>
      ) : (
        <>
          <span className="relative flex h-2 w-2">
            <span className="relative inline-flex rounded-full h-2 w-2 bg-gray-400 dark:bg-gray-500"></span>
          </span>
          <span className="text-xs font-medium">LIVE</span>
        </>
      )}
    </Button>
  );
}
