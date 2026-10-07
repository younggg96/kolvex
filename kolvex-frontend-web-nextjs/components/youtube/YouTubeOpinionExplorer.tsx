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
  ChevronRight,
  Loader2,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Upload,
  X,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import YouTubeOpinionImporter from "@/components/admin/YouTubeOpinionImporter";
import { useUserProfileContext } from "@/components/user/UserProfileProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "@/lib/i18n";
import { proxyImageUrl } from "@/lib/utils";
import {
  getYouTubeOpinionDashboard,
  type YouTubeCreatorSummary,
  type YouTubeOpinionDashboard,
  type YouTubeOpinion,
} from "@/lib/youtubeOpinionsApi";
import CreatorProfileDialog from "./CreatorProfileDialog";
import DateFilterField from "./DateFilterField";
import OpinionCard from "./OpinionCard";

type Route = { tab: "stocks" | "creators"; ticker?: string; creator?: string };
type Filters = { sentiment: string; from: string; to: string };
const emptyFilters: Filters = { sentiment: "all", from: "", to: "" };
const pageSize = 40;

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

function Avatar({ creator }: { creator: YouTubeCreatorSummary }) {
  const [failed, setFailed] = useState(false);
  const title = creator.channel_title || creator.channel_id;
  return (
    <div
      aria-hidden="true"
      className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-sm text-muted-foreground"
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
  const [revision, setRevision] = useState(0);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [draft, setDraft] = useState<Filters>(emptyFilters);
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

  useEffect(() => {
    let active = true;
    setContext(null);
    setContextError("");
    if (!ready || !inDetail) return;
    getYouTubeOpinionDashboard({
      ticker: route.ticker,
      channel_id: route.creator,
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
  }, [ready, inDetail, route.ticker, route.creator, revision]);

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
    setFilters(emptyFilters);
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
  const visibleStocks = stocks
    .filter((item) =>
      `${item.ticker} ${item.company_name || ""}`
        .toLocaleLowerCase()
        .includes(query),
    )
    .sort((a, b) => a.ticker.localeCompare(b.ticker));
  const creators = catalogue?.creators || [];
  const visibleCreators = creators
    .filter((item) =>
      `${item.channel_title || ""} ${item.channel_handle || ""} ${item.channel_id}`
        .toLocaleLowerCase()
        .includes(query),
    )
    .sort((a, b) =>
      (a.channel_title || a.channel_id).localeCompare(
        b.channel_title || b.channel_id,
      ),
    );
  const invalidRange = Boolean(draft.from && draft.to && draft.from > draft.to);
  const filterCount = [
    filters.sentiment !== "all",
    Boolean(filters.from || filters.to),
  ].filter(Boolean).length;
  const hasMore =
    detail?.pagination?.has_more ??
    Boolean(detail && opinions.length < detail.summary.total_opinions);
  const refresh = () => setRevision((value) => value + 1);
  const root: Route = { tab: route.tab };
  const back =
    route.creator && route.ticker
      ? { tab: "creators" as const, creator: route.creator }
      : root;
  const linkClass =
    "group flex min-w-0 items-center justify-between gap-3 border-b border-border py-4 transition-colors hover:text-primary focus-visible:outline-primary";

  const stockList = (
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
          className={linkClass}
          label={`${zh ? "查看股票" : "View stock"}: ${item.ticker}`}
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold">{item.ticker}</p>
            <p className="mt-1 break-words text-xs text-muted-foreground">
              {item.company_name || item.ticker}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
        </ExplorerLink>
      ))}
      {!visibleStocks.length && (
        <p className="py-8 text-sm text-muted-foreground">
          {zh ? "暂无符合条件的股票" : "No matching stocks"}
        </p>
      )}
    </div>
  );

  const creatorList = (
    <div className="min-w-0">
      {visibleCreators.map((item) => (
        <ExplorerLink
          onNavigate={navigate}
          key={item.channel_id}
          target={{ tab: "creators", creator: item.channel_id }}
          className={linkClass}
          label={`${zh ? "查看博主" : "View creator"}: ${item.channel_title || item.channel_id}`}
        >
          <div className="flex min-w-0 items-center gap-3">
            <Avatar creator={item} />
            <div className="min-w-0">
              <p className="break-words text-sm font-medium">
                {item.channel_title || item.channel_id}
              </p>
              <p className="mt-1 break-words text-xs text-muted-foreground">
                {item.channel_handle || item.channel_id}
              </p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
        </ExplorerLink>
      ))}
      {!visibleCreators.length && (
        <p className="py-8 text-sm text-muted-foreground">
          {zh ? "暂无符合条件的博主" : "No matching creators"}
        </p>
      )}
    </div>
  );

  return (
    <DashboardLayout
      title={t("youtubeOpinions.title")}
      headerActions={
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            className="h-11 w-11"
            title={t("youtubeOpinions.refresh")}
            aria-label={t("youtubeOpinions.refresh")}
            onClick={refresh}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          {profile?.is_admin && (
            <Button
              size="icon"
              variant="ghost"
              className="h-11 w-11"
              title={t("youtubeOpinions.uploadJson")}
              aria-label={t("youtubeOpinions.uploadJson")}
              onClick={() => setUploadOpen(true)}
            >
              <Upload className="h-4 w-4" />
            </Button>
          )}
        </div>
      }
    >
      <div
        ref={scrollContainer}
        className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-background"
      >
        <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-5 p-4 md:p-7">
          <Tabs
            value={route.tab}
            onValueChange={(value) => navigate({ tab: value as Route["tab"] })}
          >
            <TabsList>
              <TabsTrigger
                value="stocks"
                onClick={() => {
                  if (route.tab === "stocks" && inDetail)
                    navigate({ tab: "stocks" });
                }}
              >
                {zh ? "股票列表" : "Stocks"}
              </TabsTrigger>
              <TabsTrigger
                value="creators"
                onClick={() => {
                  if (route.tab === "creators" && inDetail)
                    navigate({ tab: "creators" });
                }}
              >
                {zh ? "博主列表" : "Creators"}
              </TabsTrigger>
            </TabsList>
            {!inDetail && (
              <>
                <div className="relative mt-4 max-w-md">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    aria-label={zh ? "搜索" : "Search"}
                    placeholder={
                      route.tab === "stocks"
                        ? zh
                          ? "股票代码或公司名称"
                          : "Ticker or company"
                        : zh
                          ? "博主名称或频道"
                          : "Creator or channel"
                    }
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="h-11 pl-9 text-base sm:text-sm"
                  />
                </div>
                {catalogueError ? (
                  <div
                    role="alert"
                    className="py-8 text-sm text-muted-foreground"
                  >
                    {t("youtubeOpinions.loadFailed")}
                    <Button variant="ghost" onClick={refresh}>
                      {zh ? "重试" : "Retry"}
                    </Button>
                  </div>
                ) : !catalogue ? (
                  <div role="status" className="flex justify-center py-16">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : (
                  <>
                    <TabsContent value="stocks">{stockList}</TabsContent>
                    <TabsContent value="creators">{creatorList}</TabsContent>
                  </>
                )}
              </>
            )}
            {inDetail && (
              <TabsContent
                value={route.tab}
                className="mt-5 flex min-w-0 flex-col gap-5"
              >
                <div className="flex min-w-0 items-center gap-2 text-sm">
                  <Button
                    size="icon"
                    variant="ghost"
                    title={zh ? "返回" : "Back"}
                    aria-label={zh ? "返回" : "Back"}
                    className="h-11 w-11 shrink-0"
                    onClick={() => navigate(back)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <ExplorerLink
                    onNavigate={navigate}
                    target={root}
                    className="text-muted-foreground hover:text-primary"
                  >
                    {route.tab === "stocks"
                      ? zh
                        ? "全部股票"
                        : "All stocks"
                      : zh
                        ? "全部博主"
                        : "All creators"}
                  </ExplorerLink>
                  {route.creator && route.ticker && (
                    <>
                      <ChevronRight className="h-3 w-3 shrink-0" />
                      <ExplorerLink
                        onNavigate={navigate}
                        target={{ tab: "creators", creator: route.creator }}
                        className="min-w-0 truncate hover:text-primary"
                      >
                        {title}
                      </ExplorerLink>
                    </>
                  )}
                </div>
                <div className="flex min-w-0 items-center gap-3">
                  {creator && <Avatar creator={creator} />}
                  <div className="min-w-0">
                    <h1 className="break-words text-xl font-semibold">
                      {route.ticker || title}
                    </h1>
                    <p className="mt-1 break-words text-sm text-muted-foreground">
                      {route.creator
                        ? route.ticker
                          ? title
                          : creator?.channel_handle
                        : stock?.company_name}
                    </p>
                  </div>
                  {creator && (
                    <CreatorProfileDialog creator={creator} compact />
                  )}
                </div>

                {route.creator && !route.ticker && (
                  <section className="min-w-0 border-t border-border pt-5">
                    <h2 className="mb-3 text-base font-semibold">
                      {zh ? "讨论过的股票" : "Discussed stocks"}
                    </h2>
                    <Input
                      aria-label={zh ? "搜索股票" : "Search stocks"}
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder={
                        zh ? "股票代码或公司名称" : "Ticker or company"
                      }
                      className="h-11 max-w-md text-base sm:text-sm"
                    />
                    {contextError ? (
                      <Button variant="ghost" onClick={refresh}>
                        {t("youtubeOpinions.loadFailed")}
                      </Button>
                    ) : !context ? (
                      <Loader2 className="my-5 h-5 w-5 animate-spin" />
                    ) : (
                      stockList
                    )}
                  </section>
                )}
                {!route.creator && context && (
                  <section className="min-w-0 border-t border-border pt-5">
                    <h2 className="mb-3 text-base font-semibold">
                      {zh
                        ? "讨论这只股票的博主"
                        : "Creators discussing this stock"}
                    </h2>
                    <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                      {context.creators.map((item) => (
                        <ExplorerLink
                          onNavigate={navigate}
                          key={item.channel_id}
                          target={{ tab: "creators", creator: item.channel_id }}
                          className={linkClass}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <Avatar creator={item} />
                            <span className="break-words text-sm">
                              {item.channel_title || item.channel_id}
                            </span>
                          </div>
                          <ChevronRight className="h-4 w-4 shrink-0" />
                        </ExplorerLink>
                      ))}
                    </div>
                  </section>
                )}

                <section className="min-w-0 border-t border-border pt-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="text-base font-semibold">
                      {zh ? "历史观点" : "Opinion history"}
                    </h2>
                    <Button
                      variant="outline"
                      className="h-11 gap-2"
                      onClick={() => {
                        setDraft(filters);
                        setFiltersOpen(true);
                      }}
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                      {t("youtubeOpinions.filters")}
                      {filterCount > 0 && <span>{filterCount}</span>}
                    </Button>
                  </div>
                  {filterCount > 0 && (
                    <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {filters.sentiment !== "all" && (
                        <span>{t(`youtubeOpinions.${filters.sentiment}`)}</span>
                      )}
                      {(filters.from || filters.to) && (
                        <span>
                          {filters.from || "…"} / {filters.to || "…"}
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        title={t("youtubeOpinions.reset")}
                        aria-label={t("youtubeOpinions.reset")}
                        onClick={() => setFilters(emptyFilters)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  {loading ? (
                    <div role="status" className="flex justify-center py-16">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  ) : (
                    <>
                      {detailError && (
                        <div
                          role="alert"
                          className="mb-4 text-sm text-muted-foreground"
                        >
                          {t("youtubeOpinions.loadFailed")}
                          <Button
                            variant="ghost"
                            onClick={detail ? loadMore : refresh}
                          >
                            {zh ? "重试" : "Retry"}
                          </Button>
                        </div>
                      )}
                      {!detailError && !opinions.length && (
                        <p className="py-8 text-sm text-muted-foreground">
                          {t("youtubeOpinions.noData")}
                        </p>
                      )}
                      <div className="grid min-w-0 grid-cols-1 gap-3">
                        {opinions.map((opinion) => (
                          <OpinionCard
                            key={opinion.id}
                            opinion={opinion}
                            t={t}
                            onCreator={(channelId) =>
                              navigate({ tab: "creators", creator: channelId })
                            }
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
                        <div className="mt-5 flex justify-center">
                          <Button
                            variant="outline"
                            onClick={loadMore}
                            disabled={moreLoading}
                          >
                            {moreLoading && (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            {zh ? "加载更多观点" : "Load more opinions"}
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </section>
                {detail && detail.changes.length > 0 && (
                  <details className="border-t border-border py-4">
                    <summary className="cursor-pointer text-sm font-medium">
                      {t("youtubeOpinions.dailyChanges")}
                    </summary>
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {detail.changes.map((change) => (
                        <div
                          key={change.ticker}
                          className="flex items-center justify-between gap-3 border-b border-border py-3 text-sm"
                        >
                          <span>{change.ticker}</span>
                          <span className="text-xs text-muted-foreground">
                            {change.previous_date || "—"} →{" "}
                            {change.current_date}
                          </span>
                          <span
                            className={
                              change.change === null
                                ? "text-muted-foreground"
                                : (change.change || 0) < 0
                                  ? "text-rose-400"
                                  : "text-emerald-400"
                            }
                          >
                            {change.change === null
                              ? "—"
                              : `${(change.change || 0) > 0 ? "+" : ""}${change.change}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="max-w-sm p-4 sm:p-5">
          <DialogHeader>
            <DialogTitle>{t("youtubeOpinions.filters")}</DialogTitle>
            <DialogDescription className="sr-only">
              {t("youtubeOpinions.filterDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid min-w-0 gap-4 py-4">
            <Select
              value={draft.sentiment}
              onValueChange={(sentiment) =>
                setDraft((previous) => ({ ...previous, sentiment }))
              }
            >
              <SelectTrigger
                aria-label={t("youtubeOpinions.sentiment")}
                className="h-11"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t("youtubeOpinions.allSentiments")}
                </SelectItem>
                {["bullish", "bearish", "neutral", "mixed"].map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`youtubeOpinions.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DateFilterField
              label={t("youtubeOpinions.dateFrom")}
              value={draft.from}
              max={draft.to || undefined}
              onChange={(from) =>
                setDraft((previous) => ({ ...previous, from }))
              }
            />
            <DateFilterField
              label={t("youtubeOpinions.dateTo")}
              value={draft.to}
              min={draft.from || undefined}
              onChange={(to) => setDraft((previous) => ({ ...previous, to }))}
            />
            {invalidRange && (
              <p role="alert" className="text-xs text-destructive">
                {t("youtubeOpinions.invalidDateRange")}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-border pt-4">
            <Button
              variant="ghost"
              className="h-11"
              onClick={() => setDraft(emptyFilters)}
            >
              {t("youtubeOpinions.reset")}
            </Button>
            <Button
              className="h-11"
              disabled={invalidRange}
              onClick={() => {
                setFilters(draft);
                setFiltersOpen(false);
              }}
            >
              {t("youtubeOpinions.apply")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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
