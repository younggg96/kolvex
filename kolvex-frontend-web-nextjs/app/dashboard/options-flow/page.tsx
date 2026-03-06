"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Search,
  RefreshCw,
  Filter,
  SlidersHorizontal,
  Loader2,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { HeroSection } from "@/components/ui/hero-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "@/components/ui/hover-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  UnusualActivityTable,
  OptionsFlowStatsCards,
  OptionsAIAssistant,
} from "@/components/options-flow";
import {
  getUnusualActivity,
  type UnusualActivityItem,
  type OptionTypeFilter,
} from "@/lib/optionsFlowApi";
import { useTranslation } from "@/lib/i18n";

const PAGE_SIZE = 50;

export default function OptionsFlowPage() {
  const { t } = useTranslation();
  const router = useRouter();

  // Data state
  const [data, setData] = useState<UnusualActivityItem[]>([]);
  const [total, setTotal] = useState(0);

  // UI state
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filter state
  const [searchSymbol, setSearchSymbol] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [signalFilter, setSignalFilter] = useState<string>("all");
  const [minPremium, setMinPremium] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);

  // Live scan state
  const [liveSymbol, setLiveSymbol] = useState("");

  // Build filter params
  const buildParams = useCallback(
    (offset: number) => {
      const params: Record<string, any> = { limit: PAGE_SIZE, offset };
      if (searchSymbol.trim()) {
        params.symbol = searchSymbol.trim().toUpperCase();
      }
      if (filterType !== "all") {
        params.option_type = filterType as OptionTypeFilter;
      }
      if (minPremium && Number(minPremium) > 0) {
        params.min_premium = Number(minPremium);
      }
      return params;
    },
    [searchSymbol, filterType, minPremium]
  );

  // Load first page
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getUnusualActivity(buildParams(0));
      setData(result.data);
      setTotal(result.total);
    } catch (error) {
      console.error("Failed to load options flow data:", error);
      setData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  // Load next page (append)
  const loadMore = useCallback(async () => {
    if (loadingMore || data.length >= total) return;
    setLoadingMore(true);
    try {
      const result = await getUnusualActivity(buildParams(data.length));
      setData((prev) => [...prev, ...result.data]);
      setTotal(result.total);
    } catch (error) {
      console.error("Failed to load more data:", error);
    } finally {
      setLoadingMore(false);
    }
  }, [buildParams, data.length, total, loadingMore]);

  // Navigate to symbol detail page
  const handleLiveScan = () => {
    const symbol = liveSymbol.trim().toUpperCase();
    if (!symbol) {
      toast.error(t("optionsFlow.enterSymbol"));
      return;
    }
    router.push(`/dashboard/options-flow/${symbol}`);
  };

  // Initial load
  useEffect(() => {
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleApplyFilters = () => {
    loadData();
  };

  const handleRefresh = () => {
    loadData();
  };

  const hasMore = data.length < total;

  const filteredData =
    signalFilter === "all"
      ? data
      : data.filter((d) => d.signal_types?.includes(signalFilter));

  return (
    <DashboardLayout
      title={t("optionsFlow.title")}
      headerClassName="lg:hidden"
    >
      <div className="relative flex-1 overflow-y-auto bg-background-light dark:bg-background-dark">
        <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />

        {/* Hero Section - Desktop Only */}
        <HeroSection
          className="hidden lg:block"
          title={t("optionsFlow.title")}
          description={t("optionsFlow.heroDescription")}
          actions={
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("optionsFlow.searchPlaceholder")}
                  className="pl-9 h-9 w-56"
                  value={liveSymbol}
                  onChange={(e) =>
                    setLiveSymbol(e.target.value.toUpperCase())
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleLiveScan();
                  }}
                />
              </div>
              <Button size="sm" onClick={handleLiveScan} className="h-9 gap-1.5">
                <Activity className="h-3.5 w-3.5" />
                {t("optionsFlow.scan")}
              </Button>
            </div>
          }
        />

        {/* Main Content */}
        <div className="relative p-4 min-w-0 space-y-4">
          {/* Stats Cards */}
          <OptionsFlowStatsCards data={filteredData} total={total} loading={loading} />

          {/* Mobile Search */}
          <div className="flex gap-2 lg:hidden">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("optionsFlow.searchPlaceholder")}
                className="pl-9 h-9"
                value={liveSymbol}
                onChange={(e) =>
                  setLiveSymbol(e.target.value.toUpperCase())
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleLiveScan();
                }}
              />
            </div>
            <Button size="sm" onClick={handleLiveScan} className="h-9 gap-1.5">
              <Activity className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* AI Trading Assistant */}
          <OptionsAIAssistant data={filteredData} />

          {/* Toolbar */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {total > 0
                ? `${data.length} / ${total.toLocaleString()} ${t("optionsFlow.signalsLoaded")}`
                : t("optionsFlow.resultCountEmpty")}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="h-8 gap-1.5 text-xs"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t("optionsFlow.filters")}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={loading}
                className="h-8 gap-1.5 text-xs"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
                />
              </Button>
            </div>
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-border-light dark:border-border-dark bg-muted/30">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {t("optionsFlow.filterSymbol")}
                </span>
                <Input
                  placeholder="TSLA"
                  className="h-8 w-24"
                  value={searchSymbol}
                  onChange={(e) =>
                    setSearchSymbol(e.target.value.toUpperCase())
                  }
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {t("optionsFlow.filterType")}
                </span>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="h-8 w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="call">Call</SelectItem>
                    <SelectItem value="put">Put</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {t("optionsFlow.filterSignal")}
                </span>
                <Select value={signalFilter} onValueChange={setSignalFilter}>
                  <SelectTrigger className="h-8 w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("optionsFlow.signalAll")}</SelectItem>
                    <SelectItem value="high_vol_oi">{t("optionsFlow.signalVolOi")}</SelectItem>
                    <SelectItem value="large_premium">{t("optionsFlow.signalPremium")}</SelectItem>
                    <SelectItem value="high_volume">{t("optionsFlow.signalVolume")}</SelectItem>
                    <SelectItem value="extreme_vol_oi">{t("optionsFlow.signalExtreme")}</SelectItem>
                    <SelectItem value="whale_trade">{t("optionsFlow.signalWhale")}</SelectItem>
                  </SelectContent>
                </Select>
                <HoverCard>
                  <HoverCardTrigger asChild>
                    <button className="text-muted-foreground hover:text-foreground transition-colors">
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </HoverCardTrigger>
                  <HoverCardContent className="w-80" side="bottom" align="start">
                    <p className="text-sm font-semibold mb-2">
                      {t("optionsFlow.signalInfoTitle")}
                    </p>
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <div>
                        <span className="font-medium text-foreground">{t("optionsFlow.signalVolOi")}</span>
                        <span className="mx-1">—</span>
                        {t("optionsFlow.signalInfoVolOi")}
                      </div>
                      <div>
                        <span className="font-medium text-foreground">{t("optionsFlow.signalPremium")}</span>
                        <span className="mx-1">—</span>
                        {t("optionsFlow.signalInfoPremium")}
                      </div>
                      <div>
                        <span className="font-medium text-foreground">{t("optionsFlow.signalVolume")}</span>
                        <span className="mx-1">—</span>
                        {t("optionsFlow.signalInfoVolume")}
                      </div>
                      <div>
                        <span className="font-medium text-foreground">{t("optionsFlow.signalExtreme")}</span>
                        <span className="mx-1">—</span>
                        {t("optionsFlow.signalInfoExtreme")}
                      </div>
                      <div>
                        <span className="font-medium text-foreground">{t("optionsFlow.signalWhale")}</span>
                        <span className="mx-1">—</span>
                        {t("optionsFlow.signalInfoWhale")}
                      </div>
                    </div>
                  </HoverCardContent>
                </HoverCard>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {t("optionsFlow.filterMinPremium")}
                </span>
                <Input
                  type="number"
                  placeholder="50000"
                  className="h-8 w-28"
                  value={minPremium}
                  onChange={(e) => setMinPremium(e.target.value)}
                />
              </div>
              <Button
                size="sm"
                onClick={handleApplyFilters}
                className="h-8 gap-1"
              >
                <Filter className="h-3 w-3" />
                {t("optionsFlow.apply")}
              </Button>
            </div>
          )}

          {/* Table */}
          <UnusualActivityTable data={filteredData} loading={loading} />

          {/* Load More */}
          {!loading && hasMore && (
            <div className="flex justify-center pt-2 pb-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadMore}
                disabled={loadingMore}
                className="h-8 gap-1.5 text-xs"
              >
                {loadingMore && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                {loadingMore ? t("common.loading") : t("common.loadMore")}
              </Button>
            </div>
          )}

          {/* End of list */}
          {!loading && !hasMore && data.length > 0 && (
            <div className="text-center py-3 text-xs text-muted-foreground">
              {t("common.endOfList")}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
