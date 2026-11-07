"use client";

import { ContentLoading } from "@/components/ui/content-loading";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";

export default function BriefState({ loading, error, retry }: { loading: boolean; error: number | null; retry: () => void }) {
  const { t } = useTranslation();
  if (loading) return <ContentLoading label={t("common.loading")} className="min-h-0"><BriefSkeleton /></ContentLoading>;
  const auth = error === 401 || error === 403;
  return <div className="glass-card bg-card-glass space-y-4 rounded-3xl border border-foreground/10 p-6 sm:p-8">
    <h2 role="alert" className="text-lg font-semibold">{t(error === 404 ? "briefs.notFound" : auth ? "briefs.signInRequired" : "briefs.loadError")}</h2>
    {auth ? <Button asChild variant="outline"><Link href="/auth?redirectTo=%2Fdashboard%2Fbriefs">{t("briefs.signIn")}</Link></Button> : error !== 404 && <Button variant="outline" onClick={retry}>{t("common.retry")}</Button>}
  </div>;
}

/** Mirrors BriefContent: hero image, meta line, title/headline/subtitle, then sections with paragraphs. */
function BriefSkeleton() {
  return <div className="mx-auto max-w-[67.5rem] space-y-10">
    <div className="space-y-4">
      <Skeleton className="aspect-video w-full rounded-3xl" />
      <div className="flex gap-2"><Skeleton className="h-3 w-20 rounded-md" /><Skeleton className="h-3 w-14 rounded-md" /><Skeleton className="h-3 w-16 rounded-md" /></div>
      <Skeleton className="h-4 w-32 rounded-md" />
      <div className="space-y-2"><Skeleton className="h-8 w-full rounded-lg sm:h-9" /><Skeleton className="h-8 w-2/3 rounded-lg sm:h-9" /></div>
      <Skeleton className="h-4 w-3/4 rounded-md" />
      <Skeleton className="h-3 w-36 rounded-md" />
    </div>
    {[0, 1].map(i => <div key={i} className="space-y-5 border-t border-border pt-6">
      <Skeleton className="h-6 w-40 rounded-md" />
      <div className="space-y-2.5">{[0, 1, 2, 3].map(j => <Skeleton key={j} className={j === 3 ? "h-4 w-1/2 rounded-md" : "h-4 w-full rounded-md"} />)}</div>
    </div>)}
  </div>;
}
