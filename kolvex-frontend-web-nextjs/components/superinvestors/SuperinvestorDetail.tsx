"use client";

import Link from "next/link";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageBreadcrumb from "@/components/layout/PageBreadcrumb";
import { useFreeResearch } from "@/components/decision/SecData";
import { useFinancialFormat } from "@/components/decision/StockFinancialData";
import { useCopy } from "@/components/decision/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ListEmptyState } from "@/components/ui/list-card";
import { INSTITUTIONS_KEY, institutionKey, type Institution, type InstitutionManager } from "@/lib/freeResearch";
import InstitutionHoldings from "./InstitutionHoldings";
import { InvestorAvatar, useInvestorByline, useQuarterLabel } from "./shared";

const DIRECTORY = "/dashboard/superinvestors";

export default function SuperinvestorDetail({ manager }: { manager: string }) {
  const c = useCopy();
  const f = useFinancialFormat();
  const quarterLabel = useQuarterLabel();
  const byline = useInvestorByline()(manager, true);
  const managers = useFreeResearch<{ managers: InstitutionManager[] }>(INSTITUTIONS_KEY);
  // Same cache key as InstitutionHoldings, so this shares its single SEC read.
  const institution = useFreeResearch<Institution>(institutionKey(manager));
  const identity = managers.data?.managers.find((item) => item.id === manager);
  const unknown = Boolean(managers.data) && !identity;
  const filing = institution.data?.filing;
  const parent = c("Superinvestors", "超级投资者");

  return (
    <DashboardLayout
      title={identity?.name ?? parent}
      breadcrumb={
        <PageBreadcrumb items={[{ label: parent, href: DIRECTORY }, ...(identity ? [{ label: identity.name }] : [])]} />
      }
    >
      <div className="min-h-0 flex-1 overflow-y-auto bg-background dark:bg-transparent">
        <div className="mx-auto max-w-6xl px-[16px] pb-10 pt-4 md:px-8 md:py-8">
          {unknown ? (
            <Card className="px-5 py-2">
              <ListEmptyState
                title={c("Investor not tracked", "未收录该投资者")}
                action={
                  <Button asChild variant="outline" size="sm">
                    <Link href={DIRECTORY}>{c("Back to all investors", "返回全部投资者")}</Link>
                  </Button>
                }
              />
            </Card>
          ) : (
            <>
              <header className="mb-8 flex min-w-0 items-center gap-4">
                <InvestorAvatar id={manager} name={identity?.name ?? ""} size="xl" />
                <div className="min-w-0">
                  <h1 className="truncate text-2xl font-semibold tracking-tight md:text-[2rem]">
                    {identity?.name ?? parent}
                  </h1>
                  {byline && <p className="mt-1 text-base text-foreground/80">{byline}</p>}
                  <p className="mt-1.5 flex flex-wrap gap-x-2 text-sm text-muted-foreground">
                    <span>{c("13F holdings", "13F 持仓")}</span>
                    {filing && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>
                          {quarterLabel(filing.period)} {c("filed", "申报于")} {f.date(filing.filed)}
                        </span>
                      </>
                    )}
                    {identity && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="figure">CIK {identity.cik}</span>
                      </>
                    )}
                  </p>
                </div>
              </header>
              <InstitutionHoldings manager={manager} />
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
