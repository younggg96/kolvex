"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { marketStockHref } from "@/lib/stockLinks";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/info-tip";
import { ListCard, ListEmptyState } from "@/components/ui/list-card";
import { SearchInput } from "@/components/ui/search-input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import CompanyLogo from "@/components/ui/company-logo";
import CreatorAvatar from "@/components/youtube/CreatorAvatar";
import { SentimentBadge, toneOf, VideoLink } from "@/components/youtube/reviewParts";
import { useCachedResource } from "@/hooks/useCachedResource";
import { useTranslation } from "@/lib/i18n";
import { formatOpinionDate } from "@/lib/opinionDates";
import { signedPercent } from "@/lib/opinionOutcome";
import {
  callDirection,
  creatorStocks,
  horizonLabel,
  matchCreators,
  type CreatorOpinion,
  type CreatorStock,
  type CreatorStockFilter,
  type CreatorStockSort,
  type ReviewCreator,
} from "@/lib/opinionReview";
import { cn } from "@/lib/utils";
import {
  getYouTubeReviewCreatorOpinions,
  getYouTubeReviewCreators,
} from "@/lib/youtubeOpinionsApi";

type T = (key: string, params?: Record<string, string>) => string;

const LIST_STEP = 20;

const toneClass = (value: number) => {
  const tone = toneOf(value);
  return tone === "positive" ? "text-positive" : tone === "negative" ? "text-negative" : "";
};

/** "与观点一致 / 相反 / 基本持平": the stock's own move against the call's direction. */
function TrendTag({ call, t }: { call: CreatorOpinion; t: T }) {
  if (!call.latest) return null;
  const direction = callDirection(call.sentiment, call.latest.return_pct);
  return (
    <span
      className={cn(
        "rounded px-1.5 py-px text-[0.6875rem] font-medium",
        direction === "match"
          ? "bg-positive/10 text-positive"
          : direction === "against"
            ? "bg-negative/10 text-negative"
            : "bg-muted text-muted-foreground",
      )}
    >
      {t(
        direction === "match"
          ? "youtubeOpinions.review.trendMatch"
          : direction === "against"
            ? "youtubeOpinions.review.trendAgainst"
            : "youtubeOpinions.review.trendFlat",
      )}
    </span>
  );
}

/** The stock's change since one call, with the session count and the benchmark beside it. */
function SinceFigure({
  call,
  benchmark,
  align = "end",
  t,
}: {
  call: CreatorOpinion;
  benchmark: string;
  align?: "start" | "end";
  t: T;
}) {
  const since = call.latest;
  if (!since) {
    return (
      <span className="text-xs text-muted-foreground">
        {t("youtubeOpinions.review.sinceMissing")}
      </span>
    );
  }
  const sessions = t("youtubeOpinions.review.sinceSessions", { days: String(since.sessions) });
  return (
    <div className={cn("min-w-0", align === "end" ? "text-right" : "text-left")}>
      <div className={cn("text-base font-semibold tabular-nums", toneClass(since.return_pct))}>
        {signedPercent(since.return_pct)}
      </div>
      <div className="whitespace-nowrap text-[0.6875rem] text-muted-foreground tabular-nums">
        <span className="block sm:inline">{sessions}</span>
        {call.ticker !== benchmark && since.benchmark_return_pct != null && (
          <span className="block sm:inline">
            <span className="hidden sm:inline"> · </span>
            {t("youtubeOpinions.review.sinceMarket", {
              benchmark,
              value: signedPercent(since.benchmark_return_pct),
            })}
          </span>
        )}
      </div>
    </div>
  );
}

/** One call inside an expanded stock: date, direction, move since, and 5 / 20 day moves. */
function CallRow({
  call,
  horizons,
  benchmark,
  t,
}: {
  call: CreatorOpinion;
  horizons: number[];
  benchmark: string;
  t: T;
}) {
  const { locale } = useTranslation();
  const reached = horizons.filter((days) => call.horizons[String(days)]);
  return (
    <li className="flex min-w-0 items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
          <span className="whitespace-nowrap tabular-nums text-muted-foreground">
            {formatOpinionDate(call.published_at ?? call.entry_date, locale)}
          </span>
          <SentimentBadge sentiment={call.sentiment} t={t} />
          <TrendTag call={call} t={t} />
        </div>
        {reached.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-x-3 text-[0.6875rem] text-muted-foreground tabular-nums">
            {reached.map((days) => {
              const move = call.horizons[String(days)];
              return (
                <span key={days}>
                  {horizonLabel(days, t)}{" "}
                  <span className={toneClass(move.return_pct)}>
                    {signedPercent(move.return_pct)}
                  </span>
                </span>
              );
            })}
          </div>
        )}
      </div>
      <SinceFigure call={call} benchmark={benchmark} t={t} />
      <VideoLink url={call.video_url} t={t} />
    </li>
  );
}

