import { Suspense } from "react";
import Watchlist from "@/components/decision/Watchlist";
import { ContentLoading } from "@/components/ui/content-loading";

export default function WatchlistPage() {
  return <Suspense fallback={<ContentLoading className="min-h-[50dvh] w-full" />}><Watchlist /></Suspense>;
}
