"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { marketStockHref } from "@/lib/stockLinks";
import { Button } from "@/components/ui/button";
import { ChipButton } from "@/components/ui/chip-button";
import { InfoTip } from "@/components/ui/info-tip";
import { ListCard, ListEmptyState } from "@/components/ui/list-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import CompanyLogo from "@/components/ui/company-logo";
import CreatorAvatar from "@/components/youtube/CreatorAvatar";
import CreatorReviewCard from "@/components/youtube/CreatorReviewCard";
import {
  DirectionTile,
  SentimentBadge,
  Tile,
  toneOf,
  VideoLink,
} from "@/components/youtube/reviewParts";
import { useCachedResource } from "@/hooks/useCachedResource";
import { useTranslation } from "@/lib/i18n";
import { formatOpinionDate } from "@/lib/opinionDates";
import { signedPercent } from "@/lib/opinionOutcome";
import { horizonLabel, type CreatorOpinion, type ReviewMove } from "@/lib/opinionReview";
import { cn } from "@/lib/utils";
import {
  getYouTubeReviewCreatorOpinions,
  getYouTubeReviewCreators,
} from "@/lib/youtubeOpinionsApi";

type T = (key: string, params?: Record<string, string>) => string;

const LIST_STEP = 20;
const ALL = "";
/** Stock chips shown before "all N stocks"; a busy creator can name 100 tickers. */
const STOCK_CHIPS = 12;

/** The most-mentioned stocks, plus the picked one if it sits further down the list. */
function visibleStocks<S extends { ticker: string }>(stocks: S[], picked: string, all: boolean) {
  if (all || stocks.length <= STOCK_CHIPS) return stocks;
  const top = stocks.slice(0, STOCK_CHIPS);
  const extra = stocks.find((entry) => entry.ticker === picked);
  return extra && !top.includes(extra) ? [...top, extra] : top;
}

/** One holding period of one opinion: excess return, or call direction when on the benchmark. */
function HorizonCell({
  days,
  move,
  item,
  benchmark,
  t,
}: {
  days: number;
  move?: ReviewMove;
  item: CreatorOpinion;
  benchmark: string;
  t: T;
}) {
  const label = horizonLabel(days, t);
  if (!move) {
    return <Tile label={label} value={t("youtubeOpinions.review.notYet", { horizon: label })} />;
  }
  if (item.ticker === benchmark) {
    return (
      <DirectionTile
        label={label}
        sentiment={item.sentiment}
        returnPct={move.return_pct}
        benchmark={benchmark}
        t={t}
      />
    );
  }
  return (
    <Tile
      label={label}
      value={signedPercent(move.excess_return_pct)}
      tone={toneOf(move.excess_return_pct)}
      sub={t("youtubeOpinions.review.moveLine", {
        stock: signedPercent(move.return_pct),
        benchmark,
        market: signedPercent(move.benchmark_return_pct),
      })}
    />
  );
}

function OpinionRow({
  item,
  horizons,
  benchmark,
  t,
}: {
  item: CreatorOpinion;
  horizons: number[];
  benchmark: string;
  t: T;
}) {
  const { locale } = useTranslation();
  return (
    <li className="min-w-0 py-3">
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <CompanyLogo symbol={item.ticker} size="xs" />
        <Link
          href={marketStockHref(item.ticker)}
          className="font-semibold underline-offset-4 hover:underline"
        >
          {item.ticker}
        </Link>
        <SentimentBadge sentiment={item.sentiment} t={t} />
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatOpinionDate(item.published_at, locale)}
        </span>
        <VideoLink url={item.video_url} t={t} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {horizons.map((days) => (
          <HorizonCell
            key={days}
            days={days}
            move={item.horizons[String(days)]}
            item={item}
            benchmark={benchmark}
            t={t}
          />
        ))}
      </div>
    </li>
  );
}

