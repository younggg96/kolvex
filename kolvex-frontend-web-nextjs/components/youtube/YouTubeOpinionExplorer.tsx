"use client";

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  ArrowUpDown,
  CalendarDays,
  ChevronRight,
  Loader2,
  RefreshCw,
  Search,
  Upload,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import YouTubeOpinionImporter from "@/components/admin/YouTubeOpinionImporter";
import { useUserProfileContext } from "@/components/user/UserProfileProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import CompanyLogo from "@/components/ui/company-logo";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTranslation } from "@/lib/i18n";
import { cn, proxyImageUrl } from "@/lib/utils";
import {
  getYouTubeOpinionDashboard,
  type YouTubeCreatorSummary,
  type YouTubeOpinionDashboard,
  type YouTubeOpinion,
} from "@/lib/youtubeOpinionsApi";
import CreatorProfileDialog from "./CreatorProfileDialog";
import DateFilterField from "./DateFilterField";
import OpinionCard from "./OpinionCard";
import OpinionDistribution from "./OpinionDistribution";
import OpinionStrength from "./OpinionStrength";
import StrengthChart, { type StrengthPoint } from "./StrengthChart";
import { describeStrength, toneText, type StrengthTone } from "./strength";

type DirectoryTone = "all" | StrengthTone;
type DirectorySort = "opinions" | "creators" | "latest" | "bullish" | "bearish" | "name";

type Route = { tab: "stocks" | "creators"; ticker?: string; creator?: string };
type Range = "1m" | "3m" | "6m" | "1y" | "all" | "custom";
type Filters = { sentiment: string; from: string; to: string; range: Range };
const emptyFilters: Filters = { sentiment: "all", from: "", to: "", range: "all" };
const pageSize = 40;
const rangeMonths: Record<Exclude<Range, "all" | "custom">, number> = {
  "1m": 1,
  "3m": 3,
  "6m": 6,
  "1y": 12,
};

function rangeStart(range: Range) {
  if (range === "all" || range === "custom") return "";
  const date = new Date();
  date.setMonth(date.getMonth() - rangeMonths[range]);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function readRoute(): Route {
  const params = new URLSearchParams(window.location.search);
  return {
    tab: params.get("tab") === "creators" ? "creators" : "stocks",
    ticker: params.get("stock")?.toUpperCase() || undefined,
    creator: params.get("creator") || undefined,
  };
}

function routeHref(route: Route) {
  const params = new URLSearchParams({ tab: route.tab });
  if (route.ticker) params.set("stock", route.ticker);
  if (route.creator) params.set("creator", route.creator);
  return `/dashboard/youtube-opinions?${params}`;
}

function ExplorerLink({
  target,
  children,
  className,
  label,
  onNavigate,
}: {
  target: Route;
  children: ReactNode;
  className?: string;
  label?: string;
  onNavigate: (route: Route) => void;
}) {
  const click = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    onNavigate(target);
  };
  return (
    <a
      href={routeHref(target)}
      onClick={click}
      aria-label={label}
      className={className}
    >
      {children}
    </a>
  );
}

function Avatar({
  creator,
  size = "md",
}: {
  creator: YouTubeCreatorSummary;
  size?: "md" | "lg";
}) {
  const [failed, setFailed] = useState(false);
  const title = creator.channel_title || creator.channel_id;
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary font-semibold text-muted-foreground",
        size === "lg" ? "h-14 w-14 text-lg" : "h-10 w-10 text-sm",
      )}
    >
      {title.slice(0, 1).toUpperCase()}
      {creator.channel_avatar_url && !failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={proxyImageUrl(creator.channel_avatar_url)}
          alt=""
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </div>
  );
}

