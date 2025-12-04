"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { trackKOL, untrackKOL } from "@/lib/trackedKolApi";
import type { Platform } from "@/lib/supabase/database.types";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import KOLHoverCard from "./KOLHoverCard";

interface TweetHeaderProps {
  screenName: string;
  createdAt: string;
  profileImageUrl?: string;
  onFormatDate: (dateString: string) => string;
  initialTracked?: boolean;
  onTrackChange?: (tracked: boolean) => void;
  kolId?: string;
  platform?: Platform;
}

export default function TweetHeader({
  screenName,
  createdAt,
  profileImageUrl,
  onFormatDate,
  initialTracked = false,
  onTrackChange,
  kolId,
  platform,
}: TweetHeaderProps) {
  const [isTracking, setIsTracking] = useState(initialTracked);
  const [isLoading, setIsLoading] = useState(false);

  // Update state when initialTracked prop changes
  useEffect(() => {
    setIsTracking(initialTracked);
  }, [initialTracked]);

  const handleTrackToggle = async () => {
    // If no kolId or platform, just toggle state locally
    if (!kolId || !platform) {
      const newTrackingState = !isTracking;
      setIsTracking(newTrackingState);
      onTrackChange?.(newTrackingState);
      return;
    }

    setIsLoading(true);

    try {
      if (isTracking) {
        // Untrack
        await untrackKOL(kolId, platform);
        setIsTracking(false);
        onTrackChange?.(false);
        toast.success(`Untracked ${screenName}`);
      } else {
        // Track
        await trackKOL({
          kol_id: kolId,
          platform,
          notify: true,
        });
        setIsTracking(true);
        onTrackChange?.(true);
        toast.success(`Now tracking ${screenName}`);
      }
    } catch (error: any) {
      console.error("Error toggling track status:", error);
      toast.error(error.message || "Failed to update tracking status");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3 mb-3">
      <KOLHoverCard
        kolId={kolId}
        screenName={screenName}
        profileImageUrl={profileImageUrl}
      >
        {profileImageUrl ? (
          <Image
            src={profileImageUrl}
            alt={screenName}
            width={32}
            height={32}
            className="w-8 h-8 rounded-full flex-shrink-0 cursor-pointer"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-white text-xs font-bold flex-shrink-0 cursor-pointer">
            {screenName.substring(0, 2).toUpperCase()}
          </div>
        )}
      </KOLHoverCard>

      <div className="flex-1 min-w-0 flex items-center gap-3">
        <div className="font-bold text-sm text-gray-900 dark:text-white flex items-center">
          <KOLHoverCard
            kolId={kolId}
            screenName={screenName}
            profileImageUrl={profileImageUrl}
          >
            <span className="hover:underline cursor-pointer">{screenName}</span>
          </KOLHoverCard>
          <span className="text-gray-500 dark:text-white/50 font-normal text-xs ml-1">
            @{screenName.toLowerCase()} · {onFormatDate(createdAt)}
          </span>
        </div>
        <Button
          variant={isTracking ? "default" : "outline"}
          size="xs"
          onClick={handleTrackToggle}
          disabled={isLoading}
          className={
            isTracking
              ? "bg-primary hover:bg-primary/90 text-white dark:text-white"
              : "border-gray-300 dark:border-white/20 hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-white/50"
          }
        >
          {isLoading ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin mr-1" />
              <span>{isTracking ? "Untracking..." : "Tracking..."}</span>
            </>
          ) : (
            <span>{isTracking ? "Tracking" : "Track"}</span>
          )}
        </Button>
      </div>
    </div>
  );
}
