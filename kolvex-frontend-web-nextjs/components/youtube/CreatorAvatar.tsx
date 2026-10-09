"use client";

import { useState } from "react";
import { cn, proxyImageUrl } from "@/lib/utils";

export default function CreatorAvatar({
  name,
  avatarUrl,
  className,
}: {
  name: string;
  avatarUrl?: string | null;
  className?: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const src = avatarUrl ? proxyImageUrl(avatarUrl) : "";
  return (
    <span aria-hidden="true" className={cn("relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-xs font-semibold text-muted-foreground", className)}>
      {name.trim().slice(0, 1).toUpperCase() || "?"}
      {src && failedUrl !== src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" onError={() => setFailedUrl(src)} className="absolute inset-0 h-full w-full object-cover" />
      )}
    </span>
  );
}
