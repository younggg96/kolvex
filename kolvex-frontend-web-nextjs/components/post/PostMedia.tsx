"use client";

import ImageGallery from "@/components/common/ImageGallery";
import { MediaItem } from "@/lib/kolPostsApi";

interface PostMediaProps {
  mediaItems: MediaItem[];
}

/**
 * PostMedia - Renders media items (photos, videos, gifs) from a post.
 *
 * For videos without a direct playable URL, we display the poster/thumbnail
 * as an image in the gallery. Clicking opens the same details modal as photos.
 */
export default function PostMedia({ mediaItems }: PostMediaProps) {
  if (mediaItems.length === 0) return null;

  // Extract displayable image URLs from all media items:
  // - photo/card: use `url`
  // - video/gif: use `poster` only (video file URLs like .mp4 cannot be rendered by next/image)
  const displayUrls = mediaItems
    .map((item) => {
      if (item.type === "video" || item.type === "gif") {
        return item.poster || null;
      }
      return item.url;
    })
    .filter((url): url is string => !!url);

  if (displayUrls.length === 0) return null;

  return (
    <div className="space-y-2 mb-3">
      <ImageGallery imageUrls={displayUrls} />
    </div>
  );
}
