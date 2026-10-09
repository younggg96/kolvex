"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import CreatorAvatar from "@/components/youtube/CreatorAvatar";
import CompanyLogo from "@/components/ui/company-logo";
import { getYouTubeOpinionDashboard, type YouTubeOpinionDashboard } from "@/lib/youtubeOpinionsApi";
import { Empty, Panel, TickerSearch, WorkspaceLink, useCopy } from "./shared";
import { useDecisionCommand } from "./CommandLayer";
import styles from "./ResearchHome.module.css";

export default function ResearchHome() {
  const c = useCopy();
  const { setContext } = useDecisionCommand();
  const [dashboard, setDashboard] = useState<YouTubeOpinionDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(false);
    getYouTubeOpinionDashboard({ limit: 8 }).then((result) => {
      if (alive) setDashboard(result);
    }).catch(() => { if (alive) setError(true); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [attempt]);
  const context = JSON.stringify({ workspace: "Research", creatorCoverage: dashboard?.stocks.slice(0, 8), creators: dashboard?.creators.slice(0, 8), recentCreatorChanges: dashboard?.changes.slice(0, 6), unavailable: error });
  useEffect(() => { setContext(context); return () => setContext(""); }, [context, setContext]);

  return (
    <DashboardLayout title={c("Research", "研究")} headerActions={<Button size="sm" variant="ghost" disabled={loading} onClick={() => setAttempt((n) => n + 1)}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "motion-safe:animate-spin" : ""}`} />{c("Refresh", "刷新")}</Button>}>
      <main className={`${styles.page} flex-1 overflow-y-auto`} aria-busy={loading}>
        <div className={`${styles.content} mx-auto max-w-[1200px] space-y-8 px-4 py-8 md:px-8`}>
          <section className={`${styles.hero} space-y-5`}>
            <div className={styles.scan} aria-hidden="true" />
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{c("Find the reasoning behind a stock.", "发现股票背后的判断。")}</h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{c("Explore what creators are saying, compare their views, and open a stock workspace to investigate further.", "从创作者观点出发，对比不同判断，进入股票工作台进一步研究。")}</p>
            <TickerSearch />
          </section>
          {loading && <p role="status" className={`${styles.loading} text-sm text-muted-foreground`}><span className={styles.loadingDot} aria-hidden="true" />{c("Loading creator research…", "正在加载创作者研究…")}</p>}
          {error && <p role="alert" className="text-sm text-muted-foreground">{c("Creator research is unavailable. Refresh to retry.", "创作者研究暂时无法加载，请刷新重试。")}</p>}
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <Panel title={c("Stocks creators discuss", "创作者讨论的股票")} action={<Link href="/dashboard/youtube-opinions?tab=stocks" className="text-sm text-primary">{c("All stocks", "全部股票")}</Link>}>
              <div className="divide-y divide-border">
                {loading && !dashboard && <div className={styles.skeletons} aria-hidden="true">{[0, 1, 2, 3].map((row) => <div key={row} className={styles.skeletonRow}><span /><span /></div>)}</div>}
                {dashboard?.stocks.slice(0, 8).map((stock, index) => <div key={stock.ticker} style={{ animationDelay: `${index * 35}ms` }} className={`${styles.stockRow} flex flex-wrap items-center justify-between gap-3 py-4`}>
                  <div><WorkspaceLink ticker={stock.ticker} /><p className="mt-1 text-xs text-muted-foreground">{stock.company_name}</p></div>
                  <div className="text-right text-xs text-muted-foreground"><p>{stock.creator_count} {c("creators", "位创作者")} · {stock.total_opinions} {c("opinions", "条观点")}</p><p className="mt-1">{stock.bullish_count} {c("bullish", "看多")} / {stock.bearish_count} {c("bearish", "看空")}</p></div>
                </div>)}
              </div>
              {!dashboard?.stocks.length && !loading && !error && <Empty>{c("Stocks will appear when creator opinions are available.", "有可用的创作者观点后，股票会出现在这里。")}</Empty>}
            </Panel>
            <Panel title={c("Explore creators", "发现创作者")} action={<Link href="/dashboard/youtube-opinions?tab=creators" className="text-sm text-primary">{c("All creators", "全部创作者")}</Link>}>
              <div className="divide-y divide-border">
                {dashboard?.creators.slice(0, 6).map((creator) => <Link key={creator.channel_id} href={`/dashboard/youtube-opinions?tab=creators&creator=${encodeURIComponent(creator.channel_id)}`} className={`${styles.stockRow} flex min-w-0 items-center gap-3 py-4`}>
                  <CreatorAvatar name={creator.channel_title || creator.channel_id} avatarUrl={creator.channel_avatar_url} />
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{creator.channel_title || creator.channel_id}</p><div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">{creator.top_tickers.slice(0, 3).map((stock) => <span key={stock.ticker} className="inline-flex items-center gap-1"><span aria-hidden="true"><CompanyLogo symbol={stock.ticker} size="xs" /></span>{stock.ticker}</span>)}</div></div>
                  <span className="shrink-0 text-xs text-muted-foreground">{creator.total_opinions} {c("opinions", "条观点")}</span>
                </Link>)}
              </div>
              {!dashboard?.creators.length && !loading && !error && <Empty>{c("No creators available yet.", "暂时没有可用创作者。")}</Empty>}
            </Panel>
          </div>
          {!!dashboard?.changes.length && <Panel title={c("Recent creator opinion updates", "近期创作者观点动态")}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {dashboard.changes.slice(0, 6).map((change, index) => <div key={change.ticker} style={{ animationDelay: `${index * 45}ms` }} className={`${styles.opinionCard} flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-4 py-3`}>
                <WorkspaceLink ticker={change.ticker} />
                <div className="text-right text-xs text-muted-foreground"><p>{change.change == null ? c("New opinions", "新增观点") : change.change > 0 ? c("Opinions strengthening", "观点转强") : change.change < 0 ? c("Opinions weakening", "观点转弱") : c("Opinions unchanged", "观点持平")}</p><p className="mt-1">{change.current_date}</p></div>
              </div>)}
            </div>
          </Panel>}
        </div>
      </main>
    </DashboardLayout>
  );
}
