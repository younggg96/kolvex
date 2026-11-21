"use client";

import { useState } from "react";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { useCopy } from "@/components/decision/shared";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { InfoTip } from "@/components/ui/info-tip";
import { ListCard } from "@/components/ui/list-card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import StockBadge from "@/components/ui/stock-badge";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  XHS_STANCES,
  countsTotal,
  dominantStance,
  negativeCount,
  stanceLabel,
  stanceShares,
  type XhsCounts,
  type XhsDay,
  type XhsSource,
  type XhsStance,
  type XhsTopic,
} from "@/lib/xhsSentiment";

/** Fear and bearish read as the market-down tone, bullish as market-up; a word always goes with the colour. */
export const STANCE_FILL: Record<XhsStance, string> = {
  fear_panic: "bg-negative-fill",
  bearish: "bg-negative-fill/55",
  neutral: "bg-muted-foreground/40",
  mixed_cautious_buy: "bg-positive-fill/45",
  bullish: "bg-positive-fill",
};

const STANCE_TEXT: Record<XhsStance, string> = {
  fear_panic: "text-negative",
  bearish: "text-negative",
  neutral: "text-muted-foreground",
  mixed_cautious_buy: "text-foreground",
  bullish: "text-positive",
};

function useLocale(): "en" | "zh" {
  const { locale } = useTranslation();
  return locale === "zh" ? "zh" : "en";
}

export function formatPtDate(date: string, locale: "en" | "zh", withWeekday = true) {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    ...(withWeekday ? { weekday: "short" } : {}),
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatPtTime(iso: string, locale: "en" | "zh") {
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    timeZone: "America/Los_Angeles",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso));
}

/** Horizontal stacked bar; the legend beside it carries the same numbers as text. */
export function StanceBar({ counts, className }: { counts: XhsCounts; className?: string }) {
  const total = countsTotal(counts);
  return (
    <div className={cn("flex h-3 gap-0.5 overflow-hidden rounded-full", className)} aria-hidden>
      {total === 0 ? (
        <span className="h-full w-full bg-muted" />
      ) : (
        XHS_STANCES.filter(({ key }) => counts[key] > 0).map(({ key }) => (
          <span
            key={key}
            className={cn("h-full", STANCE_FILL[key])}
            style={{ flexGrow: counts[key], flexBasis: 0 }}
          />
        ))
      )}
    </div>
  );
}

