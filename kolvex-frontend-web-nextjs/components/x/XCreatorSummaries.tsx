"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListCard, ListToolbar } from "@/components/ui/list-card";
import { Skeleton } from "@/components/ui/skeleton";
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
type Snapshot = { generated_at: string; coverage: "partial"; summaries: Summary[] };

export default function XCreatorSummaries({ author, creators }: { author: string; creators: XCreator[] }) {
  const { locale } = useTranslation();
  const c = (en: string, zh: string) => locale === "zh" ? zh : en;
  const [result, setResult] = useState<{ author: string; data: Snapshot } | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    setLoading(true); setError(false); setResult(null);
    const query = new URLSearchParams();
    if (author) query.set("author", author);
    void xRequest<Snapshot>(`summaries?${query}`, { signal: controller.signal }).then(data => {
      if (current) setResult({ author, data });
    }).catch(() => { if (current) setError(true); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; controller.abort(); };
  }, [author, attempt]);
  const snapshot = result?.author === author ? result.data : null;
  const date = new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", { dateStyle: "medium" });
  return <section aria-labelledby="x-summary-heading" aria-busy={loading}>
    <ListCard>
      <ListToolbar>
        <h2 id="x-summary-heading" className="text-base font-semibold">{c("AI opinion summary", "AI 观点摘要")}</h2>
        {snapshot && <time dateTime={snapshot.generated_at} className="text-xs text-muted-foreground">{c("Saved", "生成于")} {date.format(new Date(snapshot.generated_at))}</time>}
      </ListToolbar>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{c("A saved summary of selected collected posts, grouped by creator. Coverage is incomplete and may include other stocks. Reading does not generate a new summary.", "按博主归纳部分已采集推文，尚未覆盖全部内容，可能涉及多只股票。读取已保存摘要不会重新生成。")}</p>
      <div aria-live="polite">
        {loading && <div role="status" className="space-y-4 py-5"><span className="sr-only">{c("Loading summaries…", "正在加载摘要…")}</span><Skeleton className="h-5 w-1/3" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></div>}
        {error && <div role="alert" className="py-4"><p className="text-sm text-muted-foreground">{c("Could not load summaries. Posts remain available below.", "摘要暂时无法加载，下方仍可阅读推文。")}</p><Button variant="outline" size="sm" className="mt-3" onClick={() => setAttempt(value => value + 1)}>{c("Retry", "重试")}</Button></div>}
        {snapshot?.summaries.length === 0 && <p className="py-5 text-sm text-muted-foreground">{c("No saved summary for this creator yet. Read their posts below.", "这位博主暂无已保存的摘要，可先阅读下方推文。")}</p>}
      </div>
      {snapshot?.summaries.map(summary => {
        const creator = creators.find(item => item.username === summary.username);
        const content = summary.content[locale === "zh" ? "zh" : "en"];
        return <article key={`${summary.username}:${author}`} className="border-b border-border py-5 last:border-0 last:pb-1">
          <div className="flex items-center gap-3">
            <CreatorAvatar creator={creator} username={summary.username} />
            <div className="min-w-0">
              <h3 className="text-sm font-semibold"><Link className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" href={`/dashboard/x-opinions?author=${summary.username}`}>{creator?.display_name || `@${summary.username}`}</Link></h3>
              <p className="mt-1 text-xs text-muted-foreground">{date.format(new Date(summary.coverage_start))} – {date.format(new Date(summary.coverage_end))} · {c(`${summary.sources.length} source posts`, `${summary.sources.length} 条依据推文`)}</p>
            </div>
          </div>
          <p className="mt-3 text-sm font-medium leading-6">{content.headline}</p>
          <details className="group mt-1">
            <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 rounded-sm text-xs text-muted-foreground transition-colors hover:text-primary-text focus-visible:outline-none [&::-webkit-details-marker]:hidden">{c("Reasoning, caveats & sources", "论据、风险与原帖")}<ChevronDown className="h-3.5 w-3.5 group-open:rotate-180" aria-hidden="true" /></summary>
            <div className="max-w-prose space-y-3 pb-2 text-sm leading-6">
              <p>{content.basis}</p>
              <p className="text-muted-foreground"><span className="font-medium text-foreground">{c("Caveats: ", "注意：")}</span>{content.risks}</p>
              <ul className="flex flex-wrap gap-x-4 gap-y-1">
                {summary.sources.map((source, index) => <li key={source.id}><a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 rounded-sm text-xs underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{c(`Source ${index + 1}`, `原帖 ${index + 1}`)}<ExternalLink className="h-3 w-3" aria-hidden="true" /></a></li>)}
              </ul>
            </div>
          </details>
        </article>;
      })}
    </ListCard>
  </section>;
}
