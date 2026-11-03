"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { RouteLoadingSignal } from "@/components/layout/NavigationProgress";
import { ContentLoading } from "@/components/ui/content-loading";
import { useTranslation } from "@/lib/i18n";

/** Lets dashboard routes switch immediately while the next page's server payload loads. */
export default function DashboardLoading() {
  const { t } = useTranslation();

  return (
    <DashboardLayout noTransition>
      <RouteLoadingSignal />
      <div className="min-h-0 flex-1 overflow-hidden px-[16px] md:px-8">
        <ContentLoading label={t("common.loading")} className="h-full" />
      </div>
    </DashboardLayout>
  );
}
