"use client";

import dynamic from "next/dynamic";
import ResearchLayout from "@/components/decision/ResearchLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserProfileContext } from "@/components/user/UserProfileProvider";
import { useTranslation } from "@/lib/i18n";
import PublishedResearch from "./PublishedResearch";

function ResearchLoading() {
  const { t } = useTranslation();
  return (
    <ResearchLayout activeView="deep-research">
      <div role="status" className="mx-auto w-full max-w-[1080px] space-y-4 px-4 py-8 md:px-8">
        <span className="sr-only">{t("common.loading")}</span>
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-80 max-w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </ResearchLayout>
  );
}

const ResearchAuthoring = dynamic(() => import("./ResearchAuthoring"), {
  loading: ResearchLoading,
});

export default function DeepResearchHome({
  searchParams,
}: {
  searchParams?: { ticker?: string; view?: string; page?: string };
}) {
  const { profile, isLoading } = useUserProfileContext();

  if (searchParams?.view === "authoring") {
    if (isLoading) return <ResearchLoading />;
    if (profile?.is_admin) return <ResearchAuthoring searchParams={searchParams} />;
  }

  return <PublishedResearch page={searchParams?.page} />;
}