function CreatorOpinions({ channelId, t }: { channelId: string; t: T }) {
  const { locale } = useTranslation();
  const [stock, setStock] = useState(ALL);
  const [shown, setShown] = useState(LIST_STEP);
  const [allChips, setAllChips] = useState(false);
  const resource = useCachedResource(
    `/api/youtube-opinions/review/creators/${encodeURIComponent(channelId)}`,
    (signal) => getYouTubeReviewCreatorOpinions(channelId, signal),
    { ttl: 10 * 60_000 },
  );
  const data = resource.data;
  const opinions = useMemo(
    () => (data?.opinions ?? []).filter((item) => stock === ALL || item.ticker === stock),
    [data, stock],
  );

  if (!data) {
    return resource.loading ? (
      <div className="mt-4 space-y-2" aria-busy="true">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
      </div>
    ) : (
      <ListCard className="mt-4">
        <ListEmptyState
          alert
          title={t("youtubeOpinions.review.creatorListFailed")}
          action={
            <Button size="sm" variant="outline" onClick={resource.refresh}>
              {t("common.retry")}
            </Button>
          }
        />
      </ListCard>
    );
  }
  if (!data.total) {
    return (
      <ListCard className="mt-4">
        <ListEmptyState title={t("youtubeOpinions.review.creatorEmpty")} />
      </ListCard>
    );
  }

  return (
    <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <ListCard className="min-w-0 p-5">
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          <CreatorAvatar
            name={data.channel_title || channelId}
            avatarUrl={data.channel_avatar_url}
            size="sm"
          />
          <h3 className="ml-1 min-w-0 truncate text-base font-semibold">
            {data.channel_title || channelId}
          </h3>
          <InfoTip label={t("youtubeOpinions.review.howLabel")}>
            {t("youtubeOpinions.review.creatorListHow", { benchmark: data.benchmark })}
          </InfoTip>
          <Link
            href={`/dashboard/youtube-opinions?tab=creators&creator=${encodeURIComponent(channelId)}`}
            className="ml-auto text-xs font-medium underline underline-offset-4"
          >
            {t("youtubeOpinions.review.creatorProfileLink")}
          </Link>
        </div>
        <p className="mt-1 text-xs text-muted-foreground tabular-nums">
          {t("youtubeOpinions.review.creatorListMeta", {
            count: String(data.total),
            stocks: String(data.stocks.length),
          })}
        </p>

        <div
          className="mt-4 flex flex-wrap gap-1.5"
          role="group"
          aria-label={t("youtubeOpinions.review.stocksLabel")}
        >
          {[{ ticker: ALL, count: data.total }, ...visibleStocks(data.stocks, stock, allChips)].map(
            (entry) => (
              <ChipButton
                key={entry.ticker || "all"}
                size="sm"
                variant={stock === entry.ticker ? "primary" : "outline"}
                aria-pressed={stock === entry.ticker}
                className={cn(stock === entry.ticker && "ring-1 ring-foreground/40")}
                onClick={() => {
                  setStock(entry.ticker);
                  setShown(LIST_STEP);
                }}
              >
                {entry.ticker || t("youtubeOpinions.review.allStocks")}
                <span className="tabular-nums text-muted-foreground">{entry.count}</span>
              </ChipButton>
            ),
          )}
          {data.stocks.length > STOCK_CHIPS && (
            <ChipButton size="sm" variant="ghost" onClick={() => setAllChips((value) => !value)}>
              {allChips
                ? t("youtubeOpinions.review.fewerStocks")
                : t("youtubeOpinions.review.allStocksCount", {
                    count: String(data.stocks.length),
                  })}
            </ChipButton>
          )}
        </div>

        <ul className="mt-3 divide-y divide-border">
          {opinions.slice(0, shown).map((item) => (
            <OpinionRow
              key={item.id}
              item={item}
              horizons={data.horizons}
              benchmark={data.benchmark}
              t={t}
            />
          ))}
        </ul>
        {shown < opinions.length && (
          <Button
            size="sm"
            variant="outline"
            className="mt-2"
            onClick={() => setShown((value) => value + LIST_STEP)}
          >
            {t("youtubeOpinions.review.showEarlier")}
          </Button>
        )}
      </ListCard>
      <CreatorReviewCard channelId={channelId} showSeeAll={false} />
      <footer className="space-y-1 border-t border-border pt-4 text-xs leading-5 text-muted-foreground lg:col-span-2">
        <p>
          {t("youtubeOpinions.review.asOf", { date: formatOpinionDate(data.as_of, locale) })}{" "}
          {t("youtubeOpinions.review.disclaimer")}
        </p>
      </footer>
    </div>
  );
}

/** The review page's creator view: pick one creator, then every opinion with what followed. */
export default function CreatorOpinionsReview({
  channelId,
  onChannel,
}: {
  channelId: string | null;
  onChannel: (channelId: string) => void;
}) {
  const { t } = useTranslation();
  const resource = useCachedResource(
    "/api/youtube-opinions/review/creators",
    getYouTubeReviewCreators,
    {
      ttl: 10 * 60_000,
    },
  );
  const creators = resource.data?.creators;

  return (
    <section className="mt-4 min-w-0" aria-label={t("youtubeOpinions.review.viewCreator")}>
      {creators ? (
        <Select value={channelId ?? undefined} onValueChange={onChannel}>
          <SelectTrigger
            className="w-full sm:w-80"
            aria-label={t("youtubeOpinions.review.creatorPick")}
          >
            <SelectValue placeholder={t("youtubeOpinions.review.creatorPick")} />
          </SelectTrigger>
          <SelectContent className="max-h-80">
            {creators.map((creator) => (
              <SelectItem key={creator.channel_id} value={creator.channel_id}>
                <span className="flex min-w-0 items-center gap-2">
                  <CreatorAvatar
                    name={creator.channel_title || creator.channel_id}
                    avatarUrl={creator.channel_avatar_url}
                    size="xs"
                  />
                  <span className="truncate">
                    {t("youtubeOpinions.review.creatorOption", {
                      name: creator.channel_title || creator.channel_id,
                      count: String(creator.opinions),
                    })}
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : resource.loading ? (
        <Skeleton className="h-10 w-full rounded-full sm:w-80" />
      ) : (
        <ListCard>
          <ListEmptyState
            alert
            title={t("youtubeOpinions.review.creatorListFailed")}
            action={
              <Button size="sm" variant="outline" onClick={resource.refresh}>
                {t("common.retry")}
              </Button>
            }
          />
        </ListCard>
      )}
      {channelId ? <CreatorOpinions key={channelId} channelId={channelId} t={t} /> : null}
    </section>
  );
}
