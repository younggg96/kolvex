"use client";

import { useState } from "react";
import { ShareButton } from "@/components/share/ShareButton";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { useCopy } from "@/components/decision/shared";
import { Badge } from "@/components/ui/badge";
import { ListCard, listFeedStaticRowClass } from "@/components/ui/list-card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import StockBadge from "@/components/ui/stock-badge";
import {
  isFedOfficial,
  personAvatar,
  PERSON_UPDATE_ZONES,
  personUpdateTime,
  type PersonUpdate,
} from "@/lib/personUpdates";
import { normalizeStockSymbol } from "@/lib/stockLinks";
import { cn } from "@/lib/utils";
import { PersonUpdateAvatar } from "./PersonUpdateAvatar";

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

function UpdateTime({ person, publishedAt }: { person: string; publishedAt: string }) {
  const c = useCopy();
  const locale = c("en-US", "zh-CN");
  const label = c("Publication time zones", "发布时间与时区");
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group min-h-[44px] min-w-0 cursor-pointer rounded-md text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          <span className="block truncate text-sm font-semibold leading-5">{person}</span>
          <span className="flex items-center gap-1 text-xs tabular-nums text-muted-foreground group-hover:text-foreground">
            <time dateTime={publishedAt}>
              {personUpdateTime(publishedAt, locale, PERSON_UPDATE_ZONES[0][0])} PT
            </time>
            <ChevronDown aria-hidden="true" className="size-3 shrink-0" />
          </span>
          <span className="sr-only">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        aria-label={label}
        className="max-w-[calc(100vw-2rem)] rounded-xl px-3 py-2 motion-reduce:animate-none"
      >
        <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1.5 text-xs leading-5">
          {PERSON_UPDATE_ZONES.map(([zone, en, zh]) => (
            <div key={zone} className="contents">
              <dt className="text-muted-foreground">{c(en, zh)}</dt>
              <dd className="text-right tabular-nums">
                <time dateTime={publishedAt}>{personUpdateTime(publishedAt, locale, zone)}</time>
              </dd>
            </div>
          ))}
        </dl>
      </PopoverContent>
    </Popover>
  );
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
            className={cn(listFeedStaticRowClass, "py-3 first:pt-0 last:pb-0 sm:px-2")}
          >
            <article className="space-y-2">
              <header className="flex min-w-0 items-center gap-2.5">
                <PersonUpdateAvatar
                  label={item.person_cn}
                  src={personAvatar(item)}
                  fedOfficial={isFedOfficial(item)}
                  className="size-9"
                />
                <UpdateTime
                  person={c(item.person, item.person_cn)}
                  publishedAt={item.published_at}
                />
                <Badge
                  variant={item.impact === "high" ? "warning" : "outline"}
                  size="sm"
                  className="ml-auto shrink-0"
                >
                  {impactLabels[item.impact]}
                </Badge>
                <ShareButton
                  icon
                  target={{ kind: "person_update", sourceId: item.id }}
                  className="-mr-2"
                />
              </header>

              <div className="space-y-1">
                <h2 className="text-base font-semibold leading-snug sm:text-lg">{item.title}</h2>
                <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {item.summary}
                </p>
              </div>
              {item.image_url && item.image_alt && (
                <UpdateImage key={item.image_url} src={item.image_url} alt={item.image_alt} />
              )}
              <footer className="space-y-0.5">
                {item.tickers.length > 0 && (
                  <ul
                    className="flex min-w-0 flex-wrap items-center gap-1.5"
                    aria-label={c("Stocks", "相关股票")}
                  >
                    {[...new Set(item.tickers.map(normalizeStockSymbol))].map((ticker) => (
                      <li key={ticker} className="min-w-0">
                        <StockBadge symbol={ticker} />
                      </li>
                    ))}
                  </ul>
                )}
                <ul
                  className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5"
                  aria-label={c("Topics and source", "主题与原文")}
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
                  <li className="min-w-0">
                    <a
                      href={item.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[44px] max-w-full items-center gap-1.5 rounded-sm text-xs font-medium underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                    >
                      <span className="shrink-0">{c("Original source", "查看原文")}</span>
                      <span className="min-w-0 truncate text-xs font-normal text-muted-foreground">
                        {sourceHost(item.source_url)}
                      </span>
                      <ArrowUpRight aria-hidden="true" className="size-4 shrink-0" />
                    </a>
                  </li>
                </ul>
              </footer>
            </article>
          </li>
        ))}
      </ol>
    </ListCard>
  );
}
