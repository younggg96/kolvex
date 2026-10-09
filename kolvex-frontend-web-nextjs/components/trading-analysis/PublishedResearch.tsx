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
        <div className="mx-auto w-full max-w-[1080px] space-y-8 px-4 pb-16 pt-6 md:px-8 md:pt-8">
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
              <ul className="divide-y divide-border">
                {analyses.map((item) => (
                  <li key={item.id} className="relative -mx-3 flex items-center gap-3 rounded-xl px-3 py-3.5 transition-colors hover:bg-muted/60 sm:gap-4">
                    <CompanyLogo symbol={item.ticker} size="md" />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/dashboard/trading-analysis/explore/${item.id}${currentPage > 1 ? `?page=${currentPage}` : ""}`}
                        className="cursor-pointer text-[15px] font-semibold text-foreground after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-primary"
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
                              {item.author.full_name || item.author.username || t("research.author")}
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
