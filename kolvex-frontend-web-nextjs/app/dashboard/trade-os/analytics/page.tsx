import { Metadata } from "next";
import { AnalyticsView } from "@/components/trade-os/analytics/AnalyticsView";

export const metadata: Metadata = {
  title: "Performance Analytics - Trade OS | Kolvex",
  description: "Trading discipline metrics, Expectancy R, and R-Multiple distributions.",
};

export default function AnalyticsPage() {
  return <AnalyticsView />;
}
