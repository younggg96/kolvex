"use client";

import React, { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import SectionCard from "@/components/layout/SectionCard";
import FinancialJuiceNews from "@/components/news/FinancialJuiceNews";
import NewsArticleList from "@/components/news/NewsArticleList";
import { SwitchTab } from "@/components/ui/switch-tab";
import { Newspaper, Zap } from "lucide-react";

interface NewsPageClientProps {
  category: string;
}

export default function NewsPageClient({ category }: NewsPageClientProps) {
  const [activeTab, setActiveTab] = useState("live");

  const newsTabs = [
    {
      value: "live",
      label: "Live News",
      icon: <Zap className="w-3.5 h-3.5" />,
    },
    {
      value: "articles",
      label: "News Articles",
      icon: <Newspaper className="w-3.5 h-3.5" />,
    },
  ];

  return (
    <DashboardLayout title="Market News">
      <div className="flex-1 p-2 overflow-y-auto">
        <SectionCard
          padding="sm"
          scrollable
          contentClassName="space-y-0 px-4 pb-4"
          useSectionHeader={true}
          headerExtra={
            <SwitchTab
              options={newsTabs}
              value={activeTab}
              onValueChange={setActiveTab}
              variant="pills"
              size="md"
              className="!w-fit"
            />
          }
        >
          <div className="h-[calc(100vh-220px)]">
            {activeTab === "live" ? (
              <FinancialJuiceNews width="100%" height="100%" />
            ) : (
              <NewsArticleList />
            )}
          </div>
        </SectionCard>
      </div>
    </DashboardLayout>
  );
}
