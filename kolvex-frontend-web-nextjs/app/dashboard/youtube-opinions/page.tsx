"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  ChevronDown,
  ExternalLink,
  Loader2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Upload,
  Youtube,
  type LucideIcon,
} from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import DashboardLayout from "@/components/layout/DashboardLayout";
import YouTubeOpinionImporter from "@/components/admin/YouTubeOpinionImporter";
import CreatorProfileDialog from "@/components/youtube/CreatorProfileDialog";
import { useUserProfileContext } from "@/components/user/UserProfileProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "@/lib/i18n";
import { cn, proxyImageUrl } from "@/lib/utils";
import {
  getYouTubeOpinionDashboard,
  type OpinionSentiment,
  type YouTubeCreatorSummary,
  type YouTubeDailyChange,
  type YouTubeOpinion,
  type YouTubeOpinionDashboard,
  type YouTubeStockSummary,
} from "@/lib/youtubeOpinionsApi";

const SENTIMENTS: OpinionSentiment[] = ["bullish", "bearish", "neutral", "mixed"];

function formatDate(value?: string | null) {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value.slice(0, 10);
  }
}

function formatScore(value?: number | null) {
  const score = Number(value || 0);
  return score > 0 ? `+${score.toFixed(0)}` : score.toFixed(0);
}

function formatConfidence(value?: number | null) {
  if (value === null || value === undefined) return "-";
  return `${Math.round(value * 100)}%`;
}

function scoreClass(value?: number | null) {
  const score = Number(value || 0);
  if (score > 15) return "text-emerald-600 dark:text-emerald-400";
  if (score < -15) return "text-rose-600 dark:text-rose-400";
  return "text-muted-foreground";
}

function sentimentClass(sentiment: string) {
  if (sentiment === "bullish") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-300";
  }
  if (sentiment === "bearish") {
    return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-500/10 dark:text-rose-300";
  }
  if (sentiment === "mixed") {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-500/10 dark:text-amber-300";
  }
  return "border-border bg-muted text-muted-foreground";
}

function SentimentBadge({
  sentiment,
  t,
}: {
  sentiment: OpinionSentiment | string;
  t: (key: string) => string;
}) {
  return (
    <Badge variant="outline" className={cn("capitalize", sentimentClass(sentiment))}>
      {t(`youtubeOpinions.${sentiment}`)}
    </Badge>
  );
}

function StatTile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-card p-3 sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-normal">{value}</div>
    </div>
  );
}

function CreatorAvatar({ creator }: { creator: Partial<YouTubeCreatorSummary | YouTubeOpinion> }) {
  const avatar = "channel_avatar_url" in creator ? creator.channel_avatar_url : null;
  const title = "channel_title" in creator ? creator.channel_title : null;
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-semibold text-muted-foreground">
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={proxyImageUrl(avatar)}
          alt={title || "creator"}
          className="h-full w-full object-cover"
        />
      ) : (
        (title || "?").slice(0, 1).toUpperCase()
      )}
    </div>
  );
}

