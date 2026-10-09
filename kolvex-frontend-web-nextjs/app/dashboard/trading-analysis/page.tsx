"use client";
import { useUserProfileContext } from "@/components/user/UserProfileProvider";
import dynamic from "next/dynamic";
const ResearchAuthoring = dynamic(() => import("@/components/trading-analysis/ResearchAuthoring"));
import ExploreAnalysesPage from "./explore/page";
export default function TradingAnalysisPage({ searchParams }: { searchParams?: { ticker?: string } }) {
  const { profile } = useUserProfileContext();
  return profile?.is_admin ? <ResearchAuthoring searchParams={searchParams} /> : <ExploreAnalysesPage />;
}
