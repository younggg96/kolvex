"use client";

import { useState, type CSSProperties } from "react";
import { cn, proxyImageUrl } from "@/lib/utils";

const sizeMap = {
  xs: "h-5 w-5 text-[10px]",
  sm: "h-7 w-7 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
  xl: "h-16 w-16 text-xl",
};

function hueOf(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.codePointAt(0)!) | 0;
  return Math.abs(hash) % 360;
}

export default function CreatorAvatar({
  name,
  avatarUrl,
  size = "md",
  className,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: keyof typeof sizeMap;
  className?: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const src = avatarUrl ? proxyImageUrl(avatarUrl) : "";
  const showImage = !!src && failedUrl !== src;
  const initial = Array.from(name.trim().replace(/^@/, ""))[0]?.toUpperCase() || "?";
  const hue = hueOf(name);
  return (
    <span
      aria-hidden="true"
      style={{ "--avatar-hue": hue } as CSSProperties}
      className={cn(
        "relative flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold ring-1 ring-inset ring-border/60",
        "[background-color:hsl(var(--avatar-hue)_45%_50%/0.16)] [color:hsl(var(--avatar-hue)_40%_38%)] dark:[color:hsl(var(--avatar-hue)_55%_74%)]",
        sizeMap[size],
        className,
      )}
    >
      {loadedUrl !== src && initial}
      {showImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onLoad={() => setLoadedUrl(src)}
          onError={() => setFailedUrl(src)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </span>
  );
}
