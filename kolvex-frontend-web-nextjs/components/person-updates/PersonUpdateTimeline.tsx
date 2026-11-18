"use client";

import { useState } from "react";
import { ArrowUpRight, Clock3 } from "lucide-react";
import { useCopy } from "@/components/decision/shared";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ListCard, listFeedStaticRowClass } from "@/components/ui/list-card";
import { PERSON_UPDATE_ZONES, personUpdateTime, type PersonUpdate } from "@/lib/personUpdates";
import { cn } from "@/lib/utils";

function UpdateImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  // The browser loads the HTTPS URL provided by the editor.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className="max-h-64 w-auto max-w-full rounded-2xl object-contain sm:max-h-80"
      onError={() => setFailed(true)}
    />
  );
}

function sourceHost(href: string) {
  try {
    return new URL(href).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

export function PersonUpdateTimeline({ items }: { items: PersonUpdate[] }) {
  const c = useCopy();
  const impactLabels = {
    high: c("High impact", "高影响"),
    medium: c("Medium impact", "中等影响"),
    low: c("Low impact", "低影响"),
  };

  return (
    <ListCard>
      <ol>
        {items.map((item) => (
          <li
            key={item.id}
            className={cn(listFeedStaticRowClass, "py-5 first:pt-1 last:pb-1 sm:px-2")}
          >
            <article className="space-y-3">
              <header className="flex items-start gap-3">
                <Avatar aria-hidden="true" className="size-10">
                  {item.avatar_url && (
                    <AvatarImage
                      src={item.avatar_url}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="object-cover"
                    />
                  )}
                  <AvatarFallback className="text-sm font-semibold text-foreground">
                    {Array.from(item.person_cn)[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-5">{item.person_cn}</p>
                  {item.person !== item.person_cn && (
                    <p className="text-xs leading-5 text-muted-foreground">{item.person}</p>
                  )}
                </div>
                <Badge variant={item.impact === "high" ? "warning" : "outline"} size="sm">
                  {impactLabels[item.impact]}
                </Badge>
              </header>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs leading-5 tabular-nums text-muted-foreground">
                {PERSON_UPDATE_ZONES.map(([zone, en, zh], index) => (
                  <time
                    key={zone}
                    dateTime={item.published_at}
                    className={cn(
                      "inline-flex items-center gap-1 whitespace-nowrap",
                      index === 0 && "font-medium text-foreground",
                    )}
                  >
                    {index === 0 && <Clock3 aria-hidden="true" className="size-3 shrink-0" />}
                    {personUpdateTime(item.published_at, c("en-US", "zh-CN"), zone)} {c(en, zh)}
                  </time>
                ))}
              </div>

              <h2 className="text-base font-semibold leading-snug sm:text-lg">{item.title}</h2>
              <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground">
                {item.summary}
              </p>
              {item.image_url && item.image_alt && (
                <UpdateImage key={item.image_url} src={item.image_url} alt={item.image_alt} />
              )}
              {(item.tags.length > 0 || item.tickers.length > 0) && (
                <ul
                  className="flex flex-wrap gap-1.5"
                  aria-label={c("Topics and tickers", "主题和股票代码")}
                >
                  {[...new Set(item.tags)].map((tag) => (
                    <li key={`tag:${tag}`} className="min-w-0">
                      <Badge
                        variant="outline"
                        size="sm"
                        className="block max-w-full text-muted-foreground"
                      >
                        {tag}
                      </Badge>
                    </li>
                  ))}
                  {[...new Set(item.tickers)].map((ticker) => (
                    <li key={`ticker:${ticker}`} className="min-w-0">
                      <Badge variant="outline" size="sm" className="block max-w-full font-mono">
                        {ticker}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
              <a
                href={item.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-sm text-sm font-medium underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                <span className="shrink-0">{c("Original source", "查看原文")}</span>
                <span className="min-w-0 truncate text-xs font-normal text-muted-foreground">
                  {sourceHost(item.source_url)}
                </span>
                <ArrowUpRight aria-hidden="true" className="size-4 shrink-0" />
              </a>
            </article>
          </li>
        ))}
      </ol>
    </ListCard>
  );
}
