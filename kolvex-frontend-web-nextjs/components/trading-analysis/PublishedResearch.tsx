"use client";

import { useEffect, useMemo } from "react";
import { useCachedResource } from "@/hooks/useCachedResource";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import ResearchLayout from "@/components/decision/ResearchLayout";
import { useUserProfileContext } from "@/components/user/UserProfileProvider";
import { RESEARCH_AUTHORING_PATH, deepResearchPagePath, parseDeepResearchPage } from "@/lib/researchRoutes";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { groupResearchByStock, loadResearchCatalog, RESEARCH_GROUPS_KEY, STOCKS_PER_PAGE } from "@/lib/researchGroups";
import { ResearchStockGroup } from "./ResearchStockGroup";

function ExploreSkeleton() {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-5">
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2"><Skeleton className="h-5 w-20" /><Skeleton className="h-3 w-16" /></div>
          <Skeleton className="h-6 w-14 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export default function PublishedResearch({ page }: { page?: string }) {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const { profile } = useUserProfileContext();
  const currentPage = parseDeepResearchPage(page);
  const offset = (currentPage - 1) * STOCKS_PER_PAGE;

  const resource = useCachedResource(RESEARCH_GROUPS_KEY, loadResearchCatalog, { ttl: 60_000 });
  const groups = useMemo(() => groupResearchByStock(resource.data ?? []), [resource.data]);
  const total = groups.length;
  const taskTotal = resource.data?.length ?? 0;
  const visibleGroups = groups.slice(offset, offset + STOCKS_PER_PAGE);
  const loading = resource.loading;
  const error = Boolean(resource.error);
  const loadPublished = resource.refresh;
  useEffect(() => {
    if (total > 0 && currentPage > Math.ceil(total / STOCKS_PER_PAGE)) router.replace(deepResearchPagePath(Math.ceil(total / STOCKS_PER_PAGE)));
  }, [currentPage, total, router]);

  return (
    <ResearchLayout>
      <main className="relative flex-1 overflow-y-auto" aria-busy={loading}>
        <div className="mx-auto w-full  space-y-8 px-4 pb-16 pt-6 md:px-8 md:pt-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-[28px] font-bold leading-tight md:text-[32px]">
                {t("tradingAnalysis.title")}
              </h1>
              <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-muted-foreground">
                {t("tradingAnalysis.explore.groupedDescription")}
              </p>
            </div>
            {profile?.is_admin && (
              <Button asChild variant="outline" size="sm">
                <Link href={RESEARCH_AUTHORING_PATH}>{t("research.manageReports")}</Link>
              </Button>
            )}
          </div>

          <section aria-labelledby="explore-published" className="animate-fade-in-up">
            <h2 id="explore-published" className="border-b border-border pb-3 text-[17px] font-semibold text-foreground">
              {t("tradingAnalysis.explore.byStock")}
              {total > 0 && (
                <span className="figure ml-2 text-sm font-normal text-muted-foreground">
                  {t("tradingAnalysis.explore.libraryCount", { stocks: String(total), tasks: String(taskTotal) })}
                </span>
              )}
            </h2>

            {error && resource.data && <p role="alert" className="py-3 text-sm text-muted-foreground">{t("common.error")} <Button variant="outline" size="sm" onClick={loadPublished}>{t("common.retry")}</Button></p>}
            {loading ? (
              <ExploreSkeleton />
            ) : error && !resource.data ? (
              <p role="alert" className="py-8 text-sm text-muted-foreground">{t("common.error")} <Button variant="outline" size="sm" onClick={() => loadPublished()}>{t("common.retry")}</Button></p>
            ) : groups.length === 0 ? (
              <p className="py-12 text-[15px] text-muted-foreground">
                {t("tradingAnalysis.explore.noPublished")}
              </p>
            ) : (
              <div className="mt-2">
                {visibleGroups.map((group) => (
                  <ResearchStockGroup key={`${currentPage}-${group.ticker}`} {...group} page={currentPage} locale={locale === "zh" ? "zh-CN" : "en-US"} t={t} />
                ))}
              </div>
            )}
            {!error && total > STOCKS_PER_PAGE && (
              <div className="mt-6 flex items-center gap-3">
                <Button
                  variant="outline"
                  disabled={loading || currentPage === 1}
                  onClick={() => router.push(deepResearchPagePath(currentPage - 1))}
                >
                  {t("common.previous")}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {currentPage} / {Math.ceil(total / STOCKS_PER_PAGE)}
                </span>
                <Button
                  variant="outline"
                  disabled={loading || offset + STOCKS_PER_PAGE >= total}
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
