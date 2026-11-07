import { Suspense } from "react";
import Watchlist from "@/components/decision/Watchlist";
import { ContentLoading } from "@/components/ui/content-loading";

export default function WatchlistPage() {
  return <Suspense fallback={<ContentLoading variant="page" className="min-h-[50dvh] w-full px-[16px] md:px-8" />}><Watchlist /></Suspense>;
}
