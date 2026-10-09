import DeepResearchHome from "@/components/trading-analysis/DeepResearchHome";

export default function DeepResearchPage({
  searchParams,
}: {
  searchParams?: { ticker?: string; view?: string; page?: string };
}) {
  return <DeepResearchHome searchParams={searchParams} />;
}