function StockConsensusCard({
  stock,
  t,
}: {
  stock: YouTubeStockSummary;
  t: (key: string) => string;
}) {
  const total = Math.max(stock.total_opinions, 1);
  const bullishPct = (stock.bullish_count / total) * 100;
  const bearishPct = (stock.bearish_count / total) * 100;
  const neutralPct = Math.max(0, 100 - bullishPct - bearishPct);

  return (
    <div className="min-w-0 rounded-lg border border-border bg-card p-3 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 font-semibold">{stock.ticker}</span>
            {stock.company_name && (
              <span className="min-w-0 truncate text-xs text-muted-foreground">
                {stock.company_name}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {stock.creator_count} {t("youtubeOpinions.creators")} ·{" "}
            {stock.total_opinions} {t("youtubeOpinions.opinions")}
          </p>
        </div>
        <div className={cn("text-lg font-semibold", scoreClass(stock.avg_score))}>
          {formatScore(stock.avg_score)}
        </div>
      </div>

      <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-muted">
        <div className="bg-emerald-500" style={{ width: `${bullishPct}%` }} />
        <div className="bg-rose-500" style={{ width: `${bearishPct}%` }} />
        <div className="bg-slate-400" style={{ width: `${neutralPct}%` }} />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
        <span>{t("youtubeOpinions.bullish")}: {stock.bullish_count}</span>
        <span>{t("youtubeOpinions.bearish")}: {stock.bearish_count}</span>
        <span>{t("youtubeOpinions.neutral")}: {stock.neutral_count}</span>
      </div>
    </div>
  );
}

function CreatorRow({
  creator,
  t,
}: {
  creator: YouTubeCreatorSummary;
  t: (key: string) => string;
}) {
  const [profile, setProfile] = useState<YouTubeCreatorSummary | null>(null);
  const { locale } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-3 last:border-0">
      <div className="flex min-w-0 items-center gap-3">
        <CreatorAvatar creator={profile || creator} />
        <div className="min-w-0">
          <CreatorProfileDialog creator={creator} onLoaded={setProfile} />
          {(profile?.subscriber_count !== null && profile?.subscriber_count !== undefined) && <p className="mt-1 text-xs text-muted-foreground">YouTube · {new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(profile.subscriber_count)} {locale === "zh" ? "订阅者" : "subscribers"}</p>}
          <div className="mt-1 flex flex-wrap gap-1">
            {creator.top_tickers.slice(0, 4).map((item) => (
              <Badge key={item.ticker} variant="secondary" size="xs">
                {item.ticker}
              </Badge>
            ))}
          </div>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className={cn("text-sm font-semibold", scoreClass(creator.avg_score))}>
          {formatScore(creator.avg_score)}
        </div>
        <div className="text-xs text-muted-foreground">
          {creator.total_opinions} {t("youtubeOpinions.opinions")}
        </div>
      </div>
    </div>
  );
}

function DailyChangeRow({
  item,
  t,
}: {
  item: YouTubeDailyChange;
  t: (key: string) => string;
}) {
  const change = item.change;
  return (
    <div className="grid min-w-0 grid-cols-2 items-center gap-x-3 gap-y-2 border-b border-border py-3 text-sm last:border-0 sm:grid-cols-[minmax(64px,0.7fr)_1fr_1fr_auto]">
      <div className="order-1 min-w-0 break-words font-semibold">{item.ticker}</div>
      <div className="order-3 min-w-0 sm:order-2">
        <div className="mb-0.5 text-xs text-muted-foreground sm:hidden">{t("youtubeOpinions.current")}</div>
        <div className={cn("font-medium", scoreClass(item.current_score))}>
          {formatScore(item.current_score)}
        </div>
        <div className="text-xs text-muted-foreground">{item.current_date}</div>
      </div>
      <div className="order-4 min-w-0 sm:order-3">
        <div className="mb-0.5 text-xs text-muted-foreground sm:hidden">{t("youtubeOpinions.previous")}</div>
        <div className={cn("font-medium", scoreClass(item.previous_score))}>
          {item.previous_score === null || item.previous_score === undefined
            ? t("youtubeOpinions.noPrevious")
            : formatScore(item.previous_score)}
        </div>
        <div className="text-xs text-muted-foreground">
          {item.previous_date || "-"}
        </div>
      </div>
      <div
        className={cn(
          "order-2 flex items-center justify-self-end gap-1 whitespace-nowrap rounded-md px-2 py-1 text-xs font-semibold sm:order-4",
          (change || 0) > 0
            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
            : (change || 0) < 0
              ? "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
              : "bg-muted text-muted-foreground"
        )}
      >
        {(change || 0) > 0 ? (
          <TrendingUp className="h-3 w-3" />
        ) : (change || 0) < 0 ? (
          <TrendingDown className="h-3 w-3" />
        ) : null}
        {change === null || change === undefined ? "-" : formatScore(change)}
      </div>
    </div>
  );
}

function displayList(value?: unknown[]) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
    .filter(Boolean);
}

