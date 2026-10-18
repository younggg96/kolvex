"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Moon, Sun, RefreshCw, FileInput } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { useUserProfileContext } from "@/components/user/UserProfileProvider";
import { briefArticleHref, briefFilters, briefLibraryHref, formatBriefDate, type BriefFilter, type BriefList, type BriefSearchParams, type BriefSummary } from "@/lib/dailyBriefs";
import { BriefImageMedia } from "./BriefImage";
import BriefState from "./BriefState";
import { useBriefData } from "./useBriefData";

function IssueMeta({ issue }: { issue: BriefSummary }) {
  const { t, locale } = useTranslation();
  const Icon = issue.brief_type === "morning" ? Sun : Moon;
  return <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
    <span className="inline-flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" aria-hidden="true" />{t(`briefs.${issue.brief_type}`)}</span>
    <time dateTime={issue.brief_date}>{formatBriefDate(issue.brief_date, locale)}</time>
    {issue.summary?.market_status === "weekend" && <span>{t("briefs.weekend")}</span>}
  </div>;
}

export default function BriefLibrary({ searchParams }: { searchParams?: BriefSearchParams }) {
  const { t } = useTranslation();
  const { profile } = useUserProfileContext();
  const { type, page } = briefFilters(searchParams);
  const query = new URLSearchParams({ page: String(page) });
  if (type !== "all") query.set("type", type);
  const { data, loading, error, retry } = useBriefData<BriefList>(`?${query}`);
  useEffect(() => { document.title = `${t("briefs.title")} | Kolvex`; }, [t]);
  const featured = page === 1 ? data?.items[0] : undefined;
  const archive = featured ? data!.items.slice(1) : data?.items ?? [];
  const image = featured?.summary?.hero_image;
  const filters: BriefFilter[] = ["all", "morning", "evening"];

  return <DashboardLayout title={t("briefs.title")}>
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-10 pt-6 md:px-8 md:pt-8">
      <div className="mx-auto max-w-[1080px] space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-[15px] leading-7 text-muted-foreground">{t("briefs.description")}</p>
          {profile?.is_admin && <Button asChild size="sm" variant="outline"><Link href="/dashboard/admin?tab=briefs"><FileInput className="mr-1 h-4 w-4" aria-hidden="true" />{t("briefs.import")}</Link></Button>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <nav aria-label={t("briefs.filterLabel")} className="flex gap-1">
            {filters.map(value => <Button key={value} asChild size="sm" variant={type === value ? "secondary" : "ghost"}><Link href={briefLibraryHref(value)} aria-current={type === value ? "page" : undefined}>{t(value === "all" ? "common.all" : `briefs.${value}`)}</Link></Button>)}
          </nav>
          <Button variant="ghost" size="sm" disabled={loading} onClick={retry}><RefreshCw className="mr-1 h-3.5 w-3.5" aria-hidden="true" />{t("common.refresh")}</Button>
        </div>
        {loading || error ? <BriefState loading={loading} error={error} retry={retry} /> : !data?.items.length ? <div className="space-y-3 rounded-xl border border-border px-6 py-12 text-center">
          <h2 className="text-xl font-semibold">{t(type === "all" ? "briefs.empty" : "briefs.emptyFiltered")}</h2>
          <p className="text-sm leading-6 text-muted-foreground">{t("briefs.emptyDetail")}</p>
          {type !== "all" && <Button asChild variant="outline"><Link href={briefLibraryHref()}>{t("briefs.showAll")}</Link></Button>}
          {page > 1 && <Button asChild variant="outline"><Link href={briefLibraryHref(type)}>{t("briefs.firstPage")}</Link></Button>}
        </div> : <>
          {featured && <article className="border-b border-border pb-8">
            <Link href={briefArticleHref(featured.id, type, page)} className={`group grid items-center gap-6 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary ${image ? "md:grid-cols-[1.1fr_1fr]" : ""}`}>
              {image && <div className="overflow-hidden rounded-xl"><BriefImageMedia key={image.url} image={image} /></div>}
              <div className="space-y-4">
                <p className="text-xs font-medium text-positive">{t("briefs.latest")}</p>
                <IssueMeta issue={featured} />
                <h2 className="text-2xl font-semibold leading-[1.45] tracking-tight group-hover:underline group-hover:underline-offset-4 sm:text-[30px]">{featured.headline}</h2>
                {featured.summary?.subtitle && <p className="max-w-prose text-sm leading-7 text-muted-foreground">{featured.summary.subtitle}</p>}
                <span className="inline-block text-sm font-semibold underline underline-offset-4">{t("briefs.read")}</span>
              </div>
            </Link>
            {image && <p className="mt-3 text-xs text-muted-foreground">{t("briefs.imageCredit")} <a href={image.source_page} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">{image.credit}</a></p>}
          </article>}
          {archive.length > 0 && <section aria-label={t("briefs.archive")}><h2 className="mb-3 text-lg font-semibold">{t("briefs.archive")}</h2><ul className="divide-y divide-border">{archive.map(issue => <li key={issue.id}><Link href={briefArticleHref(issue.id, type, page)} className="group block space-y-2 rounded-xl px-3 py-5 transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><IssueMeta issue={issue} /><h3 className="text-lg font-semibold leading-8 group-hover:underline group-hover:underline-offset-4">{issue.headline}</h3>{issue.summary?.subtitle && <p className="text-sm leading-7 text-muted-foreground">{issue.summary.subtitle}</p>}</Link></li>)}</ul></section>}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">{t("briefs.pagination", { page: String(page), total: String(data.total) })}</p>
            <nav aria-label={t("briefs.paginationLabel")} className="flex gap-2">
              {page > 1 && <Button asChild size="sm" variant="outline"><Link href={briefLibraryHref(type, page - 1)}>{t("common.previous")}</Link></Button>}
              {page * 10 < data.total && <Button asChild size="sm" variant="outline"><Link href={briefLibraryHref(type, page + 1)}>{t("briefs.nextPage")}</Link></Button>}
            </nav>
          </div>
        </>}
      </div>
    </div>
  </DashboardLayout>;
}
