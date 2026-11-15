import { cache } from "react";
import type { CreatorLatestVideo } from "@/lib/youtubeOpinionsApi";
import { PUBLIC_CONTENT_REVALIDATE_SECONDS, PUBLIC_CONTENT_TAG } from "@/lib/publicContent";
import { BACKEND_API_URL } from "@/lib/config/backend";

/** The existing public opinion API returns only source/creator fields for this view. */
export const getPublicCreatorOpinions = cache(
  async (channelId: string): Promise<CreatorLatestVideo> => {
    if (!channelId || channelId.length > 128 || /[\x00-\x1f/\\?#]/.test(channelId)) {
      return { creator: null, video: null, opinions: [] };
    }
    const response = await fetch(
      `${BACKEND_API_URL}/api/v1/youtube-opinions/creators/${encodeURIComponent(channelId)}/latest-video`,
      {
        next: { revalidate: PUBLIC_CONTENT_REVALIDATE_SECONDS, tags: [PUBLIC_CONTENT_TAG] },
      },
    );
    if (!response.ok) throw new Error("Public creator opinions are unavailable");
    return response.json();
  },
);
