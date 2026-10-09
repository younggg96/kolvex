"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Clock,
  User,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import ResearchLayout from "@/components/decision/ResearchLayout";
import { useUserProfileContext } from "@/components/user/UserProfileProvider";
import { RESEARCH_AUTHORING_PATH, deepResearchPagePath, parseDeepResearchPage } from "@/lib/researchRoutes";
import { Button } from "@/components/ui/button";
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
    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="space-y-6 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="ml-auto h-6 w-14 rounded-full" />
          </div>
          <div className="space-y-3 border-t border-border pt-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PublishedResearch({ page }: { page?: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { profile } = useUserProfileContext();
  const currentPage = parseDeepResearchPage(page);
  const offset = (currentPage - 1) * 30;

  const [analyses, setAnalyses] = useState<TradingAnalysis[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const requestId = useRef(0);

  const loadPublished = useCallback(
    async () => {
      const currentRequest = ++requestId.current;
      try {
        setLoading(true);
        setError(false);
        const res = await getPublishedAnalyses({
          limit: 30,
          offset,
        });
        if (currentRequest !== requestId.current) return;
        if (res.total > 0 && currentPage > Math.ceil(res.total / 30)) {
          router.replace(deepResearchPagePath(Math.ceil(res.total / 30)));
          return;
        }
        setAnalyses(res.items);
        setTotal(res.total);
      } catch (e) {
        if (currentRequest === requestId.current) setError(true);
      } finally {
        if (currentRequest === requestId.current) setLoading(false);
      }
    },
    [currentPage, offset, router]
  );

  useEffect(() => {
    loadPublished();
    return () => { requestId.current += 1; };
  }, [loadPublished]);

  return (
    <ResearchLayout
      headerActions={profile?.is_admin ? (
        <Button asChild variant="outline" size="sm">
          <Link href={RESEARCH_AUTHORING_PATH}>{t("research.manageReports")}</Link>
        </Button>
      ) : undefined}
    >
      <main className="relative flex-1 overflow-y-auto" aria-busy={loading}>
        <div className="mx-auto w-full  space-y-8 px-4 pb-16 pt-6 md:px-8 md:pt-8">
          <div>
            <h2 className="text-[28px] font-bold leading-tight md:text-[32px]">
              {t("tradingAnalysis.title")}
            </h2>
            <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-muted-foreground">
              {t("tradingAnalysis.explore.description")}
            </p>
          </div>

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
            ) : error ? (
              <p role="alert" className="py-8 text-sm text-muted-foreground">{t("common.error")} <Button variant="outline" size="sm" onClick={() => loadPublished()}>{t("common.retry")}</Button></p>
            ) : analyses.length === 0 ? (
              <p className="py-12 text-[15px] text-muted-foreground">
                {t("tradingAnalysis.explore.noPublished")}
              </p>
            ) : (
              <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {analyses.map((item) => (
                  <li key={item.id} className="min-w-0">
                    <Link
                      href={`/dashboard/trading-analysis/explore/${item.id}${currentPage > 1 ? `?page=${currentPage}` : ""}`}
                      className="flex h-full min-w-0 flex-col gap-6 rounded-xl border border-border bg-card p-5 transition-colors hover:border-foreground/25 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <CompanyLogo symbol={item.ticker} size="md" />
                        <span className="min-w-0 flex-1 break-words text-lg font-semibold text-foreground">
                          {item.ticker}
                        </span>
                        <span className="shrink-0">
                          <DecisionBadge decision={item.final_decision} t={t} />
                        </span>
                      </div>
                      <div className="mt-auto space-y-3 border-t border-border pt-4 text-xs text-muted-foreground">
                        {item.author && (
                          <span className="flex min-w-0 items-center gap-2">
                            <Avatar className="h-5 w-5 shrink-0">
                              {item.author.avatar_url && (
                                <AvatarImage src={item.author.avatar_url} alt="" />
                              )}
                              <AvatarFallback className="bg-muted text-[8px]">
                                <User className="h-2.5 w-2.5" />
                              </AvatarFallback>
                            </Avatar>
                            <span className="truncate">
                              {item.author.full_name || item.author.username || t("research.author")}
                            </span>
                          </span>
                        )}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
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
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {!error && total > 30 && (
              <div className="mt-6 flex items-center gap-3">
                <Button
                  variant="outline"
                  disabled={loading || currentPage === 1}
                  onClick={() => router.push(deepResearchPagePath(currentPage - 1))}
                >
                  {t("common.previous")}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {currentPage} / {Math.ceil(total / 30)}
                </span>
                <Button
                  variant="outline"
                  disabled={loading || offset + 30 >= total}
                  onClick={() => router.push(deepResearchPagePath(currentPage + 1))}
                >
                  {t("common.next")}
                </Button>
              </div>
            )}
          </section>
        </div>
      </main>
    </ResearchLayout>
  );
}
