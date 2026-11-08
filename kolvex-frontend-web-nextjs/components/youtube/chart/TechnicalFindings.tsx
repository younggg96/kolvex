import Disclosure from "@/components/ui/disclosure";
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
    <Disclosure title={t("youtubeOpinions.ai.focus.evidence")} count={findings.length} className="mt-0 py-3">
      <dl className="space-y-4 pb-3 pt-1">
        {evidence.map(finding => (
          <div key={finding.id}>
            <dt className="text-sm font-medium leading-6 break-words">{finding.title}</dt>
            <dd className="mt-1 whitespace-pre-line break-words text-sm leading-7 text-muted-foreground">
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
    </Disclosure>
  );
}
