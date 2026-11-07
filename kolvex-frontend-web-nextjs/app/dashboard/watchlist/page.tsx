import { Suspense } from "react";
import Watchlist, { WatchlistPageSkeleton } from "@/components/decision/Watchlist";

export default function WatchlistPage() {
  return <Suspense fallback={<WatchlistPageSkeleton />}><Watchlist /></Suspense>;
}
