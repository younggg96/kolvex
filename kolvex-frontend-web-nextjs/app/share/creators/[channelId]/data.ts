import { cache } from "react";
import type { CreatorLatestVideo } from "@/lib/youtubeOpinionsApi";

/** The existing public opinion API returns only source/creator fields for this view. */
export const getPublicCreatorOpinions = cache(async (channelId: string): Promise<CreatorLatestVideo> => {
  if (!channelId || channelId.length > 128 || /[\x00-\x1f/\\?#]/.test(channelId)) {
    return { creator: null, video: null, opinions: [] };
  }
  const backend = process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8080";
  const response = await fetch(`${backend}/api/v1/youtube-opinions/creators/${encodeURIComponent(channelId)}/latest-video`, { cache: "no-store" });
  if (!response.ok) throw new Error("Public creator opinions are unavailable");
  return response.json();
});
