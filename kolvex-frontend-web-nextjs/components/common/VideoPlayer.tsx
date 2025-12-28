"use client";

import { Play } from "lucide-react";
import { proxyImageUrl } from "@/lib/utils";

interface VideoPlayerProps {
  videoUrl: string;
  coverUrl?: string;
  permalink?: string;
  className?: string;
}

export default function VideoPlayer({
  videoUrl,
  coverUrl,
  permalink,
  className = "",
}: VideoPlayerProps) {
  // 如果是直接的视频文件（如 mp4），显示视频播放器
  const isDirectVideo = videoUrl.includes(".mp4") || videoUrl.includes(".webm");

  if (isDirectVideo) {
    return (
      <div className={`relative w-[120px] h-[120px] ${className}`}>
        <video
          src={videoUrl}
          controls
          className="w-full h-full rounded-lg object-cover"
        />
      </div>
    );
  }

  // 否则显示视频封面 + 播放按钮（链接到原始页面）
  return (
    <div
      className={`relative aspect-video rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 ${className}`}
    >
      {coverUrl ? (
        <img
          src={proxyImageUrl(coverUrl)}
          alt="Video cover"
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full bg-gray-200 dark:bg-gray-700" />
      )}
      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
        <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
          <Play className="w-6 h-6 text-rose-500 ml-1" />
        </div>
      </div>
      {permalink && (
        <a
          href={permalink}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute inset-0"
        />
      )}
    </div>
  );
}

