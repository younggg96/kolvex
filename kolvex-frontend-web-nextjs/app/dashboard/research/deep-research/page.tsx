import { redirect } from "next/navigation";
import { DEEP_RESEARCH_PATH, deepResearchPagePath, parseDeepResearchPage } from "@/lib/researchRoutes";

export default function DeepResearchPage({
  searchParams,
}: {
  searchParams?: { ticker?: string; view?: string; page?: string };
}) {
  if (searchParams?.view === "authoring") {
    const ticker = searchParams.ticker ? `&ticker=${encodeURIComponent(searchParams.ticker)}` : "";
    redirect(`${DEEP_RESEARCH_PATH}?view=authoring${ticker}`);
  }
  redirect(deepResearchPagePath(parseDeepResearchPage(searchParams?.page)));
}
