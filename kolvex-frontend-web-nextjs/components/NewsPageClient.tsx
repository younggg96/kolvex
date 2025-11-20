"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import EarningsCalendar from "@/components/EarningsCalendar";
import SectionCard from "@/components/SectionCard";
import FinancialJuiceNews from "@/components/FinancialJuiceNews";
import { TrendingUp, Calendar } from "lucide-react";
import { SwitchTab } from "@/components/ui/switch-tab";
import { useBreakpoints } from "@/hooks";

const newsCategories = [
  {
    value: "market",
    label: "Market",
    icon: <TrendingUp className="w-3.5 h-3.5" />,
  },
  {
    value: "earnings",
    label: "Earnings",
    icon: <Calendar className="w-3.5 h-3.5" />,
  },
];

interface NewsPageClientProps {
  category: string;
}

export default function NewsPageClient({ category }: NewsPageClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(category);
  const [isPending, startTransition] = useTransition();
  const { isMobile } = useBreakpoints();

  // 同步 URL 参数和本地状态
  useEffect(() => {
    setActiveTab(category);
  }, [category]);

  const handleTabChange = (value: string) => {
    // 立即更新本地状态，避免闪烁
    setActiveTab(value);

    // 使用 transition 更新 URL，不会阻塞 UI
    startTransition(() => {
      router.push(`/dashboard/news/${value}`, { scroll: false });
    });
  };

  return (
    <DashboardLayout title="Market News">
      <div className="flex-1 p-2 overflow-y-auto">
        {/* Main News Content */}
        <div className="space-y-2">
          {/* News Categories with SectionCard */}
          <SectionCard
            showLiveIndicator
            headerBorder
            padding="md"
            scrollable
            maxHeight="calc(100vh - 180px)"
            contentClassName="space-y-0 px-4 pb-4 mt-2"
            headerExtra={
              <SwitchTab
                options={newsCategories}
                value={activeTab}
                onValueChange={handleTabChange}
                size="md"
                variant="pills"
                className="w-auto"
                disabled={isPending}
              />
            }
          >
            {/* Market Tab Content - FinancialJuice News */}
            {activeTab === "market" && (
              <div className="h-[calc(100vh-240px)]">
                <FinancialJuiceNews width="100%" height="100%" />
              </div>
            )}

            {/* Earnings Tab Content */}
            {activeTab === "earnings" && (
              <EarningsCalendar compact={isMobile} />
            )}
          </SectionCard>
        </div>
      </div>
    </DashboardLayout>
  );
}
