"use client";

import { ContentLoading } from "@/components/ui/content-loading";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";

export default function BriefState({ loading, error, retry }: { loading: boolean; error: number | null; retry: () => void }) {
  const { t } = useTranslation();
  if (loading) return <ContentLoading label={t("common.loading")} />;
  const auth = error === 401 || error === 403;
  return <div className="space-y-4 rounded-3xl border border-border p-6 sm:p-8">
    <h2 className="text-lg font-semibold">{t(error === 404 ? "briefs.notFound" : auth ? "briefs.signInRequired" : "briefs.loadError")}</h2>
    <p role="alert" className="text-sm leading-6 text-muted-foreground">{t(error === 404 ? "briefs.notFoundDetail" : auth ? "briefs.signInDetail" : "briefs.loadErrorDetail")}</p>
    {auth ? <Button asChild variant="outline"><Link href="/auth?redirectTo=%2Fdashboard%2Fbriefs">{t("briefs.signIn")}</Link></Button> : error !== 404 && <Button variant="outline" onClick={retry}>{t("common.retry")}</Button>}
  </div>;
}
