"use client";

import dynamic from "next/dynamic";
import ResearchLayout from "@/components/decision/ResearchLayout";
import { ContentLoading } from "@/components/ui/content-loading";
import { useUserProfileContext } from "@/components/user/UserProfileProvider";
import { useTranslation } from "@/lib/i18n";
import PublishedResearch from "./PublishedResearch";

function ResearchLoading() {
  const { t } = useTranslation();
  return (
    <ResearchLayout>
      <ContentLoading label={t("common.loading")} className="min-h-[50dvh] w-full" />
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