function StockRow({
  stock,
  horizons,
  benchmark,
  t,
}: {
  stock: CreatorStock;
  horizons: number[];
  benchmark: string;
  t: T;
}) {
  const { locale } = useTranslation();
  const [open, setOpen] = useState(false);
  const panelId = `stock-calls-${stock.ticker}`;
  const call = stock.latest;
  return (
    <li className="min-w-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full min-w-0 items-center gap-3 rounded-xl px-2 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <CompanyLogo symbol={stock.ticker} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold">{stock.ticker}</span>
            <SentimentBadge sentiment={call.sentiment} t={t} />
            <TrendTag call={call} t={t} />
          </div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground tabular-nums">
            {formatOpinionDate(call.published_at ?? call.entry_date, locale)}
            {" · "}
            {t("youtubeOpinions.review.mentions", { count: String(stock.calls.length) })}
            {stock.calls.length > 1 && stock.bullish > 0 && stock.bearish > 0
              ? ` (${t("youtubeOpinions.review.mentionSplit", {
                  bullish: String(stock.bullish),
                  bearish: String(stock.bearish),
                })})`
              : null}
          </div>
        </div>
        <SinceFigure call={call} benchmark={benchmark} t={t} />
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div id={panelId} className="mb-2 ml-2 rounded-xl bg-muted/40 px-3 py-1 sm:ml-11">
          <ul className="divide-y divide-border">
            {stock.calls.map((item) => (
              <CallRow key={item.id} call={item} horizons={horizons} benchmark={benchmark} t={t} />
            ))}
          </ul>
          <Link
            href={marketStockHref(stock.ticker)}
            className="my-2 inline-block text-xs font-medium underline underline-offset-4"
          >
            {t("youtubeOpinions.review.stockPage", { ticker: stock.ticker })}
          </Link>
        </div>
      )}
    </li>
  );
}

function CreatorStocks({ channelId, t }: { channelId: string; t: T }) {
  const { locale } = useTranslation();
  const [sort, setSort] = useState<CreatorStockSort>("recent");
  const [filter, setFilter] = useState<CreatorStockFilter>("all");
  const [shown, setShown] = useState(LIST_STEP);
  const resource = useCachedResource(
    `/api/youtube-opinions/review/creators/${encodeURIComponent(channelId)}`,
    (signal) => getYouTubeReviewCreatorOpinions(channelId, signal),
    { ttl: 10 * 60_000 },
  );
  const data = resource.data;
  const stocks = useMemo(
    () => creatorStocks(data?.opinions ?? [], sort, filter),
    [data, sort, filter],
  );

  if (!data) {
    return resource.loading ? (
      <div className="space-y-2" aria-busy="true">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
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
    );
  }

  const name = data.channel_title || channelId;
  return (
    <div className="min-w-0">
      <ListCard className="min-w-0 p-4 sm:p-5">
        <div className="flex min-w-0 items-center gap-2">
          <CreatorAvatar name={name} avatarUrl={data.channel_avatar_url} size="md" />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1">
              <h3 className="min-w-0 truncate text-base font-semibold">{name}</h3>
              <InfoTip label={t("youtubeOpinions.review.howLabel")}>
                {t("youtubeOpinions.review.creatorListHow", { benchmark: data.benchmark })}
              </InfoTip>
            </div>
            <p className="text-xs text-muted-foreground tabular-nums">
              {t("youtubeOpinions.review.creatorListMeta", {
                count: String(data.total),
                stocks: String(data.stocks.length),
              })}
            </p>
          </div>
          <Link
            href={`/dashboard/youtube-opinions?tab=creators&creator=${encodeURIComponent(channelId)}`}
            className="shrink-0 text-xs font-medium underline underline-offset-4"
          >
            {t("youtubeOpinions.review.creatorProfileLink")}
          </Link>
        </div>

        {data.total === 0 ? (
          <ListEmptyState title={t("youtubeOpinions.review.creatorEmpty")} />
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <SegmentedControl
                label={t("youtubeOpinions.review.sentimentLabel")}
                size="sm"
                value={filter}
                onChange={(next) => {
                  setFilter(next);
                  setShown(LIST_STEP);
                }}
                options={[
                  { value: "all", label: t("youtubeOpinions.review.allStocks") },
                  { value: "bullish", label: t("youtubeOpinions.review.bullish") },
                  { value: "bearish", label: t("youtubeOpinions.review.bearish") },
                ]}
              />
              <SegmentedControl
                label={t("youtubeOpinions.review.sortLabel")}
                size="sm"
                value={sort}
                onChange={(next) => {
                  setSort(next);
                  setShown(LIST_STEP);
                }}
                options={[
                  { value: "recent", label: t("youtubeOpinions.review.sortRecent") },
                  { value: "mentions", label: t("youtubeOpinions.review.sortMentions") },
                  { value: "move", label: t("youtubeOpinions.review.sortMove") },
                ]}
              />
            </div>

            {stocks.length === 0 ? (
              <ListEmptyState title={t("youtubeOpinions.review.stocksEmpty")} />
            ) : (
              <ul className="mt-2 divide-y divide-border">
                {stocks.slice(0, shown).map((stock) => (
                  <StockRow
                    key={stock.ticker}
                    stock={stock}
                    horizons={data.horizons}
                    benchmark={data.benchmark}
                    t={t}
                  />
                ))}
              </ul>
            )}
            {shown < stocks.length && (
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => setShown((value) => value + LIST_STEP)}
              >
                {t("youtubeOpinions.review.showMoreStocks")}
              </Button>
            )}
          </>
        )}
      </ListCard>
      <footer className="mt-4 text-xs leading-5 text-muted-foreground">
        {t("youtubeOpinions.review.asOf", { date: formatOpinionDate(data.as_of, locale) })}{" "}
        {t("youtubeOpinions.review.disclaimer")}
      </footer>
    </div>
  );
}

