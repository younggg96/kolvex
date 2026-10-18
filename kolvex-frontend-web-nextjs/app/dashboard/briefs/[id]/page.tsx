import BriefReader from "@/components/briefs/BriefReader";
import type { BriefSearchParams } from "@/lib/dailyBriefs";

export default function BriefPage({ params, searchParams }: { params: { id: string }; searchParams?: BriefSearchParams }) {
  return <BriefReader id={params.id} searchParams={searchParams} />;
}
