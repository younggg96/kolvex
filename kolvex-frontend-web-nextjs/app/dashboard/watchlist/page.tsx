import { Suspense } from "react";
import Watchlist from "@/components/decision/Watchlist";
import { Skeleton } from "@/components/ui/skeleton";

export default function WatchlistPage() {
  return <Suspense fallback={<div className="p-8"><Skeleton className="h-96 w-full" /></div>}><Watchlist /></Suspense>;
}
