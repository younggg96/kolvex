"use client";

import { useState, useEffect } from "react";
import { Heart, Bookmark, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/hooks";

interface PostActionsProps {
  postId: string;
  postUrl: string;
  liked?: boolean;
  favorited?: boolean;
  likesCount?: number;
  favoritesCount?: number;
}

export default function PostActions({
  postId,
  postUrl,
  liked: initialLiked = false,
  favorited: initialFavorited = false,
  likesCount = 0,
  favoritesCount = 0,
}: PostActionsProps) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(initialLiked);
  const [favorited, setFavorited] = useState(initialFavorited);
  const [isLiking, setIsLiking] = useState(false);
  const [isFavoriting, setIsFavoriting] = useState(false);
  const [localLikesCount, setLocalLikesCount] = useState(likesCount);
  const [localFavoritesCount, setLocalFavoritesCount] =
    useState(favoritesCount);

  // Update state when props change
  useEffect(() => {
    setLiked(initialLiked);
    setFavorited(initialFavorited);
    setLocalLikesCount(likesCount);
    setLocalFavoritesCount(favoritesCount);
  }, [initialLiked, initialFavorited, likesCount, favoritesCount]);

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!user) {
      toast.error("Please sign in to like posts");
      return;
    }

    setIsLiking(true);
    try {
      if (liked) {
        // Unlike
        const response = await fetch("/api/posts/like", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId }),
        });

        if (!response.ok) throw new Error("Failed to unlike");

        setLiked(false);
        setLocalLikesCount((prev) => Math.max(0, prev - 1));
        toast.success("Removed from likes");
      } else {
        // Like
        const response = await fetch("/api/posts/like", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId }),
        });

        if (!response.ok) throw new Error("Failed to like");

        setLiked(true);
        setLocalLikesCount((prev) => prev + 1);
        toast.success("Added to likes");
      }
    } catch (error) {
      console.error("Like error:", error);
      toast.error("Failed to update like status");
    } finally {
      setIsLiking(false);
    }
  };

  const handleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!user) {
      toast.error("Please sign in to favorite posts");
      return;
    }

    setIsFavoriting(true);
    try {
      if (favorited) {
        // Unfavorite
        const response = await fetch("/api/posts/favorite", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId }),
        });

        if (!response.ok) throw new Error("Failed to unfavorite");

        setFavorited(false);
        setLocalFavoritesCount((prev) => Math.max(0, prev - 1));
        toast.success("Removed from favorites");
      } else {
        // Favorite
        const response = await fetch("/api/posts/favorite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId }),
        });

        if (!response.ok) throw new Error("Failed to favorite");

        setFavorited(true);
        setLocalFavoritesCount((prev) => prev + 1);
        toast.success("Added to favorites");
      }
    } catch (error) {
      console.error("Favorite error:", error);
      toast.error("Failed to update favorite status");
    } finally {
      setIsFavoriting(false);
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Check out this post",
          url: postUrl,
        });
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(postUrl);
        toast.success("Link copied to clipboard");
      }
    } catch (error) {
      // User cancelled share or copy failed
      if (error instanceof Error && error.name !== "AbortError") {
        console.error("Share error:", error);
      }
    }
  };

  return (
    <div className="flex items-center gap-1">
      {/* Like Button */}
      <Button
        variant="ghost"
        size="xs"
        onClick={handleLike}
        disabled={isLiking}
        className={`h-7 gap-1.5 text-xs ${
          liked
            ? "text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
            : "text-gray-600 dark:text-white/60 hover:text-red-500 dark:hover:text-red-400"
        }`}
      >
        <Heart className={`w-3.5 h-3.5 ${liked ? "fill-current" : ""}`} />
        <span>{localLikesCount > 0 ? localLikesCount : ""}</span>
      </Button>

      {/* Favorite Button */}
      <Button
        variant="ghost"
        size="xs"
        onClick={handleFavorite}
        disabled={isFavoriting}
        className={`h-7 gap-1.5 text-xs ${
          favorited
            ? "text-yellow-500 hover:text-yellow-600 dark:text-yellow-400 dark:hover:text-yellow-300"
            : "text-gray-600 dark:text-white/60 hover:text-yellow-500 dark:hover:text-yellow-400"
        }`}
      >
        <Bookmark
          className={`w-3.5 h-3.5 ${favorited ? "fill-current" : ""}`}
        />
        <span>{localFavoritesCount > 0 ? localFavoritesCount : ""}</span>
      </Button>

      {/* Share Button */}
      <Button
        variant="ghost"
        size="xs"
        onClick={handleShare}
        className="h-7 gap-1.5 text-xs text-gray-600 dark:text-white/60 hover:text-primary dark:hover:text-primary"
      >
        <Share2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}
