import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ListCard, ListRows, listFeedRowClass } from "@/components/ui/list-card";
import { ReadingText } from "@/components/public/ReadingElements";
import { StanceBar, STANCE_TEXT } from "@/components/xhs/XhsDayView";
import type { PublicXSummary } from "@/lib/publicContent";
import type { RedditRanking } from "@/lib/redditOpinions";
import {
  countsTotal,
  dominantStance,
  negativeCount,
  stanceLabel,
  type XhsDay,
} from "@/lib/xhsSentiment";
import { cn } from "@/lib/utils";

/** A section that failed to load says so instead of disappearing or showing stale zeros. */
export function Unavailable({ en, zh }: { en: string; zh: string }) {
  return (
    <p role="status" className="py-6 text-sm text-muted-foreground">
      <ReadingText en={en} zh={zh} />
    </p>
  );
}

const X_HOSTS = new Set(["x.com", "twitter.com", "www.x.com", "www.twitter.com"]);
function postUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && X_HOSTS.has(parsed.hostname) ? url : null;
  } catch {
    return null;
  }
}

export function XSummaryList({
  summaries,
  names,
}: {
  summaries: PublicXSummary[];
  names: Map<string, string>;
}) {
  return (
    <ListCard>
      <ListRows aria-label="X 博主要点">
        {summaries.map((summary) => (
          <li key={summary.username} className={cn(listFeedRowClass, "min-w-0 space-y-2")}>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 className="text-[0.9375rem] font-semibold">
                {names.get(summary.username.toLowerCase()) || `@${summary.username}`}
              </h3>
              <span className="text-xs text-muted-foreground">@{summary.username}</span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {summary.coverage_start.slice(0, 10)} – {summary.coverage_end.slice(0, 10)}
              </span>
            </div>
            <p className="whitespace-pre-line break-words text-sm leading-relaxed">
              {summary.content}
            </p>
            <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <ReadingText en="Original posts:" zh="原帖：" />
              {summary.sources.slice(0, 6).map((source, index) => {
                const href = postUrl(source.url);
                return href ? (
                  <a
                    key={source.id}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    {index + 1}
                  </a>
                ) : null;
              })}
            </p>
          </li>
        ))}
      </ListRows>
    </ListCard>
  );
}

function rankChange(row: RedditRanking["results"][number]) {
  if (row.previousRank === null) return "新上榜";
  const delta = row.previousRank - row.rank;
  return delta === 0 ? "持平" : delta > 0 ? `上升 ${delta} 位` : `下降 ${-delta} 位`;
}

export function RedditTable({ ranking, limit, label }: { ranking: RedditRanking; limit: number; label: string }) {
  const number = new Intl.NumberFormat("zh-CN");
  return (
    <ListCard>
      <table className="w-full text-sm">
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th scope="col" className="px-2 py-2 font-medium">#</th>
            <th scope="col" className="px-2 py-2 font-medium">股票</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">提及</th>
            <th scope="col" className="hidden px-2 py-2 text-right font-medium sm:table-cell">点赞</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">排名变化</th>
          </tr>
        </thead>
        <tbody>
          {ranking.results.slice(0, limit).map((row) => (
            <tr key={row.ticker} className="border-t border-border/60">
              <td className="px-2 py-2 tabular-nums text-muted-foreground">{row.rank}</td>
              <td className="min-w-0 px-2 py-2">
                <span className="font-semibold">{row.ticker}</span>{" "}
                <span className="break-words text-muted-foreground">{row.name}</span>
              </td>
              <td className="px-2 py-2 text-right tabular-nums">{number.format(row.mentions)}</td>
              <td className="hidden px-2 py-2 text-right tabular-nums sm:table-cell">
                {number.format(row.upvotes)}
              </td>
              <td className="whitespace-nowrap px-2 py-2 text-right text-xs text-muted-foreground">
                {rankChange(row)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ListCard>
  );
}

/** Teaser for the latest Xiaohongshu day; the full digest lives on its own dated page. */
export function XhsTeaser({ day }: { day: XhsDay }) {
  const counts = day.sentiment.all;
  const total = countsTotal(counts);
  const dominant = dominantStance(counts);
  const negative = total ? Math.round((negativeCount(counts) / total) * 100) : 0;
  return (
    <Card className="space-y-3 p-4 md:p-5">
      <p className="text-sm text-muted-foreground tabular-nums">{day.date_pt}</p>
      <p className={cn("text-xl font-semibold", dominant && STANCE_TEXT[dominant])}>
        {dominant ? `多数帖子：${stanceLabel(dominant, "zh")}` : "没有单一倾向"}
      </p>
      <StanceBar counts={counts} />
      <p className="text-sm text-muted-foreground tabular-nums">
        恐慌 + 看空 {negative}%，共 {total} 条帖子
      </p>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {day.topics.slice(0, 3).map((topic) => (
          <li key={topic.id}>{topic.title}</li>
        ))}
      </ul>
      <Link
        href={`/social/xiaohongshu/${day.date_pt}`}
        className="inline-block rounded-sm text-sm font-medium underline underline-offset-2"
      >
        <ReadingText en="Read the full digest" zh="阅读完整日报" />
      </Link>
    </Card>
  );
}
