"use client";

import { useEffect, useMemo, useState } from "react";
import { useCachedResource } from "@/hooks/useCachedResource";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import ResearchLayout from "@/components/decision/ResearchLayout";
import { useUserProfileContext } from "@/components/user/UserProfileProvider";
import { RESEARCH_AUTHORING_PATH, deepResearchPagePath, parseDeepResearchPage } from "@/lib/researchRoutes";
import { Button } from "@/components/ui/button";
import { ContentLoading } from "@/components/ui/content-loading";
import { groupResearchByStock, loadResearchCatalog, RESEARCH_GROUPS_KEY, STOCKS_PER_PAGE } from "@/lib/researchGroups";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpDown } from "lucide-react";
import { ListCard, ListEmptyState, ListRows, ListToolbar } from "@/components/ui/list-card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getStockAnalysisIndex } from "@/lib/stockAnalysisHistory";
import { ResearchStockGroup } from "./ResearchStockGroup";
import { AnalysisStockGroup } from "./AnalysisStockGroup";
import { ResearchColumnHeader, type ResearchListMode } from "./researchList";

type PlanSort = "newest" | "ratioDesc" | "ratioAsc";

export default function PublishedResearch({ page }: { page?: string }) {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const { profile } = useUserProfileContext();
  const currentPage = parseDeepResearchPage(page);
  const offset = (currentPage - 1) * STOCKS_PER_PAGE;

  const resource = useCachedResource(RESEARCH_GROUPS_KEY, loadResearchCatalog, { ttl: 60_000 });
  const index = useCachedResource("/api/market/analysis-history/_index", getStockAnalysisIndex, { ttl: 60_000 });
  const [tab, setTab] = useState<ResearchListMode>("all");
  const allGroups = useMemo(() => groupResearchByStock(resource.data ?? []), [resource.data]);
  const [sort, setSort] = useState<PlanSort>("newest");
  const analysisItems = useMemo(() => {
    const list = tab === "all" ? [] : (tab === "technical" ? index.data?.technical : index.data?.planned) ?? [];
    if (tab !== "planned" || sort === "newest") return list;
    const ratio = (item: (typeof list)[number]) => item.setup?.risk_reward ?? 0;
    return [...list].sort((a, b) => sort === "ratioDesc" ? ratio(b) - ratio(a) : ratio(a) - ratio(b));
  }, [tab, sort, index.data]);
  const counts = { all: resource.data && allGroups.length, technical: index.data?.technical.length, planned: index.data?.planned.length };
  const total = tab === "all" ? allGroups.length : analysisItems.length;
  const taskTotal = resource.data?.length ?? 0;
  const visibleGroups = allGroups.slice(offset, offset + STOCKS_PER_PAGE);
  const visibleAnalysis = analysisItems.slice(offset, offset + STOCKS_PER_PAGE);
  const loading = tab === "all" ? resource.loading : index.loading;
  const error = Boolean(tab === "all" ? resource.error : index.error);
  const loadPublished = tab === "all" ? resource.refresh : index.refresh;
  const hasData = Boolean(tab === "all" ? resource.data : index.data);
  const dateLocale = locale === "zh" ? "zh-CN" : "en-US";
  const resetPage = () => { if (currentPage > 1) router.replace(deepResearchPagePath(1)); };
  const tabs: Array<{ value: ResearchListMode; label: string }> = [
    { value: "all", label: t("tradingAnalysis.explore.tabAll") },
    { value: "technical", label: t("tradingAnalysis.explore.tabTechnical") },
    { value: "planned", label: t("tradingAnalysis.explore.tabPlanned") },
  ];
  useEffect(() => {
    if (total > 0 && currentPage > Math.ceil(total / STOCKS_PER_PAGE)) router.replace(deepResearchPagePath(Math.ceil(total / STOCKS_PER_PAGE)));
  }, [currentPage, total, router]);

  return (
    <ResearchLayout>
      <main className="relative flex-1 overflow-y-auto" aria-busy={loading}>
        <div className="mx-auto w-full  space-y-8 px-[16px] pb-16 pt-6 md:px-8 md:pt-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-[1.75rem] font-bold leading-tight md:text-[2rem]">
                {t("tradingAnalysis.title")}
              </h1>
              <p className="mt-2 max-w-[60ch] text-[0.9375rem] leading-relaxed text-muted-foreground">
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
            <h2 id="explore-published" className="mb-3 text-[1.0625rem] font-semibold text-foreground">
              {t("tradingAnalysis.explore.byStock")}
              {tab === "all" && total > 0 && (
                <span className="figure ml-2 text-sm font-normal text-muted-foreground">
                  {t("tradingAnalysis.explore.libraryCount", { stocks: String(total), tasks: String(taskTotal) })}
                </span>
              )}
            </h2>

            <ListCard>
              <ListToolbar className="pb-3">
                <Tabs value={tab} onValueChange={(value) => { setTab(value as ResearchListMode); resetPage(); }} className="min-w-0 max-w-full">
                  <TabsList aria-label={t("tradingAnalysis.explore.tabsLabel")}>
                    {tabs.map(({ value, label }) => (
                      <TabsTrigger key={value} value={value}>
                        {label}
                        {counts[value] !== undefined && <span className="figure ml-1.5 text-xs font-normal opacity-70">{counts[value]}</span>}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
                {tab === "planned" && total > 1 && (
                  <div className="ml-auto flex shrink-0 items-center justify-end">
                    <Select value={sort} onValueChange={(value) => { setSort(value as PlanSort); resetPage(); }}>
                      <SelectTrigger aria-label={t("common.sort")} className="h-11 w-auto gap-1.5 rounded-full border-border bg-transparent px-3 text-[0.8125rem] font-semibold hover:border-foreground/25 hover:bg-foreground/[0.06]">
                        <ArrowUpDown aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent align="end">
                        <SelectItem value="newest">{t("tradingAnalysis.explore.sortNewest")}</SelectItem>
                        <SelectItem value="ratioDesc">{t("tradingAnalysis.explore.sortRatioDesc")}</SelectItem>
                        <SelectItem value="ratioAsc">{t("tradingAnalysis.explore.sortRatioAsc")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </ListToolbar>

              {error && hasData && <p role="alert" className="px-2 py-3 text-sm text-muted-foreground">{t("common.error")} <Button variant="outline" size="sm" onClick={() => loadPublished()}>{t("common.retry")}</Button></p>}
              {loading ? (
                <ContentLoading />
              ) : error && !hasData ? (
                <ListEmptyState alert title={t("common.error")} action={<Button variant="outline" size="sm" onClick={() => loadPublished()}>{t("common.retry")}</Button>} />
              ) : total === 0 ? (
                <ListEmptyState title={tab === "all" ? t("tradingAnalysis.explore.noPublished") : t("tradingAnalysis.explore.emptyTab")} />
              ) : (
                <>
                  <ResearchColumnHeader mode={tab} t={t} />
                  <ListRows className="pt-1">
                    {tab === "all"
                      ? visibleGroups.map((group) => (
                        <ResearchStockGroup key={`${currentPage}-${group.ticker}`} {...group} page={currentPage} locale={dateLocale} t={t} />
                      ))
                      : visibleAnalysis.map((item) => (
                        <AnalysisStockGroup key={`${tab}-${currentPage}-${item.ticker}`} item={item} mode={tab} locale={dateLocale} t={t} />
                      ))}
                  </ListRows>
                </>
              )}
              {!error && total > STOCKS_PER_PAGE && (
                <div className="flex items-center justify-center gap-3 py-4">
                  <Button variant="outline" size="sm" className="min-h-11" disabled={loading || currentPage === 1} onClick={() => router.push(deepResearchPagePath(currentPage - 1))}>
                    {t("common.previous")}
                  </Button>
                  <span className="figure text-sm text-muted-foreground">
                    {currentPage} / {Math.ceil(total / STOCKS_PER_PAGE)}
                  </span>
                  <Button variant="outline" size="sm" className="min-h-11" disabled={loading || offset + STOCKS_PER_PAGE >= total} onClick={() => router.push(deepResearchPagePath(currentPage + 1))}>
                    {t("common.next")}
                  </Button>
                </div>
              )}
            </ListCard>
          </section>
        </div>
      </main>
    </ResearchLayout>
  );
}
