"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ExternalLink, Loader2, UsersRound } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AvatarRail } from "@/components/ui/avatar-rail";
import { Button } from "@/components/ui/button";
import { ListCard } from "@/components/ui/list-card";
import { useTranslation } from "@/lib/i18n";
import { xRequest, type XCreator } from "@/lib/xContentApi";
import { CreatorAvatar } from "./XCreatorProfile";

type Insight = { headline: string; basis: string; risks: string };
type Summary = {
  username: string;
  content: { zh: Insight; en: Insight };
  sources: { id: string; url: string; published_at: string }[];
  coverage_start: string;
  coverage_end: string;
};
type Snapshot = {
  generated_at: string;
  coverage: "partial";
  summaries: Summary[];
};

export default function XCreatorSummaries({
  author,
  creators,
  creatorError,
  retryCreators,
  creatorPostsHref,
  selectCreator,
}: {
  author: string;
  creators: XCreator[] | null;
  creatorError: boolean;
  retryCreators: () => void;
  creatorPostsHref: (username: string) => string;
  selectCreator: (username: string) => void;
}) {
  const { locale } = useTranslation();
  const c = (en: string, zh: string) => (locale === "zh" ? zh : en);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 35000);
    let active = true;
    setError(false);
    void xRequest<Snapshot>("summaries", { signal: controller.signal })
      .then((data) => {
        if (active) setSnapshot(data);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => clearTimeout(timer));
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [attempt]);

  const loading = !error && !snapshot;
  const entries = new Map<string, XCreator | undefined>(
    creators?.map((creator) => [creator.username, creator]),
  );
  const summaries = new Map(snapshot?.summaries.map((summary) => [summary.username, summary]));
  for (const username of summaries.keys()) {
    if (!entries.has(username)) entries.set(username, undefined);
  }
  if (author && !entries.has(author)) entries.set(author, undefined);
  const allCreators = c("All creators", "全部博主");
  const summary = summaries.get(author);
  const content = summary?.content[locale === "zh" ? "zh" : "en"];
  const railItems = [
    {
      id: "",
      label: allCreators,
      href: creatorPostsHref(""),
      avatar: (
        <Avatar>
          <AvatarFallback>
            <UsersRound className="size-6" />
          </AvatarFallback>
        </Avatar>
      ),
    },
    ...Array.from(entries, ([username, creator]) => ({
      id: username,
      href: creatorPostsHref(username),
      label: creator?.display_name || `@${username}`,
      avatar: <CreatorAvatar creator={creator} username={username} large />,
    })),
  ];
  const date = new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    dateStyle: "medium",
  });
  return (
    <div className="space-y-2">
      {entries.size > 0 && (
        <AvatarRail
          items={railItems}
          label={c("Choose a creator", "选择 X 博主")}
          selected={author}
          onSelect={selectCreator}
        />
      )}
      {creatorError && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-2 py-2 text-sm text-muted-foreground"
        >
          {c("Creator list unavailable.", "暂时无法加载博主列表。")}
          <Button variant="ghost" size="sm" onClick={retryCreators}>
            {c("Retry", "重试")}
          </Button>
        </div>
      )}
      {author && loading && (
        <p
          role="status"
          className="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground"
        >
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          {c("Loading AI analysis…", "正在加载 AI 分析…")}
        </p>
      )}
      {author && error && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2 py-2 text-sm text-muted-foreground"
        >
          {c("AI analysis is unavailable.", "暂时无法加载 AI 分析。")}
          <Button variant="ghost" size="sm" onClick={() => setAttempt((value) => value + 1)}>
            {c("Retry", "重试")}
          </Button>
        </div>
      )}
      {!entries.size && creators && !loading && !creatorError && (
        <p className="px-2 py-3 text-sm text-muted-foreground">
          {c("No creators yet.", "暂无博主。")}
        </p>
      )}
      {author && summary && content && (
        <ListCard className="motion-safe:animate-results-enter">
          <details key={author} className="group">
            <summary className="flex min-h-11 cursor-pointer list-none items-start gap-2 rounded-xl px-2 py-2 hover:bg-foreground/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground [&::-webkit-details-marker]:hidden">
              <span className="min-w-0 flex-1 break-words text-sm">
                <span className="mr-2 text-xs font-medium text-muted-foreground">
                  {c("AI analysis", "AI 分析")}
                </span>
                {content.headline}
              </span>
              <ChevronDown
                className="mt-1 h-4 w-4 shrink-0 text-muted-foreground motion-safe:transition-transform group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <div className="space-y-4 px-2 pb-4">
              <p className="text-xs leading-4 tabular-nums text-muted-foreground">
                {date.format(new Date(summary.coverage_start))}
                {summary.coverage_start !== summary.coverage_end &&
                  ` – ${date.format(new Date(summary.coverage_end))}`}{" "}
                ·{" "}
                {c(
                  `${summary.sources.length} source posts`,
                  `${summary.sources.length} 条依据推文`,
                )}
              </p>
              {snapshot && (
                <p className="text-xs text-muted-foreground">
                  {c("Generated", "生成于")}{" "}
                  <time dateTime={snapshot.generated_at}>
                    {date.format(new Date(snapshot.generated_at))}
                  </time>
                </p>
              )}
              <dl className="space-y-4 text-sm leading-5">
                <div>
                  <dt className="font-semibold">{c("Reasoning", "观点依据")}</dt>
                  <dd className="mt-1 whitespace-pre-line break-words text-muted-foreground">
                    {content.basis}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold">{c("Risks and caveats", "风险与限制")}</dt>
                  <dd className="mt-1 whitespace-pre-line break-words text-muted-foreground">
                    {content.risks}
                  </dd>
                </div>
              </dl>
              <div>
                <h4 className="text-sm font-semibold">{c("Sources", "依据原帖")}</h4>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {summary.sources.map((source, index) => (
                    <li key={source.id}>
                      <Button asChild variant="outline" size="sm">
                        <a href={source.url} target="_blank" rel="noopener noreferrer">
                          {c(`Post ${index + 1}`, `原帖 ${index + 1}`)}
                          <ExternalLink className="ml-2 h-3 w-3" aria-hidden="true" />
                        </a>
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </details>
        </ListCard>
      )}
      {author && snapshot && !loading && !error && !summary && (
        <p className="text-xs text-muted-foreground">{c("No AI analysis yet.", "暂无 AI 分析")}</p>
      )}
    </div>
  );
}
