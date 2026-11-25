"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { useCopy } from "@/components/decision/shared";
import FeaturedInvestors from "./FeaturedInvestors";
import SuperinvestorsDirectory from "./SuperinvestorsDirectory";

export default function SuperinvestorsPage() {
  const c = useCopy();
  return (
    <DashboardLayout title={c("Superinvestors", "超级投资者")}>
      <div className="min-h-0 flex-1 overflow-y-auto bg-background dark:bg-transparent">
        <div className="mx-auto max-w-[100rem] px-[16px] pb-10 pt-4 md:px-8 md:py-8">
          <header className="mb-6 md:mb-8">
            <h1 className="text-2xl font-semibold tracking-tight md:text-[2rem]">
              {c("Superinvestors", "超级投资者")}
            </h1>
          </header>
          <FeaturedInvestors />
          <SuperinvestorsDirectory />
        </div>
      </div>
    </DashboardLayout>
  );
}