function SentimentCard({ day }: { day: XhsDay }) {
  const c = useCopy();
  const locale = useLocale();
  const latest = day.sentiment.latest;
  const [scope, setScope] = useState<"all" | "latest">(latest ? "latest" : "all");
  const counts = scope === "latest" && latest ? latest : day.sentiment.all;
  const total = countsTotal(counts);
  const shares = stanceShares(counts);
  const dominant = dominantStance(counts);
  const negative = total ? Math.round((negativeCount(counts) / total) * 100) : 0;
  const number = new Intl.NumberFormat(c("en-US", "zh-CN"));
  const hours = day.sample.latest_window_hours;

  return (
    <Card className="space-y-4 p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{c("Most posts", "多数帖子")}</p>
          <p
            className={cn(
              "mt-0.5 text-2xl font-semibold tracking-tight",
              dominant && STANCE_TEXT[dominant],
            )}
          >
            {dominant ? stanceLabel(dominant, locale) : c("No single lean", "没有单一倾向")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground tabular-nums">
            {c(
              `Fear + bearish ${negative}% · ${number.format(total)} posts`,
              `恐慌 + 看空 ${negative}% · 共 ${number.format(total)} 条`,
            )}
          </p>
        </div>
        {latest && (
          <SegmentedControl
            label={c("Posts counted", "统计范围")}
            size="sm"
            value={scope}
            onChange={setScope}
            options={[
              {
                value: "latest",
                label: hours ? c(`Last ${hours}h`, `近 ${hours} 小时`) : c("Latest", "最新"),
              },
              { value: "all", label: c("All posts", "全部帖子") },
            ]}
          />
        )}
      </div>
      <StanceBar counts={counts} />
      <ul
        className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-5"
        aria-label={c("Sentiment breakdown", "情绪分布")}
      >
        {XHS_STANCES.map(({ key }) => (
          <li key={key} className="flex min-w-0 items-center gap-2">
            <span
              className={cn("h-2.5 w-2.5 shrink-0 rounded-full", STANCE_FILL[key])}
              aria-hidden
            />
            <span className="min-w-0 truncate">{stanceLabel(key, locale)}</span>
            <span className="ml-auto whitespace-nowrap tabular-nums sm:ml-0">
              {shares[key]}%
              <span className="ml-1 text-xs text-muted-foreground">
                {c(`(${number.format(counts[key])})`, `（${number.format(counts[key])} 条）`)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function SourceLink({ source }: { source: XhsSource }) {
  const c = useCopy();
  return (
    <li className="min-w-0">
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex min-h-11 items-start gap-2 rounded-lg py-1.5 text-sm hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25"
      >
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 break-words">{source.title}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {[
              source.author_nickname,
              source.published_raw,
              source.comments !== null &&
                c(`${source.comments} comments`, `${source.comments} 条评论`),
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
        <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="sr-only">{c("Open the original post", "打开原帖")}</span>
      </a>
    </li>
  );
}

function TopicRow({ topic, rank }: { topic: XhsTopic; rank: number }) {
  const c = useCopy();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const panelId = `xhs-topic-${topic.id}`;
  const heat = [
    c(`${topic.heat.posts} posts`, `${topic.heat.posts} 帖`),
    topic.heat.comments !== null &&
      c(`${topic.heat.comments} comments`, `${topic.heat.comments} 评论`),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="border-b border-border py-3 last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full min-w-0 items-start gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25"
      >
        <span className="w-5 shrink-0 pt-0.5 text-center text-xs tabular-nums text-muted-foreground">
          {rank}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-[0.9375rem] font-semibold">{topic.title}</span>
            <span className={cn("text-xs font-medium", STANCE_TEXT[topic.stance])}>
              {stanceLabel(topic.stance, locale)}
            </span>
          </span>
          <span className="mt-1 block text-sm leading-6 text-muted-foreground">
            {topic.summary}
          </span>
          <span className="mt-1 block text-xs tabular-nums text-muted-foreground">{heat}</span>
        </span>
        <ChevronDown
          className={cn(
            "mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {topic.tickers.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5 pl-8" aria-label={c("Stocks", "相关股票")}>
          {topic.tickers.map((ticker) => (
            <li key={ticker}>
              <StockBadge symbol={ticker} />
            </li>
          ))}
        </ul>
      )}
      <div id={panelId} hidden={!open} className="mt-3 space-y-3 pl-8">
        {topic.excerpts.length > 0 && (
          <ul className="space-y-1.5" aria-label={c("What people said", "评论摘录")}>
            {topic.excerpts.map((excerpt, index) => (
              <li key={index} className="rounded-lg bg-muted/60 px-3 py-2 text-sm">
                「{excerpt.text}」
                {excerpt.likes !== null && (
                  <span className="ml-2 text-xs tabular-nums text-muted-foreground">
                    {c(`${excerpt.likes} likes`, `${excerpt.likes} 赞`)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        <div>
          <p className="text-xs text-muted-foreground">{c("Sources", "出处")}</p>
          <ul>
            {topic.sources.map((source) => (
              <SourceLink key={source.note_id} source={source} />
            ))}
          </ul>
        </div>
      </div>
    </li>
  );
}

/** One day's digest: sentiment, the topics people discussed, rumours and coverage notes. */
export default function XhsDayView({ day }: { day: XhsDay }) {
  const c = useCopy();
  const locale = useLocale();
  const number = new Intl.NumberFormat(c("en-US", "zh-CN"));
  const sample = day.sample;

  return (
    <div className="space-y-6">
      <section aria-labelledby="xhs-sentiment-title" className="space-y-3">
        <h2 id="xhs-sentiment-title" className="flex items-center gap-2 text-lg font-semibold">
          {c("Sentiment", "情绪")}
          <InfoTip label={c("How this is counted", "统计口径")}>
            <p>
              {c(
                `${number.format(sample.posts_scanned)} posts found by searching ${sample.keywords.join(", ")}, classified by ${sample.classified_by === "title" ? "title" : "post text"}. Not all of Xiaohongshu.`,
                `在「${sample.keywords.join("、")}」下找到 ${number.format(sample.posts_scanned)} 条帖子，按${sample.classified_by === "title" ? "标题" : "正文"}判断情绪，不代表小红书全部内容。`,
              )}
            </p>
            {sample.comments_read !== null && (
              <p className="mt-1">
                {c(
                  `Comments: ${sample.comments_read} top comments sampled.`,
                  `评论：抽样 ${sample.comments_read} 条热评。`,
                )}
              </p>
            )}
          </InfoTip>
        </h2>
        <SentimentCard key={day.date_pt} day={day} />
      </section>

      <section aria-labelledby="xhs-topics-title" className="space-y-3">
        <h2 id="xhs-topics-title" className="text-lg font-semibold">
          {c("What people discussed", "讨论话题")}
          <span className="ml-2 text-sm font-normal tabular-nums text-muted-foreground">
            {day.topics.length}
          </span>
        </h2>
        <ListCard>
          <ol aria-label={c("Topics", "讨论话题")}>
            {day.topics.map((topic, index) => (
              <TopicRow key={topic.id} topic={topic} rank={index + 1} />
            ))}
          </ol>
        </ListCard>
      </section>

      {day.rumors.length > 0 && (
        <section aria-labelledby="xhs-rumors-title" className="space-y-3">
          <h2 id="xhs-rumors-title" className="text-lg font-semibold">
            {c("Rumours", "传言")}
          </h2>
          <ListCard>
            <ul>
              {day.rumors.map((rumor, index) => (
                <li key={index} className="border-b border-border py-3 last:border-b-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" size="sm" className="text-muted-foreground">
                      {rumor.status === "debunked"
                        ? c("Denied", "已被否认")
                        : c("Unverified", "未经证实")}
                    </Badge>
                    <span className="min-w-0 text-sm">{rumor.text}</span>
                  </div>
                  {rumor.sources.length > 0 && (
                    <ul className="mt-1">
                      {rumor.sources.map((source) => (
                        <SourceLink key={source.note_id} source={source} />
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </ListCard>
        </section>
      )}

      <footer className="space-y-2 text-xs leading-5 text-muted-foreground">
        <p>
          {c("Collected", "采集于")} {formatPtTime(day.captured_at, locale)} ·{" "}
          {c(
            "Topics summarise public posts and are not investment advice.",
            "话题为公开帖子的归纳，不构成投资建议。",
          )}
        </p>
        {day.limitations.length > 0 && (
          <details>
            <summary className="w-fit cursor-pointer rounded-sm py-1 underline-offset-4 hover:underline focus-visible:outline-none">
              {c("Coverage notes", "覆盖说明")}
            </summary>
            <ul className="mt-1 max-w-prose list-disc space-y-1 pl-4">
              {day.limitations.map((note, index) => (
                <li key={index}>{note}</li>
              ))}
            </ul>
          </details>
        )}
      </footer>
    </div>
  );
}
