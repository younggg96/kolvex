import DeepResearchHome from "@/components/trading-analysis/DeepResearchHome";

export default function AiResearchPage({
  searchParams,
}: {
  searchParams?: { ticker?: string; view?: string; page?: string };
}) {
  return <DeepResearchHome searchParams={searchParams} />;
}
