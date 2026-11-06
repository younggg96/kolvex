"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useFreeResearch } from "@/components/decision/SecData";
import { useCopy } from "@/components/decision/shared";
import { Skeleton } from "@/components/ui/skeleton";
import { INSTITUTIONS_KEY, type InstitutionManager } from "@/lib/freeResearch";
import InstitutionHoldings from "./InstitutionHoldings";

export default function SuperinvestorDetail({ manager }: { manager: string }) {
  const c = useCopy();
  const managers = useFreeResearch<{ managers: InstitutionManager[] }>(INSTITUTIONS_KEY);
  const identity = managers.data?.managers.find((item) => item.id === manager);
  const unknown = Boolean(managers.data) && !identity;
  const title = identity?.name ?? c("Superinvestors", "超级投资者");
  return (
    <DashboardLayout title={title}>
      <div className="min-h-0 flex-1 overflow-y-auto bg-background dark:bg-transparent">
        <div className="mx-auto max-w-6xl px-[16px] pb-10 pt-4 md:px-8 md:py-8">
          <Link
            href="/dashboard/superinvestors"
            className="-ml-1 inline-flex min-h-10 items-center gap-1 rounded-full pr-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            {c("Superinvestors", "超级投资者")}
          </Link>
          <header className="mb-6 mt-2 md:mb-8">
            {identity ? (
              <h1 className="text-2xl font-semibold tracking-tight md:text-[2rem]">{identity.name}</h1>
            ) : unknown ? (
              <h1 className="text-2xl font-semibold tracking-tight">{c("Investor not tracked", "未收录该投资者")}</h1>
            ) : (
              <Skeleton className="h-9 w-64" />
            )}
            {identity && (
              <p className="mt-2 text-sm text-muted-foreground">
                {c("Latest 13F filing", "最近一份 13F 申报")} · CIK {identity.cik}
              </p>
            )}
          </header>
          {unknown ? (
            <p className="text-sm text-muted-foreground">
              {c("This investor is outside the curated list.", "该投资者不在精选名单中。")}{" "}
              <Link href="/dashboard/superinvestors" className="underline underline-offset-4">
                {c("Back to all investors", "返回全部投资者")}
              </Link>
            </p>
          ) : (
            <InstitutionHoldings manager={manager} />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
