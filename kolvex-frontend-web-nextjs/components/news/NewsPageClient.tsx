"use client";

import React, { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import LiveNewsList from "@/components/news/LiveNewsList";
import NewsArticleList from "@/components/news/NewsArticleList";
import { SwitchTab } from "@/components/ui/switch-tab";

interface NewsPageClientProps {
  category: string;
}

export default function NewsPageClient({ category }: NewsPageClientProps) {
  const [activeTab, setActiveTab] = useState("live");

  const newsTabs = [
    {
      value: "live",
      label: "Live News",
    },
    {
      value: "articles",
      label: "News Articles",
    },
  ];

  // Header actions
  const headerActions = (
    <SwitchTab
      options={newsTabs}
      value={activeTab}
      onValueChange={setActiveTab}
      variant="pills"
      size="sm"
      className="!w-fit"
    />
  );

  return (
    <DashboardLayout title="Market News" showHeader={true} headerActions={headerActions}>
      <div className="flex-1 overflow-y-auto bg-background">
        <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />
        <div className="h-[calc(100vh-160px)] p-4 min-w-0">
          {activeTab === "live" ? (
            <LiveNewsList pageSize={30} autoRefreshMinutes={5} />
          ) : (
            <NewsArticleList />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