function LatestOpinion({
  opinion,
  t,
}: {
  opinion: YouTubeOpinion;
  t: (key: string) => string;
}) {
  const keyPoints = displayList(opinion.key_points);
  const risks = displayList(opinion.risks);

  return (
    <article className="min-w-0 max-w-full rounded-lg border border-border bg-card p-3 [overflow-wrap:anywhere] sm:p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <CreatorAvatar creator={opinion} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 break-words font-medium">{opinion.channel_title || opinion.channel_id}</span>
              <Badge variant="secondary" size="xs">
                {opinion.ticker}
              </Badge>
              <SentimentBadge sentiment={opinion.sentiment} t={t} />
            </div>
            <div className="mt-1 break-words text-sm leading-5 text-muted-foreground">
              {opinion.video_title || opinion.video_id}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3 md:justify-end">
          <div className={cn("text-lg font-semibold", scoreClass(opinion.direction_score))}>
            {formatScore(opinion.direction_score)}
          </div>
          {opinion.video_url && (
            <Button asChild variant="ghost" size="icon" className="h-11 w-11">
              <a href={opinion.video_url} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
                <span className="sr-only">{t("youtubeOpinions.openVideo")}</span>
              </a>
            </Button>
          )}
        </div>
      </div>

      {(opinion.summary || opinion.thesis) && (
        <p className="mt-4 break-words text-sm leading-6 text-foreground/90">
          {opinion.summary || opinion.thesis}
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div>
          <div className="text-xs font-medium text-muted-foreground">
            {t("youtubeOpinions.confidence")}
          </div>
          <div className="mt-1">{formatConfidence(opinion.confidence)}</div>
        </div>
        <div>
          <div className="text-xs font-medium text-muted-foreground">
            {t("youtubeOpinions.latest")}
          </div>
          <div className="mt-1">{formatDate(opinion.video_published_at)}</div>
        </div>
        <div>
          <div className="text-xs font-medium text-muted-foreground">
            {t("youtubeOpinions.score")}
          </div>
          <div className={cn("mt-1 font-medium", scoreClass(opinion.direction_score))}>
            {formatScore(opinion.direction_score)}
          </div>
        </div>
      </div>

      {(keyPoints.length > 0 || risks.length > 0) && (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {keyPoints.length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground">
                {t("youtubeOpinions.keyPoints")}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {keyPoints.slice(0, 5).map((point) => (
                  <Badge key={point} variant="outline" className="max-w-full whitespace-normal break-words text-left font-normal leading-5">
                    {point}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {risks.length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground">
                {t("youtubeOpinions.risks")}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {risks.slice(0, 5).map((risk) => (
                  <Badge key={risk} variant="outline" className="max-w-full whitespace-normal break-words text-left font-normal leading-5">
                    {risk}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export default function YouTubeOpinionsPage() {
  const { t } = useTranslation();
  const { profile } = useUserProfileContext();
  const isAdmin = profile?.is_admin ?? false;

  const [data, setData] = useState<YouTubeOpinionDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [ticker, setTicker] = useState("");
  const [creator, setCreator] = useState("all");
  const [sentiment, setSentiment] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getYouTubeOpinionDashboard({
        ticker: ticker.trim().toUpperCase() || undefined,
        channel_id: creator === "all" ? undefined : creator,
        sentiment: sentiment === "all" ? undefined : sentiment,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        limit: 80,
      });
      setData(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("youtubeOpinions.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [creator, dateFrom, dateTo, sentiment, t, ticker]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const chartData = useMemo(() => data?.daily || [], [data]);

  const handleReset = () => {
    setTicker("");
    setCreator("all");
    setSentiment("all");
    setDateFrom("");
    setDateTo("");
  };

  const summary = data?.summary;
  const activeFilterCount = [ticker.trim(), creator !== "all", sentiment !== "all", dateFrom, dateTo].filter(Boolean).length;

  return (
    <DashboardLayout
      title={t("youtubeOpinions.title")}
      headerActions={
        <div className="hidden items-center gap-2 sm:flex">
          <Button variant="ghost" size="xs" onClick={loadData} disabled={loading}>
            <RefreshCw className={cn("mr-1 h-3.5 w-3.5", loading && "animate-spin")} />
            {t("youtubeOpinions.refresh")}
          </Button>
          {isAdmin && (
            <Button size="xs" onClick={() => setUploadOpen(true)}>
              <Upload className="mr-1 h-3.5 w-3.5" />
              {t("youtubeOpinions.uploadJson")}
            </Button>
          )}
        </div>
      }
    >
      <div className="relative min-h-0 min-w-0 flex-1 overflow-y-auto bg-background">
        <div className="relative mx-auto flex w-full min-w-0 max-w-[1500px] flex-col gap-5 px-4 py-3 sm:gap-6 sm:p-4 md:p-7">
          <section className="border-b border-border pb-3 sm:pb-5">
            <div className="flex min-w-0 items-center justify-between gap-2 sm:mb-3">
              <Button variant="ghost" className="h-11 gap-2 px-0 sm:hidden" onClick={() => setFiltersOpen(!filtersOpen)} aria-expanded={filtersOpen} aria-controls="youtube-opinion-filters">
                <Youtube className="h-4 w-4 text-red-500" />
                {t("youtubeOpinions.filters")}
                {activeFilterCount > 0 && <Badge variant="secondary">{activeFilterCount}</Badge>}
                <ChevronDown className={cn("h-4 w-4 transition-transform", filtersOpen && "rotate-180")} />
              </Button>
              <div className="hidden items-center gap-2 text-sm font-medium sm:flex"><Youtube className="h-4 w-4 text-red-500" />{t("youtubeOpinions.filters")}</div>
              <div className="flex items-center gap-2 sm:hidden">
                <Button variant="ghost" size="icon" className="h-11 w-11" aria-label={t("youtubeOpinions.refresh")} onClick={loadData} disabled={loading}><RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /></Button>
                {isAdmin && <Button variant="outline" size="icon" className="h-11 w-11" aria-label={t("youtubeOpinions.uploadJson")} title={t("youtubeOpinions.uploadJson")} onClick={() => setUploadOpen(true)}><Upload className="h-4 w-4" /></Button>}
              </div>
            </div>
            <div id="youtube-opinion-filters" className={cn("mt-3 min-w-0 grid-cols-2 gap-3 sm:mt-0 sm:grid xl:grid-cols-[minmax(100px,0.8fr)_minmax(130px,1fr)_minmax(120px,0.8fr)_repeat(2,minmax(130px,0.8fr))_auto]", filtersOpen ? "grid" : "hidden")}>
              <Input
                value={ticker}
                onChange={(event) => setTicker(event.target.value)}
                placeholder={t("youtubeOpinions.ticker")}
                aria-label={t("youtubeOpinions.ticker")}
                className="col-span-2 h-11 min-w-0 text-base uppercase sm:col-span-1 sm:h-10"
              />
              <Select value={creator} onValueChange={setCreator}>
                <SelectTrigger aria-label={t("youtubeOpinions.creator")} className="h-11 min-w-0 sm:h-10">
                  <SelectValue placeholder={t("youtubeOpinions.creator")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("youtubeOpinions.allCreators")}</SelectItem>
                  {(data?.filters.creators || []).map((item) => (
                    <SelectItem key={item.channel_id} value={item.channel_id}>
                      {item.channel_title || item.channel_handle || item.channel_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sentiment} onValueChange={setSentiment}>
                <SelectTrigger aria-label={t("youtubeOpinions.sentiment")} className="h-11 min-w-0 sm:h-10">
                  <SelectValue placeholder={t("youtubeOpinions.sentiment")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("youtubeOpinions.allSentiments")}</SelectItem>
                  {SENTIMENTS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {t(`youtubeOpinions.${item}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <label className="min-w-0 space-y-1 text-xs text-muted-foreground">
                <span className="sm:hidden">{t("youtubeOpinions.dateFrom")}</span>
                <Input
                  type="date"
                  className="h-11 w-full min-w-0 text-base sm:h-10"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                  aria-label={t("youtubeOpinions.dateFrom")}
                />
              </label>
              <label className="min-w-0 space-y-1 text-xs text-muted-foreground">
                <span className="sm:hidden">{t("youtubeOpinions.dateTo")}</span>
                <Input
                  type="date"
                  className="h-11 w-full min-w-0 text-base sm:h-10"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                  aria-label={t("youtubeOpinions.dateTo")}
                />
              </label>
              <div className="col-span-2 flex gap-2 sm:col-span-1">
                <Button type="button" onClick={loadData} className="h-11 flex-1 sm:h-10">
                  {t("youtubeOpinions.apply")}
                </Button>
                <Button type="button" variant="outline" className="h-11 flex-1 sm:h-10 sm:flex-none" onClick={handleReset}>
                  {t("youtubeOpinions.reset")}
                </Button>
              </div>
            </div>
          </section>

          <div className="data-summary">
            <StatTile
              label={t("youtubeOpinions.opinions")}
              value={summary?.total_opinions ?? 0}
              icon={BarChart3}
            />
            <StatTile
              label={t("youtubeOpinions.stocks")}
              value={summary?.total_stocks ?? 0}
              icon={TrendingUp}
            />
            <StatTile
              label={t("youtubeOpinions.creators")}
              value={summary?.total_creators ?? 0}
              icon={Youtube}
            />
            <StatTile
              label={t("youtubeOpinions.avgScore")}
              value={formatScore(summary?.avg_score)}
              icon={BarChart3}
            />
          </div>

          {loading && !data ? (
            <div className="flex min-h-[420px] items-center justify-center rounded-lg border border-border bg-card">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !data || data.summary.total_opinions === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 text-center text-muted-foreground">
              <Youtube className="h-8 w-8 text-red-500" />
              <p className="max-w-md text-sm">{t("youtubeOpinions.noData")}</p>
              {isAdmin && <Button variant="outline" onClick={() => setUploadOpen(true)}><Upload className="mr-2 h-4 w-4" />{t("youtubeOpinions.uploadJson")}</Button>}
            </div>
          ) : (
            <>
              <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[1.25fr_0.75fr]">
                <section className="research-section min-w-0">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
                    <h2 className="text-base font-semibold">
                      {t("youtubeOpinions.dailyTrend")}
                    </h2>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        {t("youtubeOpinions.bullish")}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-rose-500" />
                        {t("youtubeOpinions.bearish")}
                      </span>
                    </div>
                  </div>
                  <div className="h-56 min-w-0 overflow-hidden sm:h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={28} tickFormatter={(value: string) => value.slice(5)} />
                        <YAxis yAxisId="score" width={38} tick={{ fontSize: 11 }} domain={[-100, 100]} />
                        <YAxis yAxisId="count" orientation="right" hide />
                        <Tooltip
                          contentStyle={{
                            borderRadius: 8,
                            border: "1px solid rgb(var(--border))",
                            background: "rgb(var(--card))",
                          }}
                        />
                        <Bar yAxisId="count" dataKey="total" fill="#94a3b8" opacity={0.25} isAnimationActive={false} />
                        <Line
                          yAxisId="score"
                          type="monotone"
                          dataKey="avg_score"
                          isAnimationActive={false}
                          stroke="#2563eb"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          yAxisId="count"
                          type="monotone"
                          dataKey="bullish_count"
                          isAnimationActive={false}
                          stroke="#10b981"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          yAxisId="count"
                          type="monotone"
                          dataKey="bearish_count"
                          isAnimationActive={false}
                          stroke="#f43f5e"
                          strokeWidth={2}
                          dot={false}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                <section className="research-section min-w-0">
                  <h2 className="mb-4 text-base font-semibold">
                    {t("youtubeOpinions.dailyChanges")}
                  </h2>
                  <div>
                    {data.changes.slice(0, 8).map((item) => (
                      <DailyChangeRow key={item.ticker} item={item} t={t} />
                    ))}
                  </div>
                </section>
              </div>

              <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[1fr_0.9fr]">
                <section>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h2 className="text-base font-semibold">
                      {t("youtubeOpinions.stockConsensus")}
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {data.stocks.slice(0, 8).map((stock) => (
                      <StockConsensusCard key={stock.ticker} stock={stock} t={t} />
                    ))}
                  </div>
                </section>

                <section>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h2 className="text-base font-semibold">
                      {t("youtubeOpinions.creatorCoverage")}
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {data.creators.slice(0, 8).map((creatorSummary) => (
                      <CreatorRow
                        key={creatorSummary.channel_id}
                        creator={creatorSummary}
                        t={t}
                      />
                    ))}
                  </div>
                </section>
              </div>

              <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold">
                    {t("youtubeOpinions.latestOpinions")}
                  </h2>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {data.latest.map((opinion) => (
                    <LatestOpinion key={opinion.id} opinion={opinion} t={t} />
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </div>

      <Dialog open={isAdmin && uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-3xl overflow-x-hidden overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>{t("youtubeOpinions.uploadTitle")}</DialogTitle>
            <DialogDescription>
              {t("youtubeOpinions.uploadDescription")}
            </DialogDescription>
          </DialogHeader>
          <YouTubeOpinionImporter onImported={loadData} />
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
