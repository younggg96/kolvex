"use client";

import { ListCard } from "@/components/ui/list-card";
import dynamic from "next/dynamic";
import ResearchLayout from "@/components/decision/ResearchLayout";
import { ContentLoading } from "@/components/ui/content-loading";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserProfileContext } from "@/components/user/UserProfileProvider";
import { useTranslation } from "@/lib/i18n";
import PublishedResearch from "./PublishedResearch";

function ResearchLoading() {
  const { t } = useTranslation();
  return (
    <ResearchLayout>
      <div className="relative flex-1 overflow-y-auto">
        <ContentLoading label={t("common.loading")} className="mx-auto min-h-0 w-full px-[16px] pb-10 pt-6 md:px-8 md:pt-8">
          <div className="space-y-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex flex-col gap-3"><Skeleton className="h-9 w-40 rounded-lg md:h-10" /><Skeleton className="h-4 w-80 max-w-full rounded-md" /></div>
              <div className="flex gap-2"><Skeleton className="h-11 w-28 rounded-full" /><Skeleton className="h-11 w-32 rounded-full" /></div>
            </div>
            <div>
              <div className="border-b border-border pb-3"><Skeleton className="h-5 w-24 rounded-md" /></div>
              <ListCard className="mt-4">{[0, 1, 2, 3].map((i) => <div key={i} className="flex items-center gap-3 py-3.5 pr-2 sm:gap-4">
                <Skeleton className="h-10 w-10 shrink-0 rounded-full max-md:h-8 max-md:w-8" />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5"><Skeleton className="h-4 w-14 rounded-md" /><Skeleton className={i % 2 ? "h-3 w-32 rounded-md" : "h-3 w-44 rounded-md"} /></div>
                <Skeleton className="h-6 w-14 shrink-0 rounded-full" />
              </div>)}</ListCard>
            </div>
          </div>
        </ContentLoading>
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
