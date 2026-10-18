"use client";

import { useState } from "react";
import type { BriefImage as ImageData } from "@/lib/dailyBriefs";

export function BriefImageMedia({ image }: { image: ImageData }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="relative aspect-video overflow-hidden bg-muted">
      {failed ? (
        <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm leading-6 text-muted-foreground">{image.caption}</p>
      ) : (
        // Editorial imports retain the supplied image host and original URL.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image.url} alt={image.caption} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="h-full w-full object-cover" />
      )}
    </div>
  );
}

export default function BriefImage({ image }: { image: ImageData }) {
  return (
    <figure className="overflow-hidden rounded-xl border border-border">
      <BriefImageMedia key={image.url} image={image} />
      <figcaption className="flex flex-wrap items-start justify-between gap-2 bg-card px-3 py-2 text-xs leading-5 text-muted-foreground">
        <span>{image.caption}</span>
        <a href={image.source_page} target="_blank" rel="noopener noreferrer" className="shrink-0 underline underline-offset-4 focus-visible:outline focus-visible:outline-2">{image.credit}</a>
      </figcaption>
    </figure>
  );
}
