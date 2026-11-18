"use client";

import { useState } from "react";
import { useCopy } from "@/components/decision/shared";
import { PERSON_UPDATE_ZONES, personUpdateTime, type PersonUpdate } from "@/lib/personUpdates";

function UpdateImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  // Admin-supplied HTTPS images are fetched by the browser directly.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className="max-h-80 w-auto max-w-full rounded-xl object-contain"
      onError={() => setFailed(true)}
    />
  );
}

export function PersonUpdateTimeline({ items }: { items: PersonUpdate[] }) {
  const c = useCopy();
  return (
    <ol className="divide-y divide-border border-y border-border">
      {items.map((item) => (
        <li key={item.id}>
          <article className="grid gap-3 py-6 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-6">
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs tabular-nums text-muted-foreground sm:flex-col">
              {PERSON_UPDATE_ZONES.map(([zone, en, zh], index) => (
                <time
                  key={zone}
                  dateTime={item.published_at}
                  className={index === 0 ? "font-semibold text-foreground" : undefined}
                >
                  {personUpdateTime(item.published_at, c("en-US", "zh-CN"), zone)} {c(en, zh)}
                </time>
              ))}
            </div>
            <div className="min-w-0 space-y-3 break-words">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                <span className="font-semibold">{item.person_cn}</span>
                <span className="text-muted-foreground">
                  {
                    {
                      high: c("High impact", "高影响"),
                      medium: c("Medium impact", "中等影响"),
                      low: c("Low impact", "低影响"),
                    }[item.impact]
                  }
                </span>
              </div>
              <h2 className="text-lg font-semibold leading-snug">{item.title}</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {item.summary}
              </p>
              {item.image_url && item.image_alt && (
                <UpdateImage key={item.image_url} src={item.image_url} alt={item.image_alt} />
              )}
              <a
                href={item.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-8 items-center text-sm font-medium underline underline-offset-4"
              >
                {c("Original source", "查看原文")}
              </a>
            </div>
          </article>
        </li>
      ))}
    </ol>
  );
}
