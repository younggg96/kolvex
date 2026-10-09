import { redirect } from "next/navigation";
import { RESEARCH_AUTHORING_PATH } from "@/lib/researchRoutes";

export default function TradingAnalysisPage({
  searchParams,
}: {
  searchParams?: { ticker?: string };
}) {
  const ticker = searchParams?.ticker;
  redirect(ticker
    ? `${RESEARCH_AUTHORING_PATH}&ticker=${encodeURIComponent(ticker)}`
    : RESEARCH_AUTHORING_PATH);
}
