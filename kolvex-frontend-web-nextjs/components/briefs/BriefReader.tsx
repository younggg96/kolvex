"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import DashboardLayout from "@/components/layout/DashboardLayout";
import HeaderBackButton from "@/components/layout/HeaderBackButton";
import { useTranslation } from "@/lib/i18n";
import { briefFilters, briefLibraryHref, type BriefSearchParams, type DailyBrief } from "@/lib/dailyBriefs";
import BriefContent from "./BriefContent";
import BriefState from "./BriefState";
import { useBriefData } from "./useBriefData";

export default function BriefReader({ id, searchParams }: { id: string; searchParams?: BriefSearchParams }) {
  const { t } = useTranslation();
  const { type, page, date } = briefFilters(searchParams);
  const back = briefLibraryHref(type, page, date);
  const { data, loading, error, retry } = useBriefData<{ payload: DailyBrief }>(`?id=${encodeURIComponent(id)}`);
  useEffect(() => { document.title = `${data?.payload.brief.headline || t("briefs.title")} | Kolvex`; }, [data, t]);
  return <DashboardLayout title={t("briefs.title")} headerLeftAction={<HeaderBackButton href={back} label={t("briefs.back")} />}>
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-10 pt-6 md:px-8 md:pt-8">
      <div className="mx-auto max-w-[1080px]">
        {loading || error ? <><BriefState loading={loading} error={error} retry={retry} />{error === 404 && <Button asChild variant="outline" className="mt-4"><Link href={back}>{t("briefs.back")}</Link></Button>}</> : data && <>
          <BriefContent key={id} document={data.payload} />
          <div className="mt-10 border-t border-border pt-6"><Button asChild variant="outline"><Link href={back}>{t("briefs.back")}</Link></Button></div>
        </>}
      </div>
    </div>
  </DashboardLayout>;
}
