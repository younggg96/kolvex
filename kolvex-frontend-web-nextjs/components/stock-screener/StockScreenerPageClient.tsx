"use client";

import { useState, useCallback, useEffect } from "react";
import {
  SlidersHorizontal,
  Sparkles,
  Search,
  Filter,
  Bot,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { HeroSection } from "@/components/ui/hero-section";
import { Button } from "@/components/ui/button";
import StrategyCard from "./StrategyCard";
import ScreenerFilterPanel from "./ScreenerFilterPanel";
import ScreenerResultsTable from "./ScreenerResultsTable";
import AIInsightPanel from "./AIInsightPanel";
import ScreenerSkeleton from "./ScreenerSkeleton";
import {
  screenStocks,
  getStrategies,
  aiAnalyze,
  type Strategy,
  type ScreenRequest,
  type ScreenResponse,
  type RangeFilter,
  type AIAnalysisResult,
} from "@/lib/stockScreenerApi";

export default function StockScreenerPageClient() {
  const { t, locale } = useTranslation();

  // Strategies
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);

  // Filters
  const [customFilters, setCustomFilters] = useState<
    Record<string, RangeFilter>
  >({});
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Sort & pagination
  const [sortBy, setSortBy] = useState("market_cap");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  // Results
  const [screenResult, setScreenResult] = useState<ScreenResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // AI
  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showAI, setShowAI] = useState(false);

  // Load strategies on mount
  useEffect(() => {
    getStrategies()
      .then(setStrategies)
      .catch((error) => {
        console.error("Failed to load screener strategies:", error);
        toast.error(
          locale === "zh" ? "选股策略加载失败，请稍后重试" : "Failed to load screener strategies",
        );
      });
  }, [locale]);

  const doScreen = useCallback(
    async (overrides?: Partial<ScreenRequest>) => {
      setLoading(true);
      setAiResult(null);
      setShowAI(false);
      try {
        const params: ScreenRequest = {
          strategy_id: selectedStrategy || undefined,
          filters:
            !selectedStrategy && Object.keys(customFilters).length > 0
              ? customFilters
              : undefined,
          sectors: selectedSectors.length > 0 ? selectedSectors : undefined,
          sort_by: sortBy,
          sort_direction: sortDirection,
          page,
          page_size: pageSize,
          ...overrides,
        };
        const result = await screenStocks(params);
        setScreenResult(result);
      } catch (err: any) {
        toast.error(err.message || "Screening failed");
      } finally {
        setLoading(false);
      }
    },
    [
      selectedStrategy,
      customFilters,
      selectedSectors,
      sortBy,
      sortDirection,
      page,
      pageSize,
    ]
  );

  useEffect(() => {
    if (screenResult?.cache_status !== "warming") return;

    const timer = window.setTimeout(() => {
      void doScreen();
    }, 8000);

    return () => window.clearTimeout(timer);
  }, [screenResult?.cache_status, doScreen]);

  const handleStrategySelect = useCallback(
    (id: string) => {
      const next = selectedStrategy === id ? null : id;
      setSelectedStrategy(next);
      setPage(1);

      if (next) {
        const strat = strategies.find((s) => s.id === next);
        if (strat) {
          setCustomFilters({});
          doScreen({
            strategy_id: next,
            filters: undefined,
            sort_by: strat.sort_by,
            sort_direction: strat.sort_direction as "asc" | "desc",
            page: 1,
          });
          setSortBy(strat.sort_by);
          setSortDirection(strat.sort_direction as "asc" | "desc");
        }
      }
    },
    [selectedStrategy, strategies, doScreen]
  );

  const handleCustomScreen = useCallback(() => {
    setSelectedStrategy(null);
    setPage(1);
    doScreen({ strategy_id: undefined, page: 1 });
  }, [doScreen]);

  const handleSort = useCallback(
    (field: string) => {
      const newDir =
        sortBy === field && sortDirection === "desc" ? "asc" : "desc";
      setSortBy(field);
      setSortDirection(newDir);
      doScreen({ sort_by: field, sort_direction: newDir });
    },
    [sortBy, sortDirection, doScreen]
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      setPage(newPage);
      doScreen({ page: newPage });
    },
    [doScreen]
  );

  const handleAIAnalyze = useCallback(async () => {
    if (!screenResult?.results?.length) return;
    setAiLoading(true);
    setShowAI(true);
    try {
      const symbols = screenResult.results.slice(0, 10).map((s) => s.symbol);
      const result = await aiAnalyze(symbols);
      setAiResult(result);
    } catch (err: any) {
      toast.error(err.message || "AI analysis failed");
      setShowAI(false);
    } finally {
      setAiLoading(false);
    }
  }, [screenResult]);

  const isZh = locale === "zh";

  return (
    <DashboardLayout
      title={isZh ? "AI 选股器" : "AI Stock Screener"}
      headerActions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="xs"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-3.5 h-3.5 mr-1" />
            {isZh ? "筛选" : "Filters"}
          </Button>
          {screenResult && screenResult.results.length > 0 && (
            <Button size="xs" onClick={handleAIAnalyze} disabled={aiLoading}>
              <Sparkles className="w-3.5 h-3.5 mr-1" />
              {isZh ? "AI 分析" : "AI Analyze"}
            </Button>
          )}
        </div>
      }
    >
      <div className="relative flex-1 overflow-y-auto bg-background">
        <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />
        <div className="relative">
          {/* Hero */}
          <HeroSection
            title={isZh ? "AI 选股器" : "AI Stock Screener"}
            description={
              isZh
                ? "结合量化筛选与 AI 智能分析，发现投资机会"
                : "Combine quantitative screening with AI analysis to discover investment opportunities"
            }
            features={[
              {
                icon: SlidersHorizontal,
                label: isZh ? "多维度筛选" : "Multi-Dimension Filters",
              },
              { icon: Bot, label: isZh ? "AI 评分" : "AI Scoring" },
              {
                icon: BarChart3,
                label: isZh ? "策略模板" : "Strategy Templates",
              },
            ]}
          />

          <div className="p-4 space-y-4">
            {/* Strategy Cards */}
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground mb-3">
                {isZh ? "策略模板" : "Strategy Templates"}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {strategies.map((strategy) => (
                  <StrategyCard
                    key={strategy.id}
                    strategy={strategy}
                    isSelected={selectedStrategy === strategy.id}
                    onClick={() => handleStrategySelect(strategy.id)}
                    locale={locale}
                  />
                ))}
              </div>
            </div>

            {/* Filter Panel */}
            {showFilters && (
              <ScreenerFilterPanel
                filters={customFilters}
                onFiltersChange={setCustomFilters}
                selectedSectors={selectedSectors}
                onSectorsChange={setSelectedSectors}
                onApply={handleCustomScreen}
                locale={locale}
              />
            )}

            {/* Results */}
            {loading ? (
              <ScreenerSkeleton />
            ) : screenResult ? (
              <>
                {screenResult.cache_status === "warming" && (
                  <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
                    <span className="size-2 shrink-0 rounded-full bg-amber-500 animate-pulse" />
                    <span>
                      {isZh
                        ? "股票数据正在自动准备，页面会每 8 秒刷新结果。"
                        : "Stock data is being prepared. Results refresh automatically every 8 seconds."}
                    </span>
                  </div>
                )}
                <ScreenerResultsTable
                  data={screenResult}
                  sortBy={sortBy}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  onPageChange={handlePageChange}
                  aiScores={aiResult?.stocks}
                  locale={locale}
                />

                {showAI && (
                  <AIInsightPanel
                    result={aiResult}
                    loading={aiLoading}
                    locale={locale}
                  />
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Search className="w-12 h-12 mb-4 opacity-30" />
                <p className="text-sm">
                  {isZh
                    ? "选择一个策略或设置筛选条件开始"
                    : "Select a strategy or set filters to begin"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
