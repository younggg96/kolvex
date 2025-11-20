import { Suspense } from "react";
import TrendingTopicsPageClient from "@/components/TrendingTopicsPageClient";
import { TrendingTopic } from "@/lib/mockData";
import { mockTrendingTopics } from "@/lib/mockData";

async function getTrendingTopics(): Promise<TrendingTopic[]> {
  // Return mock data directly
  return mockTrendingTopics;
}

export default async function TrendingPage() {
  const topics = await getTrendingTopics();

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <TrendingTopicsPageClient initialTopics={topics} />
    </Suspense>
  );
}
