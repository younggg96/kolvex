import Market from "@/components/decision/Market";
import { Suspense } from "react";
import { MarketPageSkeleton } from "@/components/decision/MarketSkeletons";

export default function Dashboard() {
  return <Suspense fallback={<MarketPageSkeleton />}><Market /></Suspense>;
}
