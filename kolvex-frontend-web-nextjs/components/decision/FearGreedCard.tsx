"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ContentLoading } from "@/components/ui/content-loading";
import { Skeleton } from "@/components/ui/skeleton";
import { useCachedResource } from "@/hooks/useCachedResource";
import { FEAR_GREED_HISTORY_PATH, FEAR_GREED_RATINGS, readFearGreed } from "@/lib/fearGreed";
import ScrubChart, { type ScrubPoint } from "./ScrubChart";
import { useCopy } from "./shared";

const CNN_SOURCE = "https://www.cnn.com/markets/fear-and-greed";

export default function FearGreedCard() {
  const c = useCopy();
  const [scrub, setScrub] = useState<ScrubPoint | null>(null);
  const { data, loading, error, refresh } = useCachedResource(
    FEAR_GREED_HISTORY_PATH,
    readFearGreed,
    { ttl: 60_000, maxAge: 5 * 60_000 },
  );
  const points = useMemo(
    () => data?.map(({ date, score }) => ({ date, value: score })) ?? [],
    [data],
  );
  const current = (scrub && data?.find((point) => point.date === scrub.date)) || data?.at(-1);
  const rating = current?.rating ? FEAR_GREED_RATINGS[current.rating] : null;
  const title = c("CNN Fear & Greed Index", "CNN 恐慌与贪婪指数");
  const date = current?.date;
  const score = current?.score.toLocaleString(c("en-US", "zh-CN"), { maximumFractionDigits: 2 });

  return (
    <section className="space-y-3" aria-labelledby="market-fear-greed-title">
      <header className="flex min-h-11 items-center justify-between gap-3">
        <h2 id="market-fear-greed-title" className="text-xl font-semibold tracking-tight">
          {title}
        </h2>
        <Button asChild size="sm" variant="ghost" className="shrink-0 gap-1">
          <a
            href={CNN_SOURCE}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={c("View original CNN index", "查看 CNN 原始指数")}
          >
            CNN
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </a>
        </Button>
      </header>
      <Card className="p-4 sm:p-5">
        {loading && !data ? (
          <ContentLoading label={c("Loading the Fear & Greed Index", "正在加载恐慌与贪婪指数")}>
            <Skeleton className="h-10 w-24" />
            <Skeleton className="mt-3 h-2 w-full rounded-full" />
          </ContentLoading>
        ) : (
          <>
            {error && (
              <div
                role="status"
                className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground"
              >
                <span>
                  {current
                    ? c(
                        "Could not refresh. Showing the saved observation.",
                        "暂时无法刷新，正在显示上次读取的数据。",
                      )
                    : c("Could not load the index.", "暂时无法加载指数。")}
                </span>
                <Button onClick={refresh} variant="outline" size="sm">
                  {c("Retry", "重试")}
                </Button>
              </div>
            )}
            {current ? (
              <div className="grid items-center gap-5 sm:grid-cols-[minmax(10rem,0.8fr)_minmax(0,1.2fr)]">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <p className="figure leading-none">
                      <span className="text-4xl font-semibold tracking-tight">{score}</span>
                      <span className="ml-1.5 text-sm text-muted-foreground">/ 100</span>
                    </p>
                    {rating && (
                      <span className="text-sm font-medium">{c(rating.en, rating.zh)}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <time dateTime={date}>{date}</time>
                    {c(" · Manually imported", " · 手动导入")}
                  </p>
                  <div
                    role="meter"
                    aria-label={title}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={current.score}
                    className="relative h-2 overflow-hidden rounded-full bg-muted"
                  >
                    <div
                      className="h-full rounded-full bg-muted-foreground"
                      style={{ width: `${current.score}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{c("Fear", "恐慌")}</span>
                    <span>{c("Greed", "贪婪")}</span>
                  </div>
                </div>
                {points.length > 1 && (
                  <div className="min-w-0">
                    <ScrubChart
                      data={points}
                      positive
                      tone="neutral"
                      height={80}
                      onScrub={setScrub}
                      label={c("CNN Fear & Greed score history", "CNN 恐慌与贪婪指数历史走势")}
                    />
                    <div className="figure flex justify-between text-xs text-muted-foreground">
                      <time dateTime={points[0].date}>{points[0].date}</time>
                      <time dateTime={points.at(-1)?.date}>{points.at(-1)?.date}</time>
                    </div>
                  </div>
                )}
              </div>
            ) : !error ? (
              <p className="text-sm text-muted-foreground">
                {c("No CNN observations have been imported yet.", "尚未导入 CNN 指数数据。")}
              </p>
            ) : null}
          </>
        )}
      </Card>
    </section>
  );
}
