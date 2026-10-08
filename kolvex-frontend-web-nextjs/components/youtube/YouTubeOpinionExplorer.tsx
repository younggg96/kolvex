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
import { useTranslation } from "@/lib/i18n";
import { cn, proxyImageUrl } from "@/lib/utils";
import {
  getYouTubeOpinionDashboard,
  type YouTubeCreatorSummary,
  type YouTubeOpinionDashboard,
  type YouTubeOpinion,
} from "@/lib/youtubeOpinionsApi";
import CreatorProfileDialog from "./CreatorProfileDialog";
import OpinionDateRangePicker from "./OpinionDateRangePicker";
import OpinionCard from "./OpinionCard";
import OpinionDistribution from "./OpinionDistribution";
import OpinionStrength from "./OpinionStrength";
import PriceChart from "./PriceChart";
import StrengthChart, { type StrengthPoint } from "./StrengthChart";
import VideoOpinionCard, { groupOpinionsByVideo } from "./VideoOpinionCard";
import { describeStrength, toneText, type StrengthTone } from "./strength";

type DirectoryTone = "all" | StrengthTone;
type HistoryView = "videos" | "opinions";
type ChartView = "price" | "opinions";
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
  const { t } = useTranslation();
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
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [scrub, setScrub] = useState<StrengthPoint | null>(null);
  const [historyView, setHistoryView] = useState<HistoryView>("videos");
  const [chartView, setChartView] = useState<ChartView>("price");
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
    ? creator?.channel_title || route.creator
    : route.ticker;
  const query = search.trim().toLocaleLowerCase();
  const stocks = (route.creator ? context?.stocks : catalogue?.stocks) || [];
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
    { value: "all", label: t("common.all") },
    { value: "positive", label: t("youtubeOpinions.bullish") },
    { value: "negative", label: t("youtubeOpinions.bearish") },
    { value: "neutral", label: t("youtubeOpinions.neutral") },
  ];
  const sortOptions: Array<{ value: DirectorySort; label: string }> = [
    { value: "opinions", label: t("youtubeOpinions.mostOpinions") },
    ...(route.tab === "stocks"
      ? [{ value: "creators" as const, label: t("youtubeOpinions.mostCreators") }]
      : []),
    { value: "latest", label: t("youtubeOpinions.mostRecent") },
    { value: "bullish", label: t("youtubeOpinions.mostBullish") },
    { value: "bearish", label: t("youtubeOpinions.mostBearish") },
    { value: "name", label: route.tab === "stocks" ? t("youtubeOpinions.tickerAZ") : t("youtubeOpinions.nameAZ") },
  ];
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
  const dateFormatter = new Intl.DateTimeFormat(t("common.intlLocale"), {
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
  const changes = (route.creator ? context?.changes : catalogue?.changes) || [];
  const notableChanges = changes.filter((change) => change.change !== null).slice(0, 8);

  const pill = (active: boolean) =>
    cn(
      "inline-flex h-8 shrink-0 items-center rounded-full px-3.5 text-[13px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
      active
        ? "bg-foreground text-background"
        : "text-foreground/80 hover:bg-muted hover:text-foreground",
    );
  const segment = (active: boolean) =>
    cn(
      "h-8 shrink-0 whitespace-nowrap rounded-full px-3.5 text-[13px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
      active
        ? "bg-background text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.12)]"
        : "text-foreground/80 hover:text-foreground",
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
          label={`${t("youtubeOpinions.viewStock")}: ${item.ticker}`}
        >
          <div className="flex min-w-0 items-center gap-3">
            <CompanyLogo symbol={item.ticker} size="md" />
            <div className="min-w-0">
              <p className="text-[15px] font-semibold">{item.ticker}</p>
              <p className="mt-0.5 truncate text-[13px] text-foreground/80">
                {item.company_name || item.ticker}
              </p>
            </div>
          </div>
          <div className="flex min-w-0 flex-col items-end gap-0.5 text-right">
            <OpinionStrength value={item.avg_score} />
            <p className="text-xs text-foreground/75 tabular-nums">
              {t("youtubeOpinions.creatorOpinionCount", {
                creators: String(item.creator_count),
                opinions: String(item.total_opinions),
              })}
            </p>
          </div>
        </ExplorerLink>
      ))}
      {!visibleStocks.length && (
        <EmptyLine
          text={filtering ? t("youtubeOpinions.noStocksMatch") : t("youtubeOpinions.noData")}
          action={filtering ? { label: t("common.clearFilters"), onClick: clearFilters } : undefined}
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
          label={`${t("youtubeOpinions.viewCreator")}: ${item.channel_title || item.channel_id}`}
        >
          <div className="flex min-w-0 items-center gap-3">
            <Avatar creator={item} />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold">
                {item.channel_title || item.channel_id}
              </p>
              <p className="mt-0.5 truncate text-[13px] text-foreground/80">
                {item.channel_handle || item.channel_id}
              </p>
            </div>
          </div>
          <div className="flex min-w-0 flex-col items-end gap-0.5 text-right">
            <OpinionStrength value={item.avg_score} />
            <p className="text-xs text-foreground/75 tabular-nums">
              {t("youtubeOpinions.opinionCount", { count: String(item.total_opinions) })}
            </p>
          </div>
        </ExplorerLink>
      ))}
    </div>
  );

  const changeList = notableChanges.length > 0 && (
    <section className="min-w-0">
      <h2 className="text-base font-semibold">
        {t("youtubeOpinions.recentShifts")}
      </h2>
      <p className="mt-1 text-xs text-foreground/75">
        {t("youtubeOpinions.comparedWithPrevious")}
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
                <span className="block text-xs text-foreground/75 tabular-nums">
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
    <div role="status" className="space-y-3 py-6" aria-label={t("common.loadingStatus")}>
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
      aria-label={t("youtubeOpinions.browseBy")}
      className="inline-flex w-fit max-w-full items-center gap-0.5 rounded-full bg-muted p-1 align-middle"
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
  const historySwitcher = groupByVideo && (
    <div
      role="radiogroup"
      aria-label={t("youtubeOpinions.historyView")}
      className="inline-flex w-fit max-w-full items-center gap-0.5 rounded-full bg-muted p-1 align-middle"
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
  const rangeControls = (compact: boolean) => {
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

  const breadcrumbNav = (
    <nav
      aria-label={t("common.breadcrumb")}
      className="flex min-w-0 items-center gap-1 text-sm text-foreground/75"
    >
      <Button
        size="icon"
        variant="ghost"
        title={t("common.back")}
        aria-label={t("common.back")}
        className="-ml-2 h-9 w-9 shrink-0"
        onClick={() => navigate(back)}
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <ExplorerLink onNavigate={navigate} target={root} className="shrink-0 rounded-sm whitespace-nowrap hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        {route.tab === "stocks" ? t("youtubeOpinions.allStocks") : t("youtubeOpinions.allCreators")}
      </ExplorerLink>
      {route.creator && route.ticker && (
        <>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          <ExplorerLink
            onNavigate={navigate}
            target={{ tab: "creators", creator: route.creator }}
            className="min-w-0 truncate rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
      headerActions={
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
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
              className="h-8 w-8 gap-1.5 p-0 sm:w-auto sm:px-3"
              title={t("youtubeOpinions.uploadJson")}
              aria-label={t("youtubeOpinions.uploadJson")}
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
        <div className="mx-auto w-full min-w-0 px-4 pb-16 pt-5 md:px-8 md:pt-7">
          <div className="mb-5 min-w-0 sm:mb-6">
            {inDetail ? breadcrumbNav : tabSwitcher}
          </div>
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
                          ? t("youtubeOpinions.stocksDiscussedTitle")
                          : t("youtubeOpinions.trackedCreators")}
                      </h2>
                      {catalogue && (
                        <p className="mt-1 text-sm text-foreground/80 tabular-nums">
                          {t("youtubeOpinions.catalogueSummary", {
                            stocks: String(catalogue.summary.total_stocks),
                            creators: String(catalogue.summary.total_creators),
                            opinions: String(catalogue.summary.total_opinions),
                          })}
                        </p>
                      )}
                    </div>
                    <div className="relative w-full sm:max-w-xs">
                      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        aria-label={t("common.search")}
                        placeholder={
                          route.tab === "stocks"
                            ? t("youtubeOpinions.searchTicker")
                            : t("youtubeOpinions.searchCreator")
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
                      aria-label={t("youtubeOpinions.filterBySentiment")}
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
                        <span className="shrink-0 whitespace-nowrap text-[13px] text-foreground/75 tabular-nums">
                          {t("youtubeOpinions.shownCount", {
                            count: String(route.tab === "stocks" ? visibleStocks.length : visibleCreators.length),
                          })}
                        </span>
                      )}
                      <Select value={sortBy} onValueChange={(value) => setSortBy(value as DirectorySort)}>
                        <SelectTrigger
                          aria-label={t("common.sort")}
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
                        text={t("youtubeOpinions.directoryLoadFailed")}
                        action={{ label: t("common.retry"), onClick: refresh }}
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
                              text={filtering ? t("youtubeOpinions.noCreatorsMatch") : t("youtubeOpinions.noData")}
                              action={filtering ? { label: t("common.clearFilters"), onClick: clearFilters } : undefined}
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
                <div
                  className={cn(
                    "grid min-w-0 gap-x-12 xl:grid-cols-[minmax(0,1fr)_300px] xl:grid-rows-[auto_1fr]",
                    focused ? "gap-y-8" : "gap-y-10",
                  )}
                >
                  <div className="min-w-0 xl:col-start-1">
                    <div className="flex min-w-0 items-center gap-4">
                      {route.creator && !route.ticker && creator && <Avatar creator={creator} size="lg" />}
                      {route.ticker && (
                        <CompanyLogo
                          symbol={route.ticker}
                          name={stock?.company_name || context?.stocks[0]?.company_name || route.ticker}
                          size="lg"
                        />
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
                      </div>
                      {creator && <CreatorProfileDialog creator={creator} compact />}
                    </div>

                    {contextError ? (
                      <EmptyLine
                        text={t("youtubeOpinions.overviewLoadFailed")}
                        action={{ label: t("common.retry"), onClick: refresh }}
                        alert
                      />
                    ) : !context ? (
                      <div className="mt-6 space-y-4" role="status" aria-label={t("common.loadingStatus")}>
                        <Skeleton className={focused ? "h-6 w-48" : "h-8 w-40"} />
                        {!focused && <Skeleton className="h-4 w-56" />}
                        {!focused && <Skeleton className="h-[150px] w-full sm:h-[190px]" />}
                      </div>
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

                        {route.ticker && (
                          <div
                            role="tablist"
                            aria-label={t("youtubeOpinions.chartView")}
                            className="mt-6 inline-flex w-fit max-w-full items-center gap-0.5 rounded-full bg-muted p-1"
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

                        {route.ticker && chartView === "price" ? (
                          <div className="mt-5">
                            <PriceChart
                              symbol={route.ticker}
                              range={filters.range}
                              from={filters.from}
                              to={filters.to}
                              opinions={chartPoints}
                              formatDate={formatDay}
                              t={t}
                            />
                          </div>
                        ) : chartPoints.length > 0 && (
                          <div className={route.ticker ? "mt-5" : "mt-6"}>
                            <StrengthChart
                              points={chartPoints}
                              tone={overallTone}
                              label={t("youtubeOpinions.chartLabel")}
                              formatDate={formatDay}
                              onScrub={setScrub}
                            />
                          </div>
                        )}

                        {rangeControls(false)}

                        {overview && overview.total_opinions > 0 && (
                          <div>
                            <OpinionDistribution summary={overview} />
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <aside
                    className={cn(
                      "min-w-0 space-y-10 xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:sticky xl:top-6 xl:self-start",
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
                        <h2 className="text-base font-semibold">
                          {t("youtubeOpinions.stocksDiscussed")}
                        </h2>
                        {(context?.stocks.length || 0) > 6 && (
                          <div className="relative mt-3">
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
                        <div className="mt-2">{context ? stockRows : loadingBlock}</div>
                      </section>
                    )}
                    {!route.creator && (
                      <section className="min-w-0">
                        <h2 className="text-base font-semibold">
                          {t("youtubeOpinions.creatorsDiscussing")}
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
                      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
                        <h2 className="text-lg font-semibold">
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
                    </div>
                    {loading ? (
                      loadingBlock
                    ) : (
                      <>
                        {detailError && (
                          <EmptyLine
                            text={t("youtubeOpinions.opinionsLoadFailed")}
                            action={{ label: t("common.retry"), onClick: detail ? loadMore : refresh }}
                            alert
                          />
                        )}
                        {!detailError && !opinions.length && (
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
                        <div className="min-w-0">
                          {videoView
                            ? groupOpinionsByVideo(opinions).map((group) => (
                                <VideoOpinionCard
                                  key={group.videoId}
                                  group={group}
                                  t={t}
                                  onStock={onStock}
                                />
                              ))
                            : opinions.map((opinion) => (
                                <OpinionCard
                                  key={opinion.id}
                                  opinion={opinion}
                                  t={t}
                                  showCreator={!route.creator}
                                  showTicker={!route.ticker}
                                  onCreator={(channelId) => navigate({ tab: "creators", creator: channelId })}
                                  onStock={onStock}
                                />
                              ))}
                        </div>
                        {hasMore && (
                          <div className="mt-6 flex justify-center">
                            <Button variant="outline" onClick={loadMore} disabled={moreLoading}>
                              {moreLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                              {t("youtubeOpinions.loadMoreOpinions")}
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