/** A creator as a selectable row: avatar, name, how many opinions and stocks. */
function CreatorButton({
  creator,
  selected,
  onSelect,
  t,
}: {
  creator: ReviewCreator;
  selected: boolean;
  onSelect: (channelId: string) => void;
  t: T;
}) {
  const name = creator.channel_title || creator.channel_id;
  return (
    <button
      type="button"
      aria-current={selected ? "true" : undefined}
      onClick={() => onSelect(creator.channel_id)}
      className={cn(
        "flex w-full min-w-0 items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected ? "bg-primary/10 text-foreground" : "hover:bg-muted/60",
      )}
    >
      <CreatorAvatar name={name} avatarUrl={creator.channel_avatar_url} size="sm" />
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-sm", selected && "font-semibold")}>{name}</span>
        <span className="block text-[0.6875rem] text-muted-foreground tabular-nums">
          {t("youtubeOpinions.review.creatorListMeta", {
            count: String(creator.opinions),
            stocks: String(creator.stocks),
          })}
        </span>
      </span>
    </button>
  );
}

function CreatorList({
  creators,
  selected,
  onSelect,
  columns,
  t,
}: {
  creators: ReviewCreator[];
  selected: string | null;
  onSelect: (channelId: string) => void;
  columns: boolean;
  t: T;
}) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => matchCreators(creators, query), [creators, query]);
  return (
    <ListCard className="min-w-0 p-3">
      <SearchInput
        size="sm"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("youtubeOpinions.review.creatorSearch")}
        aria-label={t("youtubeOpinions.review.creatorSearch")}
        containerClassName="w-full"
        className="w-full"
      />
      {matches.length === 0 ? (
        <ListEmptyState title={t("youtubeOpinions.review.creatorNoMatch")} />
      ) : (
        <ul
          aria-label={t("youtubeOpinions.review.creatorsLabel")}
          className={cn(
            "mt-2 grid gap-0.5",
            columns
              ? "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              : "max-h-[calc(100vh-14rem)] overflow-y-auto",
          )}
        >
          {matches.map((creator) => (
            <li key={creator.channel_id} className="min-w-0">
              <CreatorButton
                creator={creator}
                selected={creator.channel_id === selected}
                onSelect={onSelect}
                t={t}
              />
            </li>
          ))}
        </ul>
      )}
    </ListCard>
  );
}

/**
 * The review page's creator view: every creator in a list; pick one to see each stock they
 * talked about and what it has done since their latest call on it.
 */
export default function CreatorOpinionsReview({
  channelId,
  onChannel,
}: {
  channelId: string | null;
  onChannel: (channelId: string | null) => void;
}) {
  const { t } = useTranslation();
  const resource = useCachedResource(
    "/api/youtube-opinions/review/creators",
    getYouTubeReviewCreators,
    { ttl: 10 * 60_000 },
  );
  const creators = resource.data?.creators;

  if (!creators) {
    return resource.loading ? (
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-14 rounded-xl" />
        ))}
      </div>
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
    );
  }

  if (!channelId) {
    return (
      <section className="min-w-0" aria-label={t("youtubeOpinions.review.viewCreator")}>
        <CreatorList creators={creators} selected={null} onSelect={onChannel} columns t={t} />
      </section>
    );
  }

  return (
    <section
      className="grid min-w-0 gap-4 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start"
      aria-label={t("youtubeOpinions.review.viewCreator")}
    >
      <div className="hidden min-w-0 lg:sticky lg:top-4 lg:block">
        <CreatorList
          creators={creators}
          selected={channelId}
          onSelect={onChannel}
          columns={false}
          t={t}
        />
      </div>
      <div className="min-w-0">
        <Button
          size="sm"
          variant="ghost"
          className="mb-2 lg:hidden"
          onClick={() => onChannel(null)}
        >
          <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" />
          {t("youtubeOpinions.review.allCreators")}
        </Button>
        <CreatorStocks key={channelId} channelId={channelId} t={t} />
      </div>
    </section>
  );
}
