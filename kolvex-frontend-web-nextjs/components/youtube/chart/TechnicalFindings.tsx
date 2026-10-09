import { ChevronDown } from "lucide-react";
import type { AiTechnicalAnalysis } from "@/lib/stockApi";
import { TECHNICAL_CATEGORIES } from "@/lib/technicalFocus";

type Translate = (key: string, params?: Record<string, string>) => string;

export default function TechnicalFindings({ result, t }: { result: AiTechnicalAnalysis; t: Translate }) {
  const findings = (result.findings ?? []).flatMap(finding => {
    const category = TECHNICAL_CATEGORIES.find(key => key === finding.id);
    const customIndex = /^custom_\d+$/.test(finding.id) ? Number(finding.id.slice(7)) : -1;
    const title = category ? t(`youtubeOpinions.ai.focus.categories.${category}`) : result.custom_scenarios?.[customIndex];
    return title ? [{ ...finding, title, category }] : [];
  });
  if (!findings.length) return null;
  const limited = findings.filter(item => item.category && item.status === "unavailable");
  const evidence = findings.filter(item => !item.category || item.status !== "unavailable");

  return (
    <details className="group/evidence mt-4 border-t border-border">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-details-marker]:hidden">
        <span className="font-medium">{t("youtubeOpinions.ai.focus.evidence")}</span>
        <span className="text-xs tabular-nums text-muted-foreground">{findings.length}</span>
        <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground group-open/evidence:rotate-180" aria-hidden="true" />
      </summary>
      <dl className="space-y-4 pb-3 pt-1">
        {evidence.map(finding => (
          <div key={finding.id}>
            <dt className="text-xs font-medium leading-5 break-words">{finding.title}</dt>
            <dd className="mt-1 max-w-[72ch] text-sm leading-6 text-muted-foreground">
              {finding.status === "unavailable" && <span>{t("youtubeOpinions.ai.focus.unavailable")} · </span>}
              {finding.explanation}
            </dd>
          </div>
        ))}
        {limited.length > 0 && (
          <div>
            <dt className="text-xs font-medium leading-5">{t("youtubeOpinions.ai.focus.unavailable")}</dt>
            <dd className="mt-1 text-sm leading-6 text-muted-foreground">{limited.map(item => item.title).join(" / ")}</dd>
          </div>
        )}
      </dl>
    </details>
  );
}
