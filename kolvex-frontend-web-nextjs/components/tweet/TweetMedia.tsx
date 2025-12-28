"use client";

import ImageGallery from "@/components/common/ImageGallery";
import VideoPlayer from "@/components/common/VideoPlayer";

interface TweetMediaProps {
  mediaUrls: string[];
}

export default function TweetMedia({ mediaUrls }: TweetMediaProps) {
  if (mediaUrls.length === 0) return null;

  // 分离图片和视频
  const imageUrls = mediaUrls.filter(
    (url) => !url.includes(".mp4") && !url.includes(".webm")
  );
  const videoUrls = mediaUrls.filter(
    (url) => url.includes(".mp4") || url.includes(".webm")
  );

  return (
    <div className="space-y-2 mb-3">
      {/* 图片 */}
      {imageUrls.length > 0 && <ImageGallery imageUrls={imageUrls} />}

      {/* 视频 */}
      {videoUrls.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {videoUrls.map((url, index) => (
            <VideoPlayer key={index} videoUrl={url} />
          ))}
        </div>
      )}
    </div>
  );
}
