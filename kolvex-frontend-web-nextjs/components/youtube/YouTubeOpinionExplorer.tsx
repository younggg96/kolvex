"use client";

import { isProductFeatureEnabled } from "@/lib/productFeatures";

import Link from "next/link";
import { formatOpinionDate } from "@/lib/opinionDates";
import { useRouter } from "next/navigation";
import HeaderBackButton from "@/components/layout/HeaderBackButton";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import {
  ArrowUpDown,
  LineChart,
  Loader2,
  Search,
  X,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ListCard,
  ListColumnHeader,
  ListFooterLink,
  ListLoadMore,
  ListRow,
  ListRows,
  ListToolbar,
  listCompactRowClass,
  listFeedRowClass,
  listRowTargetClass,
} from "@/components/ui/list-card";
import { Input } from "@/components/ui/input";
import CompanyLogo from "@/components/ui/company-logo";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  getYouTubeOpinionDashboard,
  getCachedYouTubeOpinionDashboard,
  clearYouTubeDashboardCache,
  getYouTubeUploadCoverage,
  type YouTubeCreatorSummary,
  type YouTubeOpinionDashboard,
  type YouTubeOpinion,
  type YouTubeUploadCoverage,
} from "@/lib/youtubeOpinionsApi";
import CreatorAvatar from "./CreatorAvatar";
import CreatorProfileDialog from "./CreatorProfileDialog";
import OpinionDateRangePicker from "./OpinionDateRangePicker";
import OpinionCard from "./OpinionCard";
import OtherCreatorOpinions from "./OtherCreatorOpinions";
import OpinionDistribution from "./OpinionDistribution";
import OpinionStrength from "./OpinionStrength";
import StockDirectoryRow from "./StockDirectoryRow";
import OpinionChange from "./OpinionChange";
import PriceChart from "./PriceChart";
import StrengthChart, { type StrengthPoint } from "./StrengthChart";
import VideoOpinionCard from "./VideoOpinionCard";
import { videoHistory } from "@/lib/youtubeVideoHistory";
import { formatPrice } from "@/lib/stockApi";
import { useStockPerformance } from "@/hooks/useStockPerformance";
import CreatorShare from "./CreatorShare";
import { describeStrength, toneText, type StrengthTone } from "./strength";
import { HeldMark, useHeldTickers, useCopy } from "@/components/decision/shared";

type DirectoryTone = "all" | StrengthTone;
type HistoryView = "videos" | "opinions";
type ChartView = "price" | "opinions";
type DirectorySort = "opinions" | "creators" | "latest" | "bullish" | "bearish" | "name" | "heat" | "strengthening" | "weakening" | "first";
type StockScope = "all" | "holdings";

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
  size?: "sm" | "md" | "lg";
}) {
  return (
    <CreatorAvatar
      name={creator.channel_title || creator.channel_id}
      avatarUrl={creator.channel_avatar_url}
      size={size}
    />
  );
}

