import { redirect } from "next/navigation";
import { DEEP_RESEARCH_PATH } from "@/lib/researchRoutes";

export default function ExploreAnalysesPage() {
  redirect(DEEP_RESEARCH_PATH);
}
