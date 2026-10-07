"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Search,
  ArrowLeft,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  getPublishedAnalyses,
  type TradingAnalysis,
} from "@/lib/tradingAnalysisApi";
import { DecisionBadge } from "@/components/trading-analysis/badges";
import CompanyLogo from "@/components/ui/company-logo";

function ExploreSkeleton() {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-3.5">
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-6 w-14 rounded-full" />
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
      <div className="relative flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1080px] space-y-8 px-4 pb-16 pt-6 md:px-8 md:pt-8">
          <div>
            <h2 className="text-[28px] font-bold leading-tight md:text-[32px]">
              {t("tradingAnalysis.explore.title")}
            </h2>
            <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-muted-foreground">
              {t("tradingAnalysis.explore.description")}
            </p>
          </div>

          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
            className="flex max-w-md items-center gap-2"
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("tradingAnalysis.explore.searchPlaceholder")}
                value={searchTicker}
                onChange={(e) => setSearchTicker(e.target.value.toUpperCase())}
                aria-label={t("tradingAnalysis.explore.searchPlaceholder")}
                className="h-11 rounded-full pl-10"
              />
            </div>
            <Button type="submit" className="h-11">
              {t("common.search")}
            </Button>
            {appliedTicker && (
              <Button
                type="button"
                variant="ghost"
                className="h-11"
                onClick={() => {
                  setSearchTicker("");
                  setAppliedTicker("");
                }}
              >
                {t("common.reset")}
              </Button>
            )}
          </form>

          <section aria-labelledby="explore-published" className="animate-fade-in-up">
            <h3 id="explore-published" className="border-b border-border pb-3 text-[17px] font-semibold text-foreground">
              {t("tradingAnalysis.explore.published")}
              {total > 0 && (
                <span className="figure ml-2 text-sm font-normal text-muted-foreground">
                  {total}
                </span>
              )}
            </h3>

            {loading ? (
              <ExploreSkeleton />
            ) : analyses.length === 0 ? (
              <p className="py-12 text-[15px] text-muted-foreground">
                {appliedTicker
                  ? t("tradingAnalysis.explore.noResultsForTicker", {
                      ticker: appliedTicker,
                    })
                  : t("tradingAnalysis.explore.noPublished")}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {analyses.map((item) => (
                  <li key={item.id} className="relative flex items-center gap-3 py-3.5 sm:gap-4">
                    <CompanyLogo symbol={item.ticker} size="md" />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/dashboard/trading-analysis/explore/${item.id}`}
                        className="text-[15px] font-semibold text-foreground after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-primary"
                      >
                        {item.ticker}
                      </Link>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {item.author && (
                          <span className="flex min-w-0 items-center gap-1.5">
                            <Avatar className="h-4 w-4">
                              {item.author.avatar_url && (
                                <AvatarImage src={item.author.avatar_url} alt="" />
                              )}
                              <AvatarFallback className="bg-muted text-[8px]">
                                <User className="h-2.5 w-2.5" />
                              </AvatarFallback>
                            </Avatar>
                            <span className="max-w-[120px] truncate">
                              {item.author.full_name || item.author.username || "User"}
                            </span>
                          </span>
                        )}
                        <span className="figure">{item.trade_date}</span>
                        {item.duration_seconds && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {t("tradingAnalysis.durationSeconds", {
                              seconds: String(Math.round(item.duration_seconds)),
                            })}
                          </span>
                        )}
                        {item.llm_provider && (
                          <span className="capitalize">{item.llm_provider}</span>
                        )}
                      </div>
                    </div>
                    <DecisionBadge decision={item.final_decision} t={t} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}
