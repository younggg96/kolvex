"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Globe,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Clock,
  Bot,
  Search,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { HeroSection } from "@/components/ui/hero-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getPublishedAnalyses,
  type TradingAnalysis,
} from "@/lib/tradingAnalysisApi";

function DecisionBadge({
  decision,
  t,
}: {
  decision: string | null | undefined;
  t: (key: string) => string;
}) {
  if (!decision) return null;
  const d = decision.toUpperCase();
  const config =
    d === "BUY"
      ? {
          icon: TrendingUp,
          label: t("tradingAnalysis.decision.buy"),
          cls: "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary",
        }
      : d === "SELL"
      ? {
          icon: TrendingDown,
          label: t("tradingAnalysis.decision.sell"),
          cls: "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-400",
        }
      : {
          icon: Minus,
          label: t("tradingAnalysis.decision.hold"),
          cls: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400",
        };
  const Icon = config.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold",
        config.cls
      )}
    >
      <Icon className="w-3 h-3" /> {config.label}
    </span>
  );
}

function ExploreSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="bg-white dark:bg-card-dark border border-border-light dark:border-border-dark rounded-lg p-4 space-y-3"
        >
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-5 w-12 rounded-full" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-3.5 w-14" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ExploreAnalysesPage() {
  const router = useRouter();
  const { t } = useTranslation();

  const [analyses, setAnalyses] = useState<TradingAnalysis[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTicker, setSearchTicker] = useState("");
  const [appliedTicker, setAppliedTicker] = useState("");

  const loadPublished = useCallback(
    async (ticker?: string) => {
      try {
        setLoading(true);
        const res = await getPublishedAnalyses({
          limit: 30,
          ticker: ticker || undefined,
        });
        setAnalyses(res.items);
        setTotal(res.total);
      } catch (e) {
        console.error("Failed to load published analyses:", e);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadPublished(appliedTicker);
  }, [loadPublished, appliedTicker]);

  const handleSearch = () => {
    setAppliedTicker(searchTicker.trim().toUpperCase());
  };

  return (
    <DashboardLayout
      title={t("tradingAnalysis.explore.title")}
      headerLeftAction={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/dashboard/trading-analysis")}
          className="gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">
            {t("tradingAnalysis.backToList")}
          </span>
        </Button>
      }
    >
      <div className="relative flex-1 overflow-y-auto bg-background-light dark:bg-background-dark">
        <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />

        <div className="relative">
          <HeroSection
            title={t("tradingAnalysis.explore.title")}
            description={t("tradingAnalysis.explore.description")}
            features={[
              {
                icon: Globe,
                label: t("tradingAnalysis.explore.featureCommunity"),
              },
              {
                icon: TrendingUp,
                label: t("tradingAnalysis.explore.featureInsights"),
              },
              {
                icon: Bot,
                label: t("tradingAnalysis.explore.featureAI"),
              },
            ]}
          />

          <div className="p-4 space-y-6">
            {/* Search bar */}
            <div className="flex items-center gap-2 max-w-md">
              <Input
                placeholder={t("tradingAnalysis.explore.searchPlaceholder")}
                value={searchTicker}
                onChange={(e) => setSearchTicker(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="flex-1"
              />
              <Button size="sm" onClick={handleSearch} className="gap-1.5">
                <Search className="w-3.5 h-3.5" />
                {t("common.search")}
              </Button>
              {appliedTicker && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchTicker("");
                    setAppliedTicker("");
                  }}
                >
                  {t("common.reset")}
                </Button>
              )}
            </div>

            {/* Results */}
            <div className="space-y-3 animate-fade-in-up">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                  <Globe className="w-3.5 h-3.5 text-primary" />
                </div>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                  {t("tradingAnalysis.explore.published")}
                  {total > 0 && (
                    <span className="ml-1.5 text-xs font-normal text-gray-400">
                      ({total})
                    </span>
                  )}
                </h2>
              </div>

              {loading ? (
                <ExploreSkeleton />
              ) : analyses.length === 0 ? (
                <div className="bg-white dark:bg-card-dark border border-border-light dark:border-border-dark rounded-lg text-center py-16">
                  <Globe className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {appliedTicker
                      ? t("tradingAnalysis.explore.noResultsForTicker", {
                          ticker: appliedTicker,
                        })
                      : t("tradingAnalysis.explore.noPublished")}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {analyses.map((item, idx) => (
                    <div
                      key={item.id}
                      onClick={() =>
                        router.push(
                          `/dashboard/trading-analysis/explore/${item.id}`
                        )
                      }
                      className={cn(
                        "group bg-white dark:bg-card-dark border border-border-light dark:border-border-dark rounded-lg p-4 cursor-pointer",
                        "hover:border-primary/30 dark:hover:border-primary/20 transition-all duration-200 hover:shadow-sm",
                        "animate-fade-in-up",
                        idx < 6 && `stagger-${Math.min(idx + 1, 5)}`
                      )}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="min-w-0">
                          <span className="text-lg font-bold text-gray-900 dark:text-white">
                            {item.ticker}
                          </span>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <DecisionBadge
                              decision={item.final_decision}
                              t={t}
                            />
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400">
                          <Globe className="w-2.5 h-2.5" />
                          {t("tradingAnalysis.publishedLabel")}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {item.trade_date}
                        </span>
                        {item.duration_seconds && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {t("tradingAnalysis.durationSeconds", {
                              seconds: String(
                                Math.round(item.duration_seconds)
                              ),
                            })}
                          </span>
                        )}
                        {item.llm_provider && (
                          <span className="capitalize px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-[10px]">
                            {item.llm_provider}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