export default function YouTubeOpinionExplorer() {
  const { t, locale } = useTranslation();
  const zh = locale === "zh";
  const { profile } = useUserProfileContext();
  const [route, setRoute] = useState<Route>({ tab: "stocks" });
  const [ready, setReady] = useState(false);
  const [catalogue, setCatalogue] = useState<YouTubeOpinionDashboard | null>(
    null,
  );
  const [catalogueError, setCatalogueError] = useState("");
  const [detail, setDetail] = useState<YouTubeOpinionDashboard | null>(null);
  const [context, setContext] = useState<YouTubeOpinionDashboard | null>(null);
  const [contextError, setContextError] = useState("");
  const [opinions, setOpinions] = useState<YouTubeOpinion[]>([]);
  const [loading, setLoading] = useState(false);
  const [moreLoading, setMoreLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [search, setSearch] = useState("");
  const [toneFilter, setToneFilter] = useState<DirectoryTone>("all");
  const [sortBy, setSortBy] = useState<DirectorySort>("opinions");
  const [revision, setRevision] = useState(0);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [draft, setDraft] = useState<Filters>(emptyFilters);
  const [scrub, setScrub] = useState<StrengthPoint | null>(null);
  const detailRequest = useRef(0);
  const scrollContainer = useRef<HTMLDivElement>(null);
  const inDetail = Boolean(route.ticker || route.creator);

  useEffect(() => {
    const sync = () => {
      setRoute(readRoute());
      setFilters(emptyFilters);
      setSearch("");
      scrollContainer.current?.scrollTo({ top: 0 });
    };
    sync();
    setReady(true);
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  useEffect(() => {
    let active = true;
    setCatalogueError("");
    getYouTubeOpinionDashboard({ limit: 1 })
      .then((result) => {
        if (active) setCatalogue(result);
      })
      .catch((error) => {
        if (active)
          setCatalogueError(
            error instanceof Error ? error.message : "Failed to load directory",
          );
      });
    return () => {
      active = false;
    };
  }, [revision]);

  const contextKey = `${route.ticker || ""}|${route.creator || ""}`;
  const lastContextKey = useRef("");
  useEffect(() => {
    let active = true;
    if (lastContextKey.current !== contextKey) {
      setContext(null);
      lastContextKey.current = contextKey;
    }
    setContextError("");
    if (!ready || !inDetail) return;
    getYouTubeOpinionDashboard({
      ticker: route.ticker,
      channel_id: route.creator,
      date_from: filters.from || undefined,
      date_to: filters.to || undefined,
      limit: 1,
    })
      .then((result) => {
        if (active) setContext(result);
      })
      .catch(() => {
        if (active) setContextError("unavailable");
      });
    return () => {
      active = false;
    };
  }, [ready, inDetail, contextKey, route.ticker, route.creator, filters.from, filters.to, revision]);

  useEffect(() => {
    const request = ++detailRequest.current;
    let active = true;
    setDetail(null);
    setOpinions([]);
    setDetailError("");
    setMoreLoading(false);
    if (!ready || !inDetail) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getYouTubeOpinionDashboard({
      ticker: route.ticker,
      channel_id: route.creator,
      sentiment: filters.sentiment === "all" ? undefined : filters.sentiment,
      date_from: filters.from || undefined,
      date_to: filters.to || undefined,
      limit: pageSize,
      offset: 0,
    })
      .then((result) => {
        if (active && request === detailRequest.current) {
          setDetail(result);
          setOpinions(result.latest);
        }
      })
      .catch((error) => {
        if (active && request === detailRequest.current)
          setDetailError(
            error instanceof Error ? error.message : "Failed to load opinions",
          );
      })
      .finally(() => {
        if (active && request === detailRequest.current) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [ready, inDetail, route.ticker, route.creator, filters, revision]);

  function navigate(next: Route) {
    detailRequest.current++;
    setDetail(null);
    setContext(null);
    setOpinions([]);
    setLoading(Boolean(next.creator || next.ticker));
    window.history.pushState(null, "", routeHref(next));
    setRoute(next);
    setSearch("");
    setToneFilter("all");
    if (next.tab === "creators" && sortBy === "creators") setSortBy("opinions");
    setFilters(emptyFilters);
    setScrub(null);
    scrollContainer.current?.scrollTo({ top: 0 });
  }

  async function loadMore() {
    if (!detail || moreLoading) return;
    const request = detailRequest.current;
    setMoreLoading(true);
    setDetailError("");
    try {
      const result = await getYouTubeOpinionDashboard({
        ticker: route.ticker,
        channel_id: route.creator,
        sentiment: filters.sentiment === "all" ? undefined : filters.sentiment,
        date_from: filters.from || undefined,
        date_to: filters.to || undefined,
        limit: pageSize,
        offset: opinions.length,
      });
      if (request !== detailRequest.current) return;
      setOpinions((previous) =>
        Array.from(
          new Map(
            [...previous, ...result.latest].map((item) => [item.id, item]),
          ).values(),
        ),
      );
      setDetail(result);
    } catch (error) {
      if (request === detailRequest.current)
        setDetailError(
          error instanceof Error ? error.message : "Failed to load opinions",
        );
    } finally {
      if (request === detailRequest.current) setMoreLoading(false);
    }
  }

  const creator =
    catalogue?.creators.find((item) => item.channel_id === route.creator) ||
    context?.creators.find((item) => item.channel_id === route.creator);
  const stock =
    catalogue?.stocks.find((item) => item.ticker === route.ticker) ||
    context?.stocks.find((item) => item.ticker === route.ticker);
  const title = route.creator
    ? creator?.channel_title || route.creator
    : route.ticker;
  const query = search.trim().toLocaleLowerCase();
  const stocks = (route.creator ? context?.stocks : catalogue?.stocks) || [];
  const directoryActive = !inDetail;
  const matchesTone = (score: number) =>
    !directoryActive || toneFilter === "all" || describeStrength(score, { zh }).tone === toneFilter;
  const latestTime = (value?: string | null) => (value ? new Date(value).getTime() || 0 : 0);
  const activeSort: DirectorySort = directoryActive ? sortBy : "opinions";
  const compareBy = <T extends { total_opinions: number; avg_score: number; latest_opinion_at?: string | null }>(
    a: T,
    b: T,
    name: (item: T) => string,
    creatorCount?: (item: T) => number,
  ) => {
    switch (activeSort) {
      case "creators":
        return (creatorCount?.(b) ?? 0) - (creatorCount?.(a) ?? 0) || b.total_opinions - a.total_opinions;
      case "latest":
        return latestTime(b.latest_opinion_at) - latestTime(a.latest_opinion_at);
      case "bullish":
        return b.avg_score - a.avg_score;
      case "bearish":
        return a.avg_score - b.avg_score;
      case "name":
        return name(a).localeCompare(name(b));
      default:
        return b.total_opinions - a.total_opinions || name(a).localeCompare(name(b));
    }
  };
  const visibleStocks = stocks
    .filter(
      (item) =>
        `${item.ticker} ${item.company_name || ""}`.toLocaleLowerCase().includes(query) &&
        matchesTone(item.avg_score),
    )
    .sort((a, b) => compareBy(a, b, (item) => item.ticker, (item) => item.creator_count));
  const creators = catalogue?.creators || [];
  const visibleCreators = creators
    .filter(
      (item) =>
        `${item.channel_title || ""} ${item.channel_handle || ""} ${item.channel_id}`
          .toLocaleLowerCase()
          .includes(query) && matchesTone(item.avg_score),
    )
    .sort((a, b) => compareBy(a, b, (item) => item.channel_title || item.channel_id));
  const filtering = Boolean(query) || (directoryActive && toneFilter !== "all");
  const clearFilters = () => {
    setSearch("");
    setToneFilter("all");
  };
  const toneOptions: Array<{ value: DirectoryTone; label: string }> = [
    { value: "all", label: zh ? "全部" : "All" },
    { value: "positive", label: t("youtubeOpinions.bullish") },
    { value: "negative", label: t("youtubeOpinions.bearish") },
    { value: "neutral", label: t("youtubeOpinions.neutral") },
  ];
  const sortOptions: Array<{ value: DirectorySort; label: string }> = [
    { value: "opinions", label: zh ? "观点最多" : "Most opinions" },
    ...(route.tab === "stocks"
      ? [{ value: "creators" as const, label: zh ? "博主最多" : "Most creators" }]
      : []),
    { value: "latest", label: zh ? "最近更新" : "Most recent" },
    { value: "bullish", label: zh ? "最看涨" : "Most bullish" },
    { value: "bearish", label: zh ? "最看跌" : "Most bearish" },
    { value: "name", label: route.tab === "stocks" ? (zh ? "代码 A–Z" : "Ticker A–Z") : zh ? "名称 A–Z" : "Name A–Z" },
  ];
  const invalidRange = Boolean(draft.from && draft.to && draft.from > draft.to);
  const hasMore =
    detail?.pagination?.has_more ??
    Boolean(detail && opinions.length < detail.summary.total_opinions);
  const refresh = () => setRevision((value) => value + 1);
  const root: Route = { tab: route.tab };
  const back =
    route.creator && route.ticker
      ? { tab: "creators" as const, creator: route.creator }
      : root;
  const rowClass =
    "group grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border py-3.5 transition-colors duration-150 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:-mx-3 sm:rounded-xl sm:border-transparent sm:px-3";
  const dateFormatter = new Intl.DateTimeFormat(zh ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const formatDay = (value?: string | null) => {
    if (!value) return "";
    const parsed = new Date(value.length === 10 ? `${value}T00:00:00` : value);
    return Number.isNaN(parsed.getTime()) ? value.slice(0, 10) : dateFormatter.format(parsed);
  };
  const overview = context?.summary;
  const chartPoints: StrengthPoint[] = (context?.daily || []).map((day) => ({
    date: day.date,
    value: day.avg_score,
    count: day.total,
  }));
  const headlineValue = scrub ? scrub.value : overview?.avg_score;
  const headline = describeStrength(headlineValue, { zh });
  const overallTone = describeStrength(overview?.avg_score, { zh }).tone;
  const sentimentOptions = [
    { value: "all", label: zh ? "全部" : "All" },
    { value: "bullish", label: t("youtubeOpinions.bullish") },
    { value: "bearish", label: t("youtubeOpinions.bearish") },
    { value: "neutral", label: t("youtubeOpinions.neutral") },
    { value: "mixed", label: t("youtubeOpinions.mixed") },
  ];
  const rangeOptions: Array<{ value: Range; label: string }> = [
    { value: "1m", label: zh ? "1个月" : "1M" },
    { value: "3m", label: zh ? "3个月" : "3M" },
    { value: "6m", label: zh ? "6个月" : "6M" },
    { value: "1y", label: zh ? "1年" : "1Y" },
    { value: "all", label: zh ? "全部" : "All" },
  ];
  const changes = (route.creator ? context?.changes : catalogue?.changes) || [];
  const notableChanges = changes.filter((change) => change.change !== null).slice(0, 8);

  const pill = (active: boolean) =>
    cn(
      "inline-flex h-8 shrink-0 items-center rounded-full px-3.5 text-[13px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
      active
        ? "bg-foreground text-background"
        : "text-muted-foreground hover:bg-muted hover:text-foreground",
    );

  const stockRows = (
    <div className="min-w-0">
      {visibleStocks.map((item) => (
        <ExplorerLink
          onNavigate={navigate}
          key={item.ticker}
          target={{
            tab: route.creator ? "creators" : "stocks",
            ticker: item.ticker,
            creator: route.creator,
          }}
          className={rowClass}
          label={`${zh ? "查看股票" : "View stock"}: ${item.ticker}`}
        >
          <div className="flex min-w-0 items-center gap-3">
            <CompanyLogo symbol={item.ticker} size="md" />
            <div className="min-w-0">
              <p className="text-[15px] font-semibold">{item.ticker}</p>
              <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
                {item.company_name || item.ticker}
              </p>
            </div>
          </div>
          <div className="flex min-w-0 flex-col items-end gap-0.5 text-right">
            <OpinionStrength value={item.avg_score} />
            <p className="text-xs text-muted-foreground tabular-nums">
              {zh
                ? `${item.creator_count} 位博主，${item.total_opinions} 条观点`
                : `${item.creator_count} creators, ${item.total_opinions} opinions`}
            </p>
          </div>
        </ExplorerLink>
      ))}
      {!visibleStocks.length && (
        <EmptyLine
          text={filtering ? (zh ? "没有符合筛选条件的股票" : "No stocks match these filters") : t("youtubeOpinions.noData")}
          action={filtering ? { label: zh ? "清除筛选" : "Clear filters", onClick: clearFilters } : undefined}
        />
      )}
    </div>
  );

  const creatorRows = (items: YouTubeCreatorSummary[]) => (
    <div className="min-w-0">
      {items.map((item) => (
        <ExplorerLink
          onNavigate={navigate}
          key={item.channel_id}
          target={{ tab: "creators", creator: item.channel_id }}
          className={rowClass}
          label={`${zh ? "查看博主" : "View creator"}: ${item.channel_title || item.channel_id}`}
        >
          <div className="flex min-w-0 items-center gap-3">
            <Avatar creator={item} />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold">
                {item.channel_title || item.channel_id}
              </p>
              <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
                {item.channel_handle || item.channel_id}
              </p>
            </div>
          </div>
          <div className="flex min-w-0 flex-col items-end gap-0.5 text-right">
            <OpinionStrength value={item.avg_score} />
            <p className="text-xs text-muted-foreground tabular-nums">
              {zh ? `${item.total_opinions} 条观点` : `${item.total_opinions} opinions`}
            </p>
          </div>
        </ExplorerLink>
      ))}
    </div>
  );

  const changeList = notableChanges.length > 0 && (
    <section className="min-w-0">
      <h2 className="text-base font-semibold">
        {zh ? "最近观点变化" : "Recent shifts"}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {zh ? "与该股票上一次被讨论时相比" : "Compared with the previous day it was discussed"}
      </p>
      <ul className="mt-3">
        {notableChanges.map((change) => (
          <li key={change.ticker}>
            <ExplorerLink
              onNavigate={navigate}
              target={{
                tab: route.creator ? "creators" : "stocks",
                ticker: change.ticker,
                creator: route.creator,
              }}
              className="flex min-w-0 items-center justify-between gap-3 border-b border-border py-3 text-sm last:border-0 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className="min-w-0">
                <span className="block font-semibold">{change.ticker}</span>
                <span className="block text-xs text-muted-foreground tabular-nums">
                  {formatDay(change.current_date)}
                </span>
              </span>
              <OpinionStrength value={change.change} change />
            </ExplorerLink>
          </li>
        ))}
      </ul>
    </section>
  );

  const loadingBlock = (
    <div role="status" className="space-y-3 py-6" aria-label={zh ? "加载中" : "Loading"}>
      {[0, 1, 2, 3, 4].map((index) => (
        <div key={index} className="flex items-center justify-between gap-4 py-2">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-36" />
          </div>
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  );

  const tabSwitcher = (
    <nav
      aria-label={zh ? "浏览方式" : "Browse by"}
      className="ml-2 flex items-center gap-0.5 rounded-full bg-muted p-1"
    >
      {([
        { tab: "stocks", label: zh ? "按股票" : "By stock" },
        { tab: "creators", label: zh ? "按博主" : "By creator" },
      ] as const).map((item) => {
        const active = route.tab === item.tab;
        return (
          <button
            key={item.tab}
            type="button"
            aria-current={active ? "page" : undefined}
            onClick={() => {
              if (!active || inDetail) navigate({ tab: item.tab });
            }}
            className={cn(
              "h-8 rounded-full px-3.5 text-[13px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              active
                ? "bg-background text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.12)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );

  const breadcrumbNav = (
    <nav
      aria-label={zh ? "位置" : "Breadcrumb"}
      className="ml-1 flex min-w-0 items-center gap-1 text-sm text-muted-foreground"
    >
      <Button
        size="icon"
        variant="ghost"
        title={zh ? "返回" : "Back"}
        aria-label={zh ? "返回" : "Back"}
        className="-ml-2 h-9 w-9 shrink-0"
        onClick={() => navigate(back)}
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <ExplorerLink onNavigate={navigate} target={root} className="hover:text-foreground">
        {route.tab === "stocks" ? (zh ? "全部股票" : "All stocks") : zh ? "全部博主" : "All creators"}
      </ExplorerLink>
      {route.creator && route.ticker && (
        <>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          <ExplorerLink
            onNavigate={navigate}
            target={{ tab: "creators", creator: route.creator }}
            className="min-w-0 truncate hover:text-foreground"
          >
            {title}
          </ExplorerLink>
        </>
      )}
    </nav>
  );

  return (
    <DashboardLayout
      title={t("youtubeOpinions.title")}
      headerExtra={inDetail ? breadcrumbNav : tabSwitcher}
      headerActions={
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-10 w-10"
            title={t("youtubeOpinions.refresh")}
            aria-label={t("youtubeOpinions.refresh")}
            onClick={refresh}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          {profile?.is_admin && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => setUploadOpen(true)}
            >
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">{t("youtubeOpinions.uploadJson")}</span>
            </Button>
          )}
        </div>
      }
    >
      <div
        ref={scrollContainer}
        className="min-h-0 min-w-0 flex-1 overflow-y-auto"
      >
        <div className="mx-auto w-full min-w-0 max-w-[1180px] px-4 pb-16 pt-5 md:px-8 md:pt-7">
          <Tabs
            value={route.tab}
            onValueChange={(value) => navigate({ tab: value as Route["tab"] })}
          >

            {!inDetail && (
              <div className="grid min-w-0 gap-10 xl:grid-cols-[minmax(0,1fr)_300px]">
                <div className="min-w-0">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h2 className="text-[28px] font-semibold leading-tight tracking-[-0.02em]">
                        {route.tab === "stocks"
                          ? zh ? "博主讨论过的股票" : "Stocks creators discuss"
                          : zh ? "追踪的博主" : "Tracked creators"}
                      </h2>
                      {catalogue && (
                        <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                          {zh
                            ? `${catalogue.summary.total_stocks} 只股票，${catalogue.summary.total_creators} 位博主，${catalogue.summary.total_opinions} 条观点`
                            : `${catalogue.summary.total_stocks} stocks, ${catalogue.summary.total_creators} creators, ${catalogue.summary.total_opinions} opinions`}
                        </p>
                      )}
                    </div>
                    <div className="relative w-full sm:max-w-xs">
                      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        aria-label={zh ? "搜索" : "Search"}
                        placeholder={
                          route.tab === "stocks"
                            ? zh ? "搜索代码或公司" : "Search ticker or company"
                            : zh ? "搜索博主或频道" : "Search creator or channel"
                        }
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        className="h-10 rounded-full pl-10 text-base sm:text-sm"
                      />
                    </div>
                  </div>
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                    <div
                      role="radiogroup"
                      aria-label={zh ? "按观点筛选" : "Filter by sentiment"}
                      className="flex items-center gap-1 overflow-x-auto scrollbar-hide"
                    >
                      {toneOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          role="radio"
                          aria-checked={toneFilter === option.value}
                          onClick={() => setToneFilter(option.value)}
                          className={pill(toneFilter === option.value)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <div className="ml-auto flex shrink-0 items-center gap-2">
                      {catalogue && (
                        <span className="shrink-0 whitespace-nowrap text-[13px] text-muted-foreground tabular-nums">
                          {zh
                            ? `${route.tab === "stocks" ? visibleStocks.length : visibleCreators.length} 项`
                            : `${route.tab === "stocks" ? visibleStocks.length : visibleCreators.length} shown`}
                        </span>
                      )}
                      <Select value={sortBy} onValueChange={(value) => setSortBy(value as DirectorySort)}>
                        <SelectTrigger
                          aria-label={zh ? "排序" : "Sort"}
                          className="h-8 w-auto gap-1.5 rounded-full border-transparent bg-transparent px-3 text-[13px] font-semibold hover:bg-muted"
                        >
                          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent align="end">
                          {sortOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="mt-1">
                    {catalogueError ? (
                      <EmptyLine
                        text={zh ? "观点目录加载失败，请检查网络后重试。" : "The opinion directory didn't load. Check your connection and try again."}
                        action={{ label: zh ? "重试" : "Retry", onClick: refresh }}
                        alert
                      />
                    ) : !catalogue ? (
                      loadingBlock
                    ) : (
                      <>
                        <TabsContent value="stocks" className="mt-0">{stockRows}</TabsContent>
                        <TabsContent value="creators" className="mt-0">
                          {creatorRows(visibleCreators)}
                          {!visibleCreators.length && (
                            <EmptyLine
                              text={filtering ? (zh ? "没有符合筛选条件的博主" : "No creators match these filters") : t("youtubeOpinions.noData")}
                              action={filtering ? { label: zh ? "清除筛选" : "Clear filters", onClick: clearFilters } : undefined}
                            />
                          )}
                        </TabsContent>
                      </>
                    )}
                  </div>
                </div>
                {changeList && (
                  <aside className="min-w-0 xl:sticky xl:top-6 xl:self-start">{changeList}</aside>
                )}
              </div>
            )}

            {inDetail && (
              <TabsContent value={route.tab} className="mt-0 min-w-0">
                <div className="grid min-w-0 gap-x-12 gap-y-10 xl:grid-cols-[minmax(0,1fr)_300px] xl:grid-rows-[auto_1fr]">
                  <div className="min-w-0 xl:col-start-1">
                    <div className="flex min-w-0 items-center gap-4">
                      {route.creator && !route.ticker && creator && <Avatar creator={creator} size="lg" />}
                      <div className="min-w-0 flex-1">
                        <h2 className="break-words text-[32px] font-semibold leading-tight tracking-[-0.025em]">
                          {route.ticker || title}
                        </h2>
                        <p className="mt-0.5 break-words text-sm text-muted-foreground">
                          {route.creator
                            ? route.ticker
                              ? zh ? `${title} 的观点` : `Opinions from ${title}`
                              : creator?.channel_handle
                            : stock?.company_name || context?.stocks[0]?.company_name}
                        </p>
                      </div>
                      {creator && <CreatorProfileDialog creator={creator} compact />}
                    </div>

                    {contextError ? (
                      <EmptyLine
                        text={zh ? "观点概览加载失败。" : "The overview didn't load."}
                        action={{ label: zh ? "重试" : "Retry", onClick: refresh }}
                        alert
                      />
                    ) : !context ? (
                      <div className="mt-6 space-y-4" role="status" aria-label={zh ? "加载中" : "Loading"}>
                        <Skeleton className="h-8 w-40" />
                        <Skeleton className="h-4 w-56" />
                        <Skeleton className="h-[150px] w-full sm:h-[190px]" />
                      </div>
                    ) : (
                      <>
                        <div className="mt-6" aria-live="polite">
                          <p className={cn("text-[28px] font-semibold leading-tight tracking-[-0.02em] sm:text-[32px]", toneText[headline.tone])}>
                            {overview?.total_opinions ? headline.label : zh ? "暂无观点" : "No opinions yet"}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                            {scrub
                              ? zh
                                ? `${formatDay(scrub.date)}，${scrub.count} 条观点`
                                : `${formatDay(scrub.date)}, ${scrub.count} opinions`
                              : overview
                                ? zh
                                  ? `${overview.total_opinions} 条观点，${overview.total_creators} 位博主${overview.latest_opinion_at ? `，最新 ${formatDay(overview.latest_opinion_at)}` : ""}`
                                  : `${overview.total_opinions} opinions, ${overview.total_creators} creators${overview.latest_opinion_at ? `, latest ${formatDay(overview.latest_opinion_at)}` : ""}`
                                : ""}
                          </p>
                        </div>

                        {chartPoints.length > 0 && (
                          <div className="mt-6">
                            <StrengthChart
                              points={chartPoints}
                              tone={overallTone}
                              label={zh ? "观点强度走势，左右方向键查看每天" : "Opinion strength over time; use arrow keys to step through days"}
                              formatDate={formatDay}
                              onScrub={setScrub}
                            />
                          </div>
                        )}

                        <div
                          role="radiogroup"
                          aria-label={zh ? "时间范围" : "Time range"}
                          className="mt-3 flex items-center gap-1 overflow-x-auto border-b border-border pb-4 scrollbar-hide"
                        >
                          {rangeOptions.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              role="radio"
                              aria-checked={filters.range === option.value}
                              className={pill(filters.range === option.value)}
                              onClick={() =>
                                setFilters((previous) => ({
                                  ...previous,
                                  range: option.value,
                                  from: rangeStart(option.value),
                                  to: "",
                                }))
                              }
                            >
                              {option.label}
                            </button>
                          ))}
                          <Popover
                            open={filtersOpen}
                            onOpenChange={(open) => {
                              if (open) setDraft(filters);
                              setFiltersOpen(open);
                            }}
                          >
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                role="radio"
                                aria-checked={filters.range === "custom"}
                                className={cn(pill(filters.range === "custom"), "gap-1.5")}
                              >
                                <CalendarDays className="h-3.5 w-3.5" />
                                {filters.range === "custom"
                                  ? `${filters.from || "…"} – ${filters.to || "…"}`
                                  : zh ? "自定义" : "Custom"}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent align="start" className="w-[300px] p-4">
                              <p className="text-sm font-semibold">{zh ? "自定义时间范围" : "Custom range"}</p>
                              <div className="mt-3 grid gap-3">
                                <DateFilterField
                                  label={t("youtubeOpinions.dateFrom")}
                                  value={draft.from}
                                  max={draft.to || undefined}
                                  onChange={(from) => setDraft((previous) => ({ ...previous, from }))}
                                />
                                <DateFilterField
                                  label={t("youtubeOpinions.dateTo")}
                                  value={draft.to}
                                  min={draft.from || undefined}
                                  onChange={(to) => setDraft((previous) => ({ ...previous, to }))}
                                />
                                {invalidRange && (
                                  <p role="alert" className="text-xs text-negative">
                                    {t("youtubeOpinions.invalidDateRange")}
                                  </p>
                                )}
                              </div>
                              <div className="mt-4 flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setFilters((previous) => ({ ...previous, range: "all", from: "", to: "" }));
                                    setFiltersOpen(false);
                                  }}
                                >
                                  {t("youtubeOpinions.resetDates")}
                                </Button>
                                <Button
                                  size="sm"
                                  disabled={invalidRange || (!draft.from && !draft.to)}
                                  onClick={() => {
                                    setFilters((previous) => ({
                                      ...previous,
                                      range: "custom",
                                      from: draft.from,
                                      to: draft.to,
                                    }));
                                    setFiltersOpen(false);
                                  }}
                                >
                                  {t("youtubeOpinions.apply")}
                                </Button>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>

                        {overview && overview.total_opinions > 0 && (
                          <div>
                            <OpinionDistribution summary={overview} zh={zh} />
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <aside className="min-w-0 space-y-10 xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:sticky xl:top-6 xl:self-start">
                    {route.creator && !route.ticker && (
                      <section className="min-w-0">
                        <h2 className="text-base font-semibold">
                          {zh ? "讨论过的股票" : "Stocks discussed"}
                        </h2>
                        {(context?.stocks.length || 0) > 6 && (
                          <div className="relative mt-3">
                            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              aria-label={zh ? "搜索股票" : "Search stocks"}
                              value={search}
                              onChange={(event) => setSearch(event.target.value)}
                              placeholder={zh ? "搜索代码或公司" : "Search ticker or company"}
                              className="h-10 rounded-full pl-10 text-base sm:text-sm"
                            />
                          </div>
                        )}
                        <div className="mt-2">{context ? stockRows : loadingBlock}</div>
                      </section>
                    )}
                    {!route.creator && (
                      <section className="min-w-0">
                        <h2 className="text-base font-semibold">
                          {zh ? "讨论这只股票的博主" : "Creators discussing it"}
                        </h2>
                        <div className="mt-2">
                          {context ? creatorRows(context.creators) : loadingBlock}
                        </div>
                      </section>
                    )}
                    {route.creator && !route.ticker && changeList}
                  </aside>

                  <section className="min-w-0 xl:col-start-1">
                    <div className="flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
                      <h2 className="text-lg font-semibold">
                        {zh ? "历史观点" : "Opinion history"}
                        {detail && (
                          <span className="ml-2 text-sm font-normal text-muted-foreground tabular-nums">
                            {detail.summary.total_opinions}
                          </span>
                        )}
                      </h2>
                      <div
                        role="radiogroup"
                        aria-label={t("youtubeOpinions.sentiment")}
                        className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 scrollbar-hide"
                      >
                        {sentimentOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={filters.sentiment === option.value}
                            className={pill(filters.sentiment === option.value)}
                            onClick={() =>
                              setFilters((previous) => ({ ...previous, sentiment: option.value }))
                            }
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {loading ? (
                      loadingBlock
                    ) : (
                      <>
                        {detailError && (
                          <EmptyLine
                            text={zh ? "观点加载失败，请重试。" : "Opinions didn't load. Try again."}
                            action={{ label: zh ? "重试" : "Retry", onClick: detail ? loadMore : refresh }}
                            alert
                          />
                        )}
                        {!detailError && !opinions.length && (
                          <EmptyLine
                            text={
                              filters.sentiment !== "all" || filters.range !== "all"
                                ? zh ? "当前筛选条件下没有观点。" : "No opinions match these filters."
                                : t("youtubeOpinions.noData")
                            }
                            action={
                              filters.sentiment !== "all" || filters.range !== "all"
                                ? { label: zh ? "清除筛选" : "Clear filters", onClick: () => setFilters(emptyFilters) }
                                : undefined
                            }
                          />
                        )}
                        <div className="min-w-0">
                          {opinions.map((opinion) => (
                            <OpinionCard
                              key={opinion.id}
                              opinion={opinion}
                              t={t}
                              showCreator={!route.creator}
                              showTicker={!route.ticker}
                              onCreator={(channelId) => navigate({ tab: "creators", creator: channelId })}
                              onStock={(ticker) =>
                                navigate({
                                  tab: route.creator ? "creators" : "stocks",
                                  creator: route.creator,
                                  ticker,
                                })
                              }
                            />
                          ))}
                        </div>
                        {hasMore && (
                          <div className="mt-6 flex justify-center">
                            <Button variant="outline" onClick={loadMore} disabled={moreLoading}>
                              {moreLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                              {zh ? "加载更多观点" : "Load more opinions"}
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </section>
                </div>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>

      <Dialog
        open={Boolean(profile?.is_admin && uploadOpen)}
        onOpenChange={setUploadOpen}
      >
        <DialogContent className="max-w-3xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>{t("youtubeOpinions.uploadTitle")}</DialogTitle>
            <DialogDescription>
              {t("youtubeOpinions.uploadDescription")}
            </DialogDescription>
          </DialogHeader>
          <YouTubeOpinionImporter
            onImported={() => {
              setUploadOpen(false);
              refresh();
            }}
          />
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function EmptyLine({
  text,
  action,
  alert = false,
}: {
  text: string;
  action?: { label: string; onClick: () => void };
  alert?: boolean;
}) {
  return (
    <div
      role={alert ? "alert" : undefined}
      className="flex flex-wrap items-center gap-3 py-10 text-sm text-muted-foreground"
    >
      <span>{text}</span>
      {action && (
        <Button size="sm" variant="outline" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
