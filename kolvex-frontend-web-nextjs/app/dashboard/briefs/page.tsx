import BriefLibrary from "@/components/briefs/BriefLibrary";
import type { BriefSearchParams } from "@/lib/dailyBriefs";

export default function BriefsPage({ searchParams }: { searchParams?: BriefSearchParams }) {
  return <BriefLibrary searchParams={searchParams} />;
}
