"use client";

import { useState } from "react";
import { UserPlus, UserMinus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { followUser, unfollowUser } from "@/lib/followApi";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface FollowButtonProps {
  userId: string;
  initialIsFollowing?: boolean;
  onFollowChange?: (isFollowing: boolean) => void;
  size?: "sm" | "default" | "lg" | "icon";
  className?: string;
  showIcon?: boolean;
  showText?: boolean;
}

export function FollowButton({
  userId,
  initialIsFollowing = false,
  onFollowChange,
  size = "sm",
  className,
  showIcon = true,
  showText = true,
}: FollowButtonProps) {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [isLoading, setIsLoading] = useState(false);

  // Don't show follow button for own profile
  if (user?.id === userId) {
    return null;
  }

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    // Redirect to login if not authenticated
    if (!isAuthenticated) {
      router.push("/auth");
      return;
    }

    setIsLoading(true);
    try {
      if (isFollowing) {
        await unfollowUser(userId);
        setIsFollowing(false);
        onFollowChange?.(false);
      } else {
        await followUser(userId);
        setIsFollowing(true);
        onFollowChange?.(true);
      }
    } catch (error) {
      console.error("Failed to update follow status:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant={isFollowing ? "default" : "outline"}
      size={size}
      onClick={handleClick}
      disabled={isLoading}
      className={cn(
        "flex items-center gap-1 transition-colors border-border-light dark:border-border-dark",
        isFollowing
          ? "text-primary border-primary/50 hover:bg-red-50 hover:text-red-600 hover:border-red-300 dark:hover:bg-red-500/10 dark:hover:text-red-400 dark:hover:border-red-500/50"
          : "text-gray-400 dark:text-white/40 group-hover:text-primary group-hover:border-primary dark:group-hover:border-primary/60 group-hover:!bg-primary/10",
        className
      )}
    >
      {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {showText && (
        <span className="text-xs">{isFollowing ? "Following" : "Follow"}</span>
      )}
    </Button>
  );
}
