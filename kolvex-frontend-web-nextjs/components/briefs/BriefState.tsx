"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";

export default function BriefState({ loading, error, retry }: { loading: boolean; error: number | null; retry: () => void }) {
  const { t } = useTranslation();
  if (loading) return <div role="status" className="flex min-h-52 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{t("common.loading")}</div>;
  const auth = error === 401 || error === 403;
  return <div className="space-y-4 rounded-xl border border-border p-6 sm:p-8">
    <h2 className="text-lg font-semibold">{t(error === 404 ? "briefs.notFound" : auth ? "briefs.signInRequired" : "briefs.loadError")}</h2>
    <p role="alert" className="text-sm leading-6 text-muted-foreground">{t(error === 404 ? "briefs.notFoundDetail" : auth ? "briefs.signInDetail" : "briefs.loadErrorDetail")}</p>
    {auth ? <Button asChild variant="outline"><Link href="/auth?redirectTo=%2Fdashboard%2Fbriefs">{t("briefs.signIn")}</Link></Button> : error !== 404 && <Button variant="outline" onClick={retry}>{t("common.retry")}</Button>}
  </div>;
}
