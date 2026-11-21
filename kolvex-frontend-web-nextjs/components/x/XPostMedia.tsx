"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { useCopy } from "@/components/decision/shared";
import type { XMediaAsset } from "@/lib/xContentApi";
import { cn } from "@/lib/utils";

const frame = "block overflow-hidden rounded-lg border border-border bg-muted";
const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";

function Attachment({
  asset,
  poster,
  source,
  tiled,
}: {
  asset: XMediaAsset | undefined;
  poster: XMediaAsset | undefined;
  source: string;
  tiled: boolean;
}) {
  const c = useCopy();
  const [failed, setFailed] = useState(false);
  const isVideo = asset?.kind === "video" || !!poster || source.includes("/video/");
  const originalLabel = isVideo
    ? c("Watch video on X", "在 X 观看视频")
    : c("View image on X", "在 X 查看图片");

  if (!failed && asset?.kind === "video") {
    return (
      <video
        controls
        playsInline
        preload="none"
        src={asset.url}
        poster={poster?.url}
        aria-label={c("Video from this post", "原帖视频")}
        className={cn(frame, "aspect-video w-full object-contain")}
        onError={() => setFailed(true)}
      />
    );
  }

  const image = asset?.kind === "image" ? asset : poster;
  if (!failed && image) {
    return (
      <a
        href={isVideo ? source : image.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={isVideo ? originalLabel : c("Open full image", "打开完整图片")}
        className={cn(frame, focus, "relative", tiled ? "aspect-[4/3] w-full" : "w-fit max-w-full")}
      >
        {/* Archived files load directly from Storage and already have an attachment limit. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.url}
          alt={image.alt || (isVideo ? "" : c("Image from this post", "原帖图片"))}
          loading="lazy"
          decoding="async"
          className={tiled ? "size-full object-cover" : "max-h-56 w-auto max-w-full object-contain"}
          onError={() => setFailed(true)}
        />
        {isVideo && (
          <span className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-background/90 px-2.5 py-2 text-xs font-medium text-foreground">
            <Play className="size-3.5" aria-hidden />
            {originalLabel}
          </span>
        )}
      </a>
    );
  }

  return (
    <a
      href={source}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        focus,
        "inline-flex min-h-11 items-center text-xs underline underline-offset-4",
      )}
    >
      {originalLabel}
    </a>
  );
}

export function XPostMedia({
  assets = [],
  sourceLinks,
}: {
  assets?: XMediaAsset[];
  sourceLinks: string[];
}) {
  const entries = new Map<string, { source: string; asset?: XMediaAsset; poster?: XMediaAsset }>();
  for (const source of sourceLinks) entries.set(source.toLowerCase(), { source });
  for (const asset of assets) {
    const key = asset.source_url.toLowerCase();
    const entry = entries.get(key) ?? { source: asset.source_url };
    if (asset.kind === "video_poster") entry.poster = asset;
    else entry.asset = asset;
    entries.set(key, entry);
  }
  if (!entries.size) return null;
  return (
    <div className={cn("mt-2.5 grid min-w-0 max-w-md gap-1.5", entries.size > 1 && "grid-cols-2")}>
      {[...entries.values()].map(({ source, asset, poster }) => (
        <Attachment
          key={`${source}:${asset?.key ?? ""}:${poster?.key ?? ""}`}
          source={source}
          asset={asset}
          poster={poster}
          tiled={entries.size > 1}
        />
      ))}
    </div>
  );
}