export default function YouTubeOpinionExplorer({ allStocks = false }: { allStocks?: boolean }) {
  const router = useRouter();
  const c = useCopy();
  const { t } = useTranslation();
  const [route, setRoute] = useState<Route>({ tab: "stocks" });
  const [ready, setReady] = useState(false);
  const [catalogue, setCatalogue] = useState<YouTubeOpinionDashboard | null>(null);
  const [coverage, setCoverage] = useState<Record<string, YouTubeUploadCoverage>>({});
  const [catalogueError, setCatalogueError] = useState("");
  const [detail, setDetail] = useState<YouTubeOpinionDashboard | null>(null);
  const [context, setContext] = useState<YouTubeOpinionDashboard | null>(null);
  const [contextError, setContextError] = useState("");
  const [opinions, setOpinions] = useState<YouTubeOpinion[]>([]);
  const [loading, setLoading] = useState(false);
  const [moreLoading, setMoreLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [search, setSearch] = useState("");
  const [showAllCreatorStocks, setShowAllCreatorStocks] = useState(false);
  const creatorOverview = Boolean(route.creator && !route.ticker);
  const [toneFilter, setToneFilter] = useState<DirectoryTone>("all");
  const [sortBy, setSortBy] = useState<DirectorySort>("latest");
  const [revision, setRevision] = useState(0);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [scrub, setScrub] = useState<StrengthPoint | null>(null);
  const [historyView, setHistoryView] = useState<HistoryView>("videos");
  const [showUntrackedVideos, setShowUntrackedVideos] = useState(false);
  const [chartView, setChartView] = useState<ChartView>("price");
  // AI drawing results render in their own card below the price chart, matching
  // the Market stock page's chart/results split.
  const [chartResults, setChartResults] = useState<HTMLDivElement | null>(null);
  const detailRequest = useRef(0);
  const navigationRequest = useRef(0);
  const [navigating, setNavigating] = useState(false);
  const scrollContainer = useRef<HTMLDivElement>(null);
  const [performanceLimit, setPerformanceLimit] = useState(24);
  const opinionHistory = useRef<HTMLElement>(null);
  const inDetail = Boolean(route.ticker || route.creator);
  const held = useHeldTickers(revision);
  const [stockScope, setStockScope] = useState<StockScope>("all");
  const [directoryLimit, setDirectoryLimit] = useState(40);
  const searchInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setShowUntrackedVideos(false);
  }, [route.creator]);

  useEffect(() => {
    const invalidateNavigation = () => { navigationRequest.current++; };
    const sync = () => {
      navigationRequest.current++;
      setNavigating(false);
      setRoute(allStocks ? { tab: "stocks" } : readRoute());
      setFilters(emptyFilters);
      const params = new URLSearchParams(window.location.search);
      setSearch(params.get("q") || "");
      const scope = params.get("scope");
      setStockScope(scope === "holdings" && isProductFeatureEnabled("portfolio") ? scope : "all");
      const sort = params.get("sort") || "latest";
      setSortBy((["opinions", "creators", "latest", "bullish", "bearish", "name", "heat", "strengthening", "weakening", "first"].includes(sort) ? sort : "latest") as DirectorySort);
      const tone = params.get("tone");
      setToneFilter(tone === "positive" || tone === "negative" || tone === "neutral" ? tone : "all");
      setShowAllCreatorStocks(false);
      scrollContainer.current?.scrollTo({ top: 0 });
    };
    sync();
    setReady(true);
    window.addEventListener("popstate", sync);
    return () => {
      invalidateNavigation();
      window.removeEventListener("popstate", sync);
    };
  }, [allStocks]);

  useEffect(() => {
    if (!ready || inDetail) return;
    const url = new URL(window.location.href);
    for (const [key, value, fallback] of [["q", search, ""], ["sort", sortBy, "latest"], ["tone", toneFilter, "all"], ["scope", stockScope, "all"]]) {
      if (value === fallback) url.searchParams.delete(key); else url.searchParams.set(key, value);
    }
    window.history.replaceState(null, "", url);
  }, [ready, inDetail, search, sortBy, toneFilter, stockScope]);

  useEffect(() => { setDirectoryLimit(40); }, [search, sortBy, toneFilter, stockScope]);

  useEffect(() => {
    let active = true;
    setCatalogueError("");
    const cached = getCachedYouTubeOpinionDashboard({ limit: 8 });
    if (cached) setCatalogue(cached);
    getYouTubeOpinionDashboard({ limit: 8 })
      .then((result) => {
        if (active) setCatalogue(result);
      })
      .catch((error) => {
        if (active && !cached)
          setCatalogueError(
            error instanceof Error ? error.message : "Failed to load directory",
          );
      });
    return () => {
      active = false;
    };
  }, [revision]);

  useEffect(() => {
    let active = true;
    getYouTubeUploadCoverage()
      .then((result) => {
        if (!active) return;
        if (result.status === "not_configured") {
          setCoverage({});
          return;
        }
        setCoverage(Object.fromEntries(result.creators.map((creator) => [creator.channel_id, creator])));
      })
      .catch(() => {
        if (active) setCoverage({});
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
      setContext(getCachedYouTubeOpinionDashboard({ ticker: route.ticker, channel_id: route.creator, limit: pageSize }) || null);
      lastContextKey.current = contextKey;
    }
    setContextError("");
    if (!ready || !inDetail) return;
    getYouTubeOpinionDashboard({
      ticker: route.ticker,
      channel_id: route.creator,
      date_from: creatorOverview ? undefined : filters.from || undefined,
      date_to: creatorOverview ? undefined : filters.to || undefined,
      limit: pageSize,
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
  }, [ready, inDetail, contextKey, route.ticker, route.creator, creatorOverview, filters.from, filters.to, revision]);

  useEffect(() => {
    const request = ++detailRequest.current;
    let active = true;
    const cached = getCachedYouTubeOpinionDashboard({
      ticker: route.ticker,
      channel_id: route.creator,
      sentiment: filters.sentiment === "all" ? undefined : filters.sentiment,
      date_from: filters.from || undefined,
      date_to: filters.to || undefined,
      limit: pageSize,
    });
    setDetail(cached || null);
    setOpinions(cached?.latest || []);
    setDetailError("");
    setMoreLoading(false);
    if (!ready || !inDetail) {
      setLoading(false);
      return;
    }
    setLoading(!cached);
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

  async function navigate(next: Route) {
    navigationRequest.current++;
    setNavigating(false);
    if (allStocks) {
      router.push(routeHref(next));
      return;
    }
    detailRequest.current++;
    const prepared = getCachedYouTubeOpinionDashboard({ ticker: next.ticker, channel_id: next.creator, limit: pageSize });
    setDetail(prepared || null);
    setContext(prepared || null);
    lastContextKey.current = `${next.ticker || ""}|${next.creator || ""}`;
    setOpinions(prepared?.latest || []);
    setLoading(!prepared && Boolean(next.creator || next.ticker));
    window.history.pushState(null, "", routeHref(next));
    setRoute(next);
    setSearch("");
    setShowAllCreatorStocks(false);
    setToneFilter("all");
    if (next.tab === "creators" && sortBy === "creators") setSortBy("opinions");
    setFilters(emptyFilters);
    setScrub(null);
    setChartView("price");
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
    ? creator?.channel_title || creator?.channel_handle || c("Creator opinions", "博主观点")
    : route.ticker;
  const query = search.trim().toLocaleLowerCase();
  const stocks = (route.creator ? context?.stocks : catalogue?.stocks) || [];
  const changes = useMemo(() => (route.creator ? context?.changes : catalogue?.changes) || [], [route.creator, context?.changes, catalogue?.changes]);
  const changesByTicker = useMemo(() => new Map(changes.map(change => [change.ticker, change])), [changes]);
  const directoryActive = !inDetail;
  const matchesTone = (score: number) =>
    !directoryActive || toneFilter === "all" || describeStrength(score, { t }).tone === toneFilter;
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
    .filter(item => !directoryActive || stockScope === "all" ||
      held.tickers.includes(item.ticker))
    .sort((a, b) => {
      if (activeSort === "heat") return (b.discussion_heat?.recent ?? -1) - (a.discussion_heat?.recent ?? -1) || b.total_opinions - a.total_opinions;
      if (activeSort === "first") return Number(changesByTicker.get(b.ticker)?.previous_date === null) - Number(changesByTicker.get(a.ticker)?.previous_date === null) || latestTime(b.latest_opinion_at) - latestTime(a.latest_opinion_at);
      if (activeSort === "strengthening" || activeSort === "weakening") {
        const left = changesByTicker.get(a.ticker)?.change;
        const right = changesByTicker.get(b.ticker)?.change;
        if (left == null || right == null) return left == null ? right == null ? 0 : 1 : -1;
        return activeSort === "strengthening" ? right - left : left - right;
      }
      return compareBy(a, b, (item) => item.ticker, (item) => item.creator_count);
    });
  const creators = catalogue?.creators || [];
  const visibleCreators = creators
    .filter(
      (item) =>
        `${item.channel_title || ""} ${item.channel_handle || ""} ${item.channel_id}`
          .toLocaleLowerCase()
          .includes(query) && matchesTone(item.avg_score),
    )
    .sort((a, b) => compareBy(a, b, (item) => item.channel_title || item.channel_id));
  const filtering = Boolean(query) || (directoryActive && (toneFilter !== "all" || stockScope !== "all"));
  const clearFilters = () => {
    setSearch("");
    setToneFilter("all");
    setStockScope("all");
  };
  const toneOptions: Array<{ value: DirectoryTone; label: string }> = [
    { value: "all", label: t("common.all") },
    { value: "positive", label: t("youtubeOpinions.bullish") },
    { value: "negative", label: t("youtubeOpinions.bearish") },
    { value: "neutral", label: t("youtubeOpinions.neutral") },
  ];
  const sortOptions: Array<{ value: DirectorySort; label: string }> = [
    { value: "opinions", label: t("youtubeOpinions.mostOpinions") },
    ...(route.tab === "stocks"
      ? [{ value: "creators" as const, label: t("youtubeOpinions.mostCreators") },
        { value: "heat" as const, label: t("youtubeOpinions.directory.hottest") },
        { value: "strengthening" as const, label: t("youtubeOpinions.directory.strengthening") },
        { value: "weakening" as const, label: t("youtubeOpinions.directory.weakening") },
        { value: "first" as const, label: t("youtubeOpinions.directory.firstCoverageFirst") }]
      : []),
    { value: "latest", label: t("youtubeOpinions.mostRecent") },
    { value: "bullish", label: t("youtubeOpinions.mostBullish") },
    { value: "bearish", label: t("youtubeOpinions.mostBearish") },
    { value: "name", label: route.tab === "stocks" ? t("youtubeOpinions.tickerAZ") : t("youtubeOpinions.nameAZ") },
  ];
  const hasMore =
    detail?.pagination?.has_more ??
    Boolean(detail && opinions.length < detail.summary.total_opinions);
  const refresh = () => {
    clearYouTubeDashboardCache();
    setRevision((value) => value + 1);
  };
  const root: Route = { tab: route.tab };
  const back =
    route.creator && route.ticker
      ? { tab: "creators" as const, creator: route.creator }
      : root;
  const rowClass =
    "group grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-b border-border py-3.5 transition-colors duration-150 hover:bg-muted/60 focus-visible:outline-none sm:-mx-3 sm:rounded-3xl sm:border-transparent sm:px-3";
  const stockRowClass = cn(rowClass, "grid-cols-[minmax(0,1fr)_auto] gap-x-3 sm:grid-cols-[minmax(0,1fr)_110px_160px] sm:gap-x-4");
  // Rows inside one card body reuse the shared row target metrics (rounded-2xl,
  // min-h-20, no ring) while the ListRow supplies the hover/focus-within surface.
  const cardRowClass = cn(
    "group grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2",
    listRowTargetClass,
  );
  const cardStockRowClass = cn(
    "group grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 sm:grid-cols-[minmax(0,1fr)_110px_160px] sm:gap-x-4",
    listRowTargetClass,
  );
  // Narrow rails keep the two-column mobile row layout at every breakpoint.
  const cardNarrowStockRowClass = cn(
    "group grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2",
    listRowTargetClass,
  );
  // Column headings mirror the row grids so labels line up with their cells.
  const stockColumnHeaderClass =
    "grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-2 py-3 sm:grid-cols-[minmax(0,1fr)_110px_160px] sm:gap-x-4";
  const creatorColumnHeaderClass =
    "grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-2 py-3";
  const formatPercent = (value?: number | null) =>
    typeof value === "number" && Number.isFinite(value)
      ? `${value > 0 ? "+" : ""}${value.toFixed(2)}%`
      : "—";
  const percentTone = (value?: number | null) =>
    typeof value === "number" && value > 0
      ? "text-positive"
      : typeof value === "number" && value < 0
        ? "text-negative"
        : "text-foreground/70";
  /** Non-US listings quote in their own currency; `$` would be wrong for them. */
  const nonUsListed = (symbol: string) =>
    /\.(KS|KQ|HK|TW|T|L|DE|F|PA|AS|MC|MI|SW|VI|TO|V|AX|NZ|SI|SA|MX|JO|TA|IS|BK|JK|KL|NS|BO|SS|SZ|ST|HE|CO|OL|IR|BR|LS)$/i.test(symbol) ||
    /^[=^]/.test(symbol);
  const localPrice = (symbol: string, price: number) =>
    nonUsListed(symbol)
      ? new Intl.NumberFormat(t("common.intlLocale"), { maximumFractionDigits: 2 }).format(price)
      : formatPrice(price);
  const formatDay = (value?: string | null) => {
    return formatOpinionDate(value, t("common.intlLocale"));
  };
  const lastUpdated = (value?: string | null) => {
    const date = formatDay(value);
    if (!value || !date) return null;
    return (
      <time dateTime={value.slice(0, 10)} className="whitespace-nowrap text-xs text-muted-foreground tabular-nums">
        {t("youtubeOpinions.lastUpdated", { date })}
      </time>
    );
  };
  const coverageNote = (channelId?: string) => {
    const item = channelId ? coverage[channelId] : undefined;
    if (!item || item.status !== "available" || !item.since || item.untracked_count === 0) return null;
    const label = item.truncated
      ? t("youtubeOpinions.uploadsAllUntracked", { count: String(item.untracked_count) })
      : t("youtubeOpinions.uploadsUntracked", { count: String(item.untracked_count) });
    const hint = item.untracked.map((video) => video.title).filter((title): title is string => Boolean(title)).slice(0, 3).join(" · ");
    return (
      <p title={hint || undefined} className="mt-0.5 truncate text-xs tabular-nums text-warning">
        {label}
      </p>
    );
  };
  const overview = context?.summary;
  const chartPoints: StrengthPoint[] = (context?.daily || []).map((day) => ({
    date: day.date,
    value: day.avg_score,
    count: day.total,
  }));
  const headlineValue = scrub ? scrub.value : overview?.avg_score;
  const headline = describeStrength(headlineValue, { t });
  const overallTone = describeStrength(overview?.avg_score, { t }).tone;
  const sentimentOptions = [
    { value: "all", label: t("common.all") },
    { value: "bullish", label: t("youtubeOpinions.bullish") },
    { value: "bearish", label: t("youtubeOpinions.bearish") },
    { value: "neutral", label: t("youtubeOpinions.neutral") },
    { value: "mixed", label: t("youtubeOpinions.mixed") },
  ];
  const rangeOptions: Array<{ value: Range; label: string }> = [
    { value: "1m", label: t("youtubeOpinions.range1m") },
    { value: "3m", label: t("youtubeOpinions.range3m") },
    { value: "6m", label: t("youtubeOpinions.range6m") },
    { value: "1y", label: t("youtubeOpinions.range1y") },
    { value: "all", label: t("common.all") },
  ];
  const notableChanges = changes.filter((change) => change.change != null).slice(0, 8);
  const holdingsWithCoverage = held.tickers.flatMap((ticker) => {
    const stock = catalogue?.stocks.find((item) => item.ticker === ticker);
    return stock ? [stock] : [];
  });

  const pill = (active: boolean) =>
    cn(
      "inline-flex h-8 shrink-0 items-center rounded-full px-3.5 text-[13px] font-semibold transition-colors duration-150 focus-visible:outline-none ",
      active
        ? "bg-foreground text-background"
        : "text-foreground/80 hover:bg-muted hover:text-foreground",
    );
  // Inside the directory card, controls match the Markets card toolbar:
  // muted selected pill, 40px minimum height.
  const directoryPill = (active: boolean) =>
    cn(
      "inline-flex min-h-10 shrink-0 items-center rounded-full px-4 text-sm font-medium transition-colors duration-150 focus-visible:outline-none",
      active
        ? "bg-muted font-semibold text-foreground hover:bg-secondary"
        : "text-muted-foreground hover:bg-muted hover:text-foreground",
    );
  const segment = (active: boolean) =>
    cn(
      "inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none",
      active
        ? "bg-foreground text-background"
        : "text-muted-foreground hover:bg-secondary hover:text-foreground",
    );

  const shownStocks = creatorOverview && !showAllCreatorStocks
    ? visibleStocks.slice(0, 5)
    : !inDetail ? visibleStocks.slice(0, allStocks ? directoryLimit : 10) : visibleStocks;
  const hasMorePreviewStocks = !inDetail && !allStocks && shownStocks.length < visibleStocks.length;
  const stockDirectoryParams = new URLSearchParams();
  if (search) stockDirectoryParams.set("q", search);
  if (sortBy !== "latest") stockDirectoryParams.set("sort", sortBy);
  if (toneFilter !== "all") stockDirectoryParams.set("tone", toneFilter);
  if (stockScope !== "all") stockDirectoryParams.set("scope", stockScope);
  const stockDirectoryQuery = stockDirectoryParams.toString();
  const stockDirectoryHref = `/dashboard/youtube-opinions/stocks${stockDirectoryQuery ? `?${stockDirectoryQuery}` : ""}`;
  const latestCreatorOpinions = creatorOverview ? (context?.latest || []).filter((opinion) => opinion.ticker).slice(0, 5) : [];
  const performanceListed =
    (!inDetail && route.tab === "stocks") ||
    (inDetail && Boolean(route.creator) && !route.ticker);
  // Fetch actual moves for the rows in view first, then extend as the reader
  // scrolls: one yfinance bulk download per batch keeps every request short.
  const performanceListKey = `${route.tab}|${route.ticker || ""}|${route.creator || ""}|${inDetail ? "detail" : "list"}`;
  useEffect(() => {
    setPerformanceLimit(24);
  }, [performanceListKey]);
  const performanceTickers = performanceListed
    ? shownStocks.slice(0, performanceLimit).map((item) => item.ticker)
    : [];
  const { performance, loading: performanceLoading } = useStockPerformance(performanceTickers);
  // Once a batch lands, keep extending while the reader is still at the bottom.
  useEffect(() => {
    if (!performanceListed || performanceLoading) return;
    const element = scrollContainer.current;
    if (!element) return;
    if (
      element.scrollHeight - element.scrollTop - element.clientHeight < 900 &&
      performanceLimit < shownStocks.length
    ) {
      setPerformanceLimit((current) => Math.min(current + 24, shownStocks.length));
    }
  }, [performanceLoading, performanceListed, performanceLimit, shownStocks.length]);
  const loadMorePerformance = () => {
    if (!performanceListed || performanceLoading) return;
    const element = scrollContainer.current;
    if (!element) return;
    if (element.scrollHeight - element.scrollTop - element.clientHeight < 900) {
      setPerformanceLimit((current) =>
        current >= shownStocks.length ? current : Math.min(current + 24, shownStocks.length),
      );
    }
  };

  const performanceCell = (ticker: string, requested: boolean, compact = false) => {
    const entry = performance[ticker];
    if (compact) {
      return <div className="figure min-h-10 text-right sm:col-start-2 sm:row-start-1">
        {entry ? <>
          <p className="text-[14px] font-semibold">{localPrice(ticker, entry.price)}</p>
          <p className={cn("mt-1 text-xs font-semibold", percentTone(entry.change_1d_percent))}>
            <span className="mr-1 font-normal text-muted-foreground">{t("youtubeOpinions.price1d")}</span>{formatPercent(entry.change_1d_percent)}
          </p>
        </> : <span className="text-xs text-muted-foreground" aria-label={t(performanceLoading || !requested ? "common.loadingStatus" : "youtubeOpinions.performanceUnavailable")}>{performanceLoading || !requested ? "…" : "—"}</span>}
      </div>;
    }
    const cellClass =
      "min-w-0";
    if (entry) {
      const ariaLabel = t("youtubeOpinions.performanceAria", {
        price: localPrice(ticker, entry.price),
        day: formatPercent(entry.change_1d_percent),
        week: formatPercent(entry.change_5d_percent),
        month: formatPercent(entry.change_1mo_percent),
      });
      return (
        <div
          className={cn(cellClass, "text-left md:text-right")}
          role="group"
          aria-label={ariaLabel}
          title={t("youtubeOpinions.performanceNote", { date: entry.as_of })}
        >
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 md:flex-col md:items-end md:gap-y-1">
            <p className="whitespace-nowrap tabular-nums">
              <span className="text-[11px] font-medium text-foreground/55">
                {t("youtubeOpinions.directory.currentPrice")}
              </span>
              <span className="ml-1.5 text-[13px] font-semibold text-foreground">
                {localPrice(ticker, entry.price)}
              </span>
            </p>
            <p className="text-[11px] text-muted-foreground">{t("youtubeOpinions.directory.asOf", { date: formatDay(entry.as_of) })}</p>
            <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 md:justify-end">
              {([
                ["youtubeOpinions.price1d", entry.change_1d_percent],
                ["youtubeOpinions.price5d", entry.change_5d_percent],
                ["youtubeOpinions.price1mo", entry.change_1mo_percent],
              ] as const).map(([key, value]) => (
                <span key={key} className="inline-flex items-baseline gap-1 whitespace-nowrap">
                  <span className="text-[11px] text-foreground/55">{t(key)}</span>
                  <span className={cn("text-xs font-semibold tabular-nums", percentTone(value))}>
                    {formatPercent(value)}
                  </span>
                </span>
              ))}
            </p>
          </div>
        </div>
      );
    }
    return (
      <div
        className={cn(cellClass, "flex min-h-4 items-center gap-2 text-left md:justify-end md:text-right")}
        title={performanceLoading ? undefined : t("youtubeOpinions.performanceUnavailable")}
      >
        {performanceLoading || !requested ? (
          <>
            <span aria-hidden="true" className="h-3 w-16 animate-pulse rounded bg-muted motion-reduce:animate-none" />
            <span aria-hidden="true" className="h-3 w-24 animate-pulse rounded bg-muted motion-reduce:animate-none" />
            <span className="sr-only">{t("common.loadingStatus")}</span>
          </>
        ) : (
          <span aria-label={t("youtubeOpinions.performanceUnavailable")} className="text-xs text-foreground/55">—</span>
        )}
      </div>
    );
  };

  const stockRows = (inCard = false, narrow = false) => (
    <div className="min-w-0">
      <ListRows aria-label={t("youtubeOpinions.stocksDiscussedTitle")}>
        {shownStocks.map((item, index) => (
          <StockDirectoryRow key={item.ticker} stock={item} performance={performanceCell(item.ticker, index < performanceLimit)} change={changesByTicker.get(item.ticker)}>
            <ExplorerLink
              onNavigate={navigate}
              target={{
                tab: route.creator ? "creators" : "stocks",
                ticker: item.ticker,
                creator: route.creator,
              }}
              className={inCard ? (narrow ? cardNarrowStockRowClass : cardStockRowClass) : stockRowClass}
              label={`${t("youtubeOpinions.viewStock")}: ${item.ticker}`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <CompanyLogo symbol={item.ticker} size="md" />
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold">
                    {item.ticker}
                    {held.tickers.includes(item.ticker) && <HeldMark />}
                  </p>
                  <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
                    {item.company_name || item.ticker}
                  </p>
                </div>
              </div>
              {performanceCell(item.ticker, index < performanceLimit, true)}
              <div className={cn("col-span-2 flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 text-right", !narrow && "sm:col-span-1 sm:flex-col sm:items-end sm:justify-center")} title={t("youtubeOpinions.directory.historicalConsensus")}>
                <OpinionStrength value={item.avg_score} />
                <p className="text-xs text-muted-foreground tabular-nums">
                  {t("youtubeOpinions.creatorOpinionCount", {
                    creators: String(item.creator_count),
                    opinions: String(item.total_opinions),
                  })}
                </p>
              </div>
            </ExplorerLink>
          </StockDirectoryRow>
        ))}
      </ListRows>
      {hasMorePreviewStocks && (
        <ListFooterLink href={stockDirectoryHref}>
          {c("View all stocks", "查看全部股票")} · {shownStocks.length}/{visibleStocks.length}
        </ListFooterLink>
      )}
      {allStocks && shownStocks.length < visibleStocks.length && (
        <ListLoadMore onClick={() => setDirectoryLimit(value => value + 40)}>
          {c("Load more stocks", "加载更多股票")} · {shownStocks.length}/{visibleStocks.length}
        </ListLoadMore>
      )}
      {!visibleStocks.length && !(directoryActive && stockScope === "holdings" && (held.loading || held.error)) && (
        <EmptyLine
          text={filtering ? t("youtubeOpinions.noStocksMatch") : t("youtubeOpinions.noData")}
          action={filtering ? { label: t("common.clearFilters"), onClick: clearFilters } : undefined}
        />
      )}
    </div>
  );

  const creatorRows = (items: YouTubeCreatorSummary[], inCard = false) => (
    <ListRows aria-label={t("youtubeOpinions.trackedCreators")}>
      {items.map((item) => (
        <ListRow key={item.channel_id}>
          <ExplorerLink
            onNavigate={navigate}
            target={{ tab: "creators", creator: item.channel_id }}
            className={inCard ? cardRowClass : rowClass}
            label={`${t("youtubeOpinions.viewCreator")}: ${item.channel_title || item.channel_id}`}
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
                {inCard && lastUpdated(item.latest_opinion_at)}
                {coverageNote(item.channel_id)}
              </div>
            </div>
            <div className="flex min-w-0 flex-col items-end gap-0.5 text-right">
              <OpinionStrength value={item.avg_score} />
              <p className="text-xs text-muted-foreground tabular-nums">
                {t("youtubeOpinions.opinionCount", { count: String(item.total_opinions) })}
              </p>
              {!inCard && lastUpdated(item.latest_opinion_at)}
            </div>
          </ExplorerLink>
        </ListRow>
      ))}
    </ListRows>
  );

  const loadingBlock = (
    <div role="status" className="flex min-h-20 items-center gap-2 py-6 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      <span>{t("common.loadingStatus")}</span>
    </div>
  );

  const changeList = (primary = false) => (
    <section aria-labelledby="creator-recent-shifts-title" className="min-w-0">
      <header className={cn("mb-3 flex flex-wrap items-center justify-between gap-2", primary && "min-h-14")}>
        <div className="min-w-0">
          <h2
            id="creator-recent-shifts-title"
            className={cn("font-semibold tracking-[-0.01em]", primary ? "text-xl" : "text-base")}
          >
            {t("youtubeOpinions.recentShifts")}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("youtubeOpinions.comparedWithPrevious")}
          </p>
        </div>
      </header>
      <ListCard>
        {catalogueError ? (
          <EmptyLine text={t("youtubeOpinions.directoryLoadFailed")} action={{ label: t("common.retry"), onClick: refresh }} alert />
        ) : !catalogue ? loadingBlock : !notableChanges.length ? (
          <EmptyLine text={c("No opinion changes yet", "暂无观点变化")} />
        ) : (
          <ListRows aria-label={t("youtubeOpinions.recentShifts")}>
            {notableChanges.map((change) => (
              <ListRow key={change.ticker}>
                <ExplorerLink
                  onNavigate={navigate}
                  target={{
                    tab: route.creator ? "creators" : "stocks",
                    ticker: change.ticker,
                    creator: route.creator,
                  }}
                  className={cn(listCompactRowClass, "flex-1")}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span aria-hidden="true"><CompanyLogo symbol={change.ticker} size="sm" /></span>
                    <span className="min-w-0">
                      <span className="block font-semibold">{change.ticker}</span>
                      <span className="block text-xs text-muted-foreground tabular-nums">
                        {formatDay(change.current_date)}
                      </span>
                    </span>
                  </span>
                  <OpinionChange value={change} />
                </ExplorerLink>
              </ListRow>
            ))}
          </ListRows>
        )}
      </ListCard>
    </section>
  );

  const tabSwitcher = (
    <nav
      aria-label={t("youtubeOpinions.browseBy")}
      className="inline-flex w-fit max-w-full items-center gap-1 rounded-full bg-muted/50 p-1 align-middle"
    >
      {([
        { tab: "stocks", label: t("youtubeOpinions.byStock") },
        { tab: "creators", label: t("youtubeOpinions.byCreator") },
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
            className={segment(active)}
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );

  const groupByVideo = Boolean(route.creator && !route.ticker);
  const videoView = groupByVideo && historyView === "videos";
  const creatorCoverage = route.creator ? coverage[route.creator] : undefined;
  const historyVideos = videoHistory(
    opinions,
    creatorCoverage?.status === "available" && filters.sentiment === "all"
      ? creatorCoverage.untracked
      : [],
    filters.from,
    filters.to,
  );
  const stockOpinions = opinions.filter((opinion) => opinion.ticker);
  const untrackedVideoCount = historyVideos.filter((group) => !group.analyzed && !group.opinions.length).length;
  const visibleVideos = historyVideos.filter((group) => showUntrackedVideos || group.analyzed || group.opinions.length > 0);
  const historySwitcher = groupByVideo && (
    <div
      role="radiogroup"
      aria-label={t("youtubeOpinions.historyView")}
      className="inline-flex w-fit max-w-full items-center gap-1 rounded-full bg-muted/50 p-1 align-middle"
    >
      {([
        { value: "videos", label: t("youtubeOpinions.byVideo") },
        { value: "opinions", label: t("youtubeOpinions.byOpinion") },
      ] as const).map((item) => (
        <button
          key={item.value}
          type="button"
          role="radio"
          aria-checked={historyView === item.value}
          onClick={() => setHistoryView(item.value)}
          className={segment(historyView === item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
  const focused = Boolean(route.creator && route.ticker);
  const rangeControls = (compact: boolean, inline = false) => {
    const rangePill = (active: boolean) =>
      compact ? cn(pill(active), "h-7 px-2.5 text-xs") : pill(active);
    return (
      <div
        role="radiogroup"
        aria-label={t("common.timeRange")}
        className={cn(
          "flex items-center gap-1",
          compact
            ? "flex-wrap"
            : inline
              ? "min-w-0 max-w-full overflow-x-auto rounded-full bg-muted/50 p-1 scrollbar-hide"
              : "mt-3 overflow-x-auto border-b border-border pb-4 scrollbar-hide",
        )}
      >
        {rangeOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={filters.range === option.value}
            className={rangePill(filters.range === option.value)}
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
        <OpinionDateRangePicker
          from={filters.from}
          to={filters.to}
          active={filters.range === "custom"}
          compact={compact}
          triggerClassName={rangePill(filters.range === "custom")}
          onApply={({ from, to }) =>
            setFilters((previous) => ({ ...previous, range: "custom", from, to }))
          }
          onReset={() =>
            setFilters((previous) => ({ ...previous, range: "all", from: "", to: "" }))
          }
        />
      </div>
    );
  };
  const onStock = (ticker: string) =>
    navigate({
      tab: route.creator ? "creators" : "stocks",
      creator: route.creator,
      ticker,
    });

  return (
    <DashboardLayout
      title={t("youtubeOpinions.title")}
      headerLeftAction={allStocks ? <HeaderBackButton href="/dashboard/youtube-opinions" label={t("common.back")} /> : inDetail ? <HeaderBackButton label={t("common.back")} onClick={() => navigate(back)} /> : undefined}
    >
      <div
        ref={scrollContainer}
        className="relative min-h-0 min-w-0 flex-1 overflow-y-auto"
        aria-busy={navigating}
        onScroll={loadMorePerformance}
      >
        {navigating && (
          <div role="status" className="sticky top-0 z-20 flex h-0 justify-end overflow-visible px-4 md:px-8">
            <span className="mt-2 inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
              <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              {t("common.loadingStatus")}
            </span>
          </div>
        )}
        <div className="mx-auto w-full min-w-0 max-w-[1600px] px-4 pb-16 pt-5 md:px-8 md:pt-7">
          {!inDetail && !allStocks && (
            <div className="mb-5 min-w-0 sm:mb-6">{tabSwitcher}</div>
          )}
          <Tabs
            value={route.tab}
            onValueChange={(value) => navigate({ tab: value as Route["tab"] })}
          >

            {!inDetail && (
              <div className={cn("grid min-w-0 gap-8", allStocks ? "mx-auto" : "xl:grid-cols-[minmax(0,1fr)_20rem] 2xl:gap-x-12")}>
                <div className="min-w-0 space-y-8">
                  <div>
                    <header className="mb-3 flex min-h-14 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <h2
                          id="creator-directory-heading"
                          className="text-[28px] font-semibold leading-tight tracking-[-0.02em]"
                        >
                          {route.tab === "stocks"
                            ? t("youtubeOpinions.stocksDiscussedTitle")
                            : t("youtubeOpinions.trackedCreators")}
                        </h2>
                        {catalogue && !(route.tab === "stocks" && stockScope === "holdings" && (held.loading || held.error)) && (
                          <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                            {t("youtubeOpinions.catalogueSummary", {
                              stocks: String(catalogue.summary.total_stocks),
                              creators: String(catalogue.summary.total_creators),
                              opinions: String(catalogue.summary.total_opinions),
                            })}
                          </p>
                        )}
                      </div>
                    </header>
                    <section aria-labelledby="creator-directory-heading" className="min-w-0">
                      <ListCard>
                        <ListToolbar>
                          <div
                            role="radiogroup"
                            aria-label={t("youtubeOpinions.filterBySentiment")}
                            className="flex flex-wrap items-center gap-1"
                          >
                            {toneOptions.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                role="radio"
                                aria-checked={toneFilter === option.value}
                                onClick={() => setToneFilter(option.value)}
                                className={directoryPill(toneFilter === option.value)}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </ListToolbar>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <div className="relative min-w-0 flex-1">
                            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              ref={searchInput}
                              aria-label={t("common.search")}
                              placeholder={
                                route.tab === "stocks"
                                  ? t("youtubeOpinions.searchTicker")
                                  : t("youtubeOpinions.searchCreator")
                              }
                              value={search}
                              onChange={(event) => setSearch(event.target.value)}
                              className="h-11 rounded-full pl-10 pr-10 text-base sm:text-sm"
                            />
                            {search && <button type="button" aria-label={t("common.clearFilters")} className="absolute right-1 top-1.5 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-none" onClick={() => { setSearch(""); searchInput.current?.focus(); }}><X className="h-4 w-4" aria-hidden="true" /></button>}
                          </div>
                          {route.tab === "stocks" && isProductFeatureEnabled("portfolio") && (
                            <div className="flex flex-wrap items-center gap-1">
                              <div className="flex flex-wrap gap-1" role="group" aria-label={t("youtubeOpinions.directory.allStocks")}>
                                {([["all", "allStocks"], ["holdings", "holdingsOnly"]] as const).map(([value, label]) => (
                                  <button key={value} type="button" aria-pressed={stockScope === value} className={directoryPill(stockScope === value)} onClick={() => setStockScope(value)}>
                                    {t(`youtubeOpinions.directory.${label}`)}
                                  </button>
                                ))}
                              </div>
                              {stockScope === "holdings" && held.loading && <p role="status" className="text-xs text-muted-foreground">{t("common.loadingStatus")}</p>}
                              {stockScope === "holdings" && held.error && <div role="alert" className="flex items-center gap-2 text-xs text-negative">{c("Holdings could not be loaded.", "暂时无法加载持仓。")}<Button size="xs" variant="outline" onClick={refresh}>{t("common.retry")}</Button></div>}
                            </div>
                          )}
                          <div className="ml-auto flex shrink-0 justify-end">
                            <Select value={sortBy} onValueChange={(value) => setSortBy(value as DirectorySort)}>
                              <SelectTrigger
                                aria-label={t("common.sort")}
                                className="h-11 w-auto gap-1.5 rounded-full border-border bg-transparent px-3 text-[13px] font-semibold hover:bg-muted"
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
                        {catalogue && (
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs leading-5 text-muted-foreground">
                            <p role="status" aria-live="polite" className="shrink-0 tabular-nums">
                              {route.tab === "stocks"
                                ? c(`Showing ${shownStocks.length} of ${visibleStocks.length} stocks`, `已显示 ${shownStocks.length} / ${visibleStocks.length} 只股票`)
                                : c(`Showing ${visibleCreators.length} of ${creators.length} creators`, `已显示 ${visibleCreators.length} / ${creators.length} 位博主`)}
                            </p>
                            <p className="min-w-0 truncate">
                              {route.tab === "stocks"
                                ? c("Ranked within this list", "名单内排序")
                                : c("All tracked creators", "全部追踪博主")}
                            </p>
                          </div>
                        )}
                        {catalogueError ? (
                          <EmptyLine
                            text={t("youtubeOpinions.directoryLoadFailed")}
                            action={{ label: t("common.retry"), onClick: refresh }}
                            alert
                          />
                        ) : !catalogue ? (
                          loadingBlock
                        ) : (
                          <>
                            <TabsContent value="stocks" className="mt-0">
                              <ListColumnHeader>
                                <div className={stockColumnHeaderClass}>
                                  <span>{t("youtubeOpinions.ticker")}</span>
                                  <span className="text-right">{t("youtubeOpinions.directory.currentPrice")}</span>
                                  <span className="hidden text-right sm:block">{t("youtubeOpinions.directory.historicalConsensus")}</span>
                                </div>
                              </ListColumnHeader>
                              {stockRows(true)}
                            </TabsContent>
                            <TabsContent value="creators" className="mt-0">
                              <ListColumnHeader>
                                <div className={creatorColumnHeaderClass}>
                                  <span>{t("youtubeOpinions.creator")}</span>
                                  <span className="text-right">{t("youtubeOpinions.opinions")}</span>
                                </div>
                              </ListColumnHeader>
                              {creatorRows(visibleCreators, true)}
                              {!visibleCreators.length && (
                                <EmptyLine
                                  text={filtering ? t("youtubeOpinions.noCreatorsMatch") : t("youtubeOpinions.noData")}
                                  action={filtering ? { label: t("common.clearFilters"), onClick: clearFilters } : undefined}
                                />
                              )}
                            </TabsContent>
                          </>
                        )}
                      </ListCard>
                    </section>
                  </div>
                  {!allStocks && changeList(true)}
                </div>
                {!allStocks && <aside className="min-w-0 space-y-8">
                  <section aria-labelledby="creator-latest-opinions-title" className="min-w-0">
                    <header className="mb-3 flex min-h-14 items-start gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h2 id="creator-latest-opinions-title" className="text-lg font-semibold">{c("Latest creator videos", "博主最新视频")}</h2>
                          {catalogue?.latest_videos?.length ? (
                            <span
                              className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground"
                              aria-label={c(`Showing ${catalogue.latest_videos.length} latest videos`, `展示 ${catalogue.latest_videos.length} 位博主的最新视频`)}
                            >
                              {catalogue.latest_videos.length}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{c("Each creator’s latest video, with stock opinions grouped together", "每位博主仅展示最新一期，合并同视频内的股票观点")}</p>
                      </div>
                    </header>
                    <ListCard>
                      {catalogueError ? <EmptyLine text={t("youtubeOpinions.directoryLoadFailed")} action={{ label: t("common.retry"), onClick: refresh }} alert /> : !catalogue ? loadingBlock : catalogue.latest_videos?.length ? (
                        <ListRows aria-label={c("Latest creator videos", "博主最新视频")}>
                          {catalogue.latest_videos.map((group) => (
                            <li key={group.videoId} className={cn(listFeedRowClass, "py-4 first:pt-1")}>
                              <VideoOpinionCard group={group} t={t} showCreator compact onStock={(ticker) => navigate({ tab: "stocks", ticker })} />
                            </li>
                          ))}
                        </ListRows>
                      ) : <EmptyLine text={t("youtubeOpinions.noOpinionsYet")} />}
                      <ListFooterLink href="/dashboard/youtube-opinions/opinions">
                        {c("View all opinions", "查看全部观点")}
                      </ListFooterLink>
                    </ListCard>
                  </section>
                  {isProductFeatureEnabled("portfolio") && <section aria-labelledby="creator-holdings-title" className="min-w-0">
                    <header className="mb-3 flex min-h-14 items-center gap-2">
                      <h2 id="creator-holdings-title" className="text-lg font-semibold">{c("My holdings", "我的持仓")}</h2>
                      {held.tickers.length > 0 && (
                        <span
                          className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground"
                          aria-label={c(`Covering ${holdingsWithCoverage.length} of ${held.tickers.length} holdings`, `已覆盖 ${holdingsWithCoverage.length} / ${held.tickers.length} 只持仓`)}
                        >
                          {holdingsWithCoverage.length}/{held.tickers.length}
                        </span>
                      )}
                    </header>
                    <ListCard>
                      {held.loading ? loadingBlock : held.error ? (
                        <EmptyLine text={t("research.holdingsUnavailable")} />
                      ) : !held.tickers.length ? (
                        <p className="px-1 py-2 text-sm leading-6 text-muted-foreground">
                          {t("research.noHoldings")}{" "}
                          <Link href="/dashboard/portfolio" className="font-medium text-foreground underline-offset-4 hover:underline">
                            {t("research.viewPortfolio")}
                          </Link>
                        </p>
                      ) : (
                        <>
                          <ListRows aria-label={c("My holdings", "我的持仓")}>
                            {holdingsWithCoverage.map((stock) => (
                              <ListRow key={stock.ticker}>
                                <Link
                                  href={`/dashboard/market/${encodeURIComponent(stock.ticker)}`}
                                  className={cn(listCompactRowClass, "flex-1")}
                                >
                                  <span className="font-semibold">{stock.ticker}</span>
                                  <OpinionStrength value={stock.avg_score} />
                                </Link>
                              </ListRow>
                            ))}
                          </ListRows>
                          {held.tickers.length > holdingsWithCoverage.length && (
                            <p className="mt-1 px-1 text-xs leading-5 text-muted-foreground">
                              {t("research.uncoveredHoldings", { count: String(held.tickers.length - holdingsWithCoverage.length) })}
                            </p>
                          )}
                          <ListFooterLink href="/dashboard/portfolio">
                            {c("View all holdings", "查看全部持仓")}
                          </ListFooterLink>
                        </>
                      )}
                    </ListCard>
                  </section>}
                </aside>}
              </div>
            )}

            {inDetail && (
              <TabsContent value={route.tab} className="mt-0 min-w-0">
                <div
                  className={cn(
                    "grid min-w-0 gap-x-12",
                    !creatorOverview && "xl:grid-cols-[minmax(0,1fr)_20rem] xl:grid-rows-[auto_1fr]",
                    focused ? "gap-y-8" : "gap-y-10",
                  )}
                >
                  <div className="min-w-0 xl:col-start-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-4">
                      {route.creator && !route.ticker && creator && <Avatar creator={creator} size="lg" />}
                      {route.ticker && (
                        <span className="relative shrink-0">
                          <CompanyLogo
                            symbol={route.ticker}
                            name={stock?.company_name || context?.stocks[0]?.company_name || route.ticker}
                            size="lg"
                          />
                          {route.creator && creator && (
                            <span className="absolute -bottom-1.5 -right-1.5 rounded-full ">
                              <Avatar creator={creator} size="sm" />
                            </span>
                          )}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <h2 className="break-words text-[32px] font-semibold leading-tight tracking-[-0.025em]">
                          {route.ticker || title}
                        </h2>
                        <p className="mt-0.5 break-words text-sm text-foreground/80">
                          {route.creator
                            ? route.ticker
                              ? t("youtubeOpinions.opinionsFrom", { name: title || "" })
                              : creator?.channel_handle
                            : stock?.company_name || context?.stocks[0]?.company_name}
                        </p>
                        {route.creator && coverageNote(route.creator)}
                      </div>
                      {(route.ticker || creator) && (
                        <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto">
                          {route.ticker && (
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/dashboard/market/${encodeURIComponent(route.ticker)}`}>
                                <LineChart className="h-4 w-4" aria-hidden="true" />
                                {c("View market data", "查看行情")}
                              </Link>
                            </Button>
                          )}
                          {creator && (
                            <>
                              <CreatorShare key={creator.channel_id} creator={creator} />
                              <CreatorProfileDialog creator={creator} compact />
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {contextError ? (
                      <EmptyLine
                        text={t("youtubeOpinions.overviewLoadFailed")}
                        action={{ label: t("common.retry"), onClick: refresh }}
                        alert
                      />
                    ) : !context ? (
                      loadingBlock
                    ) : focused ? (
                      <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1" aria-live="polite">
                        <p className={cn("text-xl font-semibold tracking-[-0.01em]", toneText[headline.tone])}>
                          {overview?.total_opinions ? headline.label : t("youtubeOpinions.noOpinionsYet")}
                        </p>
                        <p className="text-sm text-foreground/75 tabular-nums">
                          {scrub
                            ? t("youtubeOpinions.scrubSummary", {
                                date: formatDay(scrub.date),
                                count: String(scrub.count),
                              })
                            : overview?.latest_opinion_at
                              ? t("youtubeOpinions.creatorStockSummary", {
                                  opinions: String(overview.total_opinions),
                                  date: formatDay(overview.latest_opinion_at),
                                })
                              : ""}
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="mt-6" aria-live="polite">
                          <p className={cn("text-[28px] font-semibold leading-tight tracking-[-0.02em] sm:text-[32px]", toneText[headline.tone])}>
                            {overview?.total_opinions ? headline.label : t("youtubeOpinions.noOpinionsYet")}
                          </p>
                          <p className="mt-1 text-sm text-foreground/75 tabular-nums">
                            {scrub
                              ? t("youtubeOpinions.scrubSummary", {
                                  date: formatDay(scrub.date),
                                  count: String(scrub.count),
                                })
                              : overview
                                ? overview.latest_opinion_at
                                  ? t("youtubeOpinions.overviewSummaryLatest", {
                                      opinions: String(overview.total_opinions),
                                      creators: String(overview.total_creators),
                                      date: formatDay(overview.latest_opinion_at),
                                    })
                                  : t("youtubeOpinions.overviewSummary", {
                                      opinions: String(overview.total_opinions),
                                      creators: String(overview.total_creators),
                                    })
                                : ""}
                          </p>
                        </div>

                        <section aria-label={t("youtubeOpinions.chartView")} className="min-w-0">
                          <div className="mt-6 flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-3">
                            {route.ticker && (
                              <div
                                role="tablist"
                                aria-label={t("youtubeOpinions.chartView")}
                                className="inline-flex w-fit max-w-full items-center gap-1 rounded-full bg-muted/50 p-1"
                              >
                                {([
                                  { value: "price", label: t("youtubeOpinions.priceTrend") },
                                  { value: "opinions", label: t("youtubeOpinions.strengthTrend") },
                                ] as const).map((item) => (
                                  <button
                                    key={item.value}
                                    type="button"
                                    role="tab"
                                    aria-selected={chartView === item.value}
                                    onClick={() => {
                                      setChartView(item.value);
                                      setScrub(null);
                                    }}
                                    className={segment(chartView === item.value)}
                                  >
                                    {item.label}
                                  </button>
                                ))}
                              </div>
                            )}
                            {rangeControls(false, true)}
                          </div>

                          <div className="mt-3 space-y-6">
                            {route.ticker && chartView === "price" ? (
                              <Card className="min-w-0 p-3 sm:p-4">
                                <PriceChart
                                  symbol={route.ticker}
                                  range={filters.range}
                                  from={filters.from}
                                  to={filters.to}
                                  opinions={chartPoints}
                                  formatDate={formatDay}
                                  t={t}
                                  resultsContainer={chartResults}
                                />
                              </Card>
                            ) : chartPoints.length > 0 ? (
                              <Card className="min-w-0 p-4 sm:p-5">
                                <StrengthChart
                                  points={chartPoints}
                                  tone={overallTone}
                                  label={t("youtubeOpinions.chartLabel")}
                                  formatDate={formatDay}
                                  onScrub={setScrub}
                                />
                              </Card>
                            ) : null}

                            {route.ticker && chartView === "price" && (
                              <Card className="min-w-0 p-3 sm:p-4">
                                <div
                                  ref={setChartResults}
                                  className="flex min-w-0 flex-col [&>*:first-child]:mt-0 [&>*:first-child]:border-t-0 [&>*:first-child]:pt-0"
                                />
                              </Card>
                            )}

                            {overview && overview.total_opinions > 0 && (
                              <Card className="min-w-0 p-4 sm:p-5">
                                <OpinionDistribution summary={overview} className="pt-0" />
                              </Card>
                            )}
                          </div>
                        </section>
                      </>
                    )}
                  </div>

                  {creatorOverview && (
                    <section className="min-w-0" aria-labelledby="creator-detail-latest-title">
                      <header className="mb-3 flex min-h-14 flex-wrap items-center justify-between gap-3">
                        <h2 id="creator-detail-latest-title" className="text-lg font-semibold">{c("Latest opinions", "最新观点")}</h2>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setFilters(emptyFilters);
                            setHistoryView("opinions");
                            opinionHistory.current?.focus({ preventScroll: true });
                            opinionHistory.current?.scrollIntoView({ block: "start" });
                          }}
                        >
                          {c("View all opinions", "查看所有观点")}
                        </Button>
                      </header>
                      <ListCard>
                        {contextError ? (
                          <EmptyLine text={t("youtubeOpinions.opinionsLoadFailed")} action={{ label: t("common.retry"), onClick: refresh }} alert />
                        ) : !context ? loadingBlock : latestCreatorOpinions.length ? (
                          <ListRows aria-label={c("Latest opinions", "最新观点")}>
                            {latestCreatorOpinions.map((opinion) => (
                              <li key={opinion.id} className={listFeedRowClass}>
                                <OpinionCard opinion={opinion} t={t} showCreator={false} onStock={onStock} />
                              </li>
                            ))}
                          </ListRows>
                        ) : <EmptyLine text={t("youtubeOpinions.noOpinionsYet")} />}
                      </ListCard>
                    </section>
                  )}

                  <section ref={opinionHistory} tabIndex={-1} aria-labelledby="opinion-history-title" className="min-w-0 scroll-mt-6 rounded-sm focus-visible:outline-none xl:col-start-1">
                    <header className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
                        <h2 id="opinion-history-title" className="text-lg font-semibold">
                          {t("youtubeOpinions.opinionHistory")}
                          {detail && (
                            <span className="ml-2 text-sm font-normal text-foreground/75 tabular-nums">
                              {detail.summary.total_opinions}
                            </span>
                          )}
                        </h2>
                        {historySwitcher}
                      </div>
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
                    </header>
                    <ListCard>
                      {loading ? loadingBlock : (
                        <>
                          {detailError && (
                            <EmptyLine
                              text={t("youtubeOpinions.opinionsLoadFailed")}
                              action={{ label: t("common.retry"), onClick: detail ? loadMore : refresh }}
                              alert
                            />
                          )}
                          {videoView && untrackedVideoCount > 0 && (
                            <button
                              type="button"
                              aria-pressed={showUntrackedVideos}
                              onClick={() => setShowUntrackedVideos((value) => !value)}
                              className="mt-2 inline-flex min-h-10 items-center rounded-full px-3 text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none"
                            >
                              {t(showUntrackedVideos ? "youtubeOpinions.hideUntrackedVideos" : "youtubeOpinions.showUntrackedVideos", { count: String(untrackedVideoCount) })}
                            </button>
                          )}
                          {!detailError && !(videoView ? visibleVideos.length : stockOpinions.length) && (
                            <EmptyLine
                              text={
                                filters.sentiment !== "all" || filters.range !== "all"
                                  ? t("youtubeOpinions.noOpinionsMatch")
                                  : t("youtubeOpinions.noData")
                              }
                              action={
                                filters.sentiment !== "all" || filters.range !== "all"
                                  ? { label: t("common.clearFilters"), onClick: () => setFilters(emptyFilters) }
                                  : undefined
                              }
                            />
                          )}
                          <ListRows aria-label={t("youtubeOpinions.opinionHistory")}>
                            {videoView
                              ? visibleVideos.map((group) => (
                                  <li key={group.videoId} className={listFeedRowClass}>
                                    <VideoOpinionCard
                                      group={group}
                                      t={t}
                                      onStock={onStock}
                                    />
                                  </li>
                                ))
                              : stockOpinions.map((opinion) => (
                                  <li key={opinion.id} className={listFeedRowClass}>
                                    <OpinionCard
                                      opinion={opinion}
                                      t={t}
                                      showCreator={!route.creator}
                                      showTicker={!route.ticker}
                                      onCreator={(channelId) => navigate({ tab: "creators", creator: channelId })}
                                      onStock={onStock}
                                    />
                                  </li>
                                ))}
                          </ListRows>
                          {hasMore && (
                            <ListLoadMore onClick={loadMore} disabled={moreLoading}>
                              {moreLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                              {t("youtubeOpinions.loadMoreOpinions")}
                            </ListLoadMore>
                          )}
                        </>
                      )}
                    </ListCard>
                    {route.ticker && route.creator && (
                      <OtherCreatorOpinions
                        key={`${route.ticker}:${route.creator}`}
                        ticker={route.ticker}
                        currentCreator={route.creator}
                        onCreator={(channelId) => navigate({ tab: "creators", creator: channelId, ticker: route.ticker })}
                      />
                    )}
                  </section>
                  <aside
                    className={cn(
                      "min-w-0 space-y-10",
                      !creatorOverview && "xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:sticky xl:top-6 xl:self-start",
                      focused && "order-last space-y-8 border-t border-border pt-8 xl:order-none xl:border-0 xl:pt-1",
                    )}
                  >
                    {focused && context && (
                      <>
                        <section className="min-w-0">
                          <h2 className="text-sm font-semibold">{t("youtubeOpinions.strengthTrend")}</h2>
                          {chartPoints.length > 1 ? (
                            <div className="mt-3">
                              <StrengthChart
                                compact
                                points={chartPoints}
                                tone={overallTone}
                                label={t("youtubeOpinions.chartLabel")}
                                formatDate={formatDay}
                                onScrub={setScrub}
                              />
                            </div>
                          ) : (
                            <p className="mt-2 text-[13px] leading-5 text-foreground/75">
                              {t("youtubeOpinions.trendNeedsMore")}
                            </p>
                          )}
                          <div className="mt-3">{rangeControls(true)}</div>
                        </section>
                        {overview && overview.total_opinions > 0 && (
                          <OpinionDistribution summary={overview} compact />
                        )}
                      </>
                    )}
                    {route.creator && !route.ticker && (
                      <section className="min-w-0">
                        <h2 className="mb-3 text-base font-semibold">
                          {c("Most discussed stocks", "讨论最多的股票")}
                        </h2>
                        <ListCard>
                          {showAllCreatorStocks && (
                            <div className="relative mb-3">
                              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <Input
                                aria-label={t("youtubeOpinions.searchStocks")}
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder={t("youtubeOpinions.searchTicker")}
                                className="h-10 rounded-full pl-10 text-base sm:text-sm"
                              />
                            </div>
                          )}
                          <div id="creator-discussed-stocks">{context ? stockRows(true, true) : loadingBlock}</div>
                          {(context?.stocks.length || 0) > 5 && (
                            <ListLoadMore
                              aria-expanded={showAllCreatorStocks}
                              aria-controls="creator-discussed-stocks"
                              onClick={() => {
                                setShowAllCreatorStocks((previous) => !previous);
                                setSearch("");
                              }}
                            >
                              {showAllCreatorStocks
                                ? c("Show top 5", "收起，仅显示前 5 只")
                                : c("View all stocks", "查看全部股票")}
                            </ListLoadMore>
                          )}
                        </ListCard>
                      </section>
                    )}
                    {!route.creator && (
                      <section className="min-w-0">
                        <h2 className="mb-3 text-lg font-semibold">
                          {t("youtubeOpinions.creatorsDiscussing")}
                        </h2>
                        <ListCard>
                          {context ? creatorRows(context.creators, true) : loadingBlock}
                        </ListCard>
                      </section>
                    )}
                    {route.creator && !route.ticker && changeList()}
                  </aside>
                </div>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>

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
