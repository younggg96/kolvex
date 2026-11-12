"use client";

import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslation } from "@/lib/i18n";
import type { AnswerCheck } from "@/lib/chatApi";

export function AnswerCheckNote({ check }: { check: AnswerCheck }) {
  const { locale, t } = useTranslation();
  if (!check.mismatch && !check.matched) return null;

  const format = new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", { maximumFractionDigits: 4 });
  const flagged = check.mismatch > 0;
  const shown = check.claims.filter((claim) => claim.status === (flagged ? "mismatch" : "matched"));
  const Icon = flagged ? AlertTriangle : CheckCircle2;

  return (
    <div
      className={
        flagged
          ? "flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400"
          : "flex items-center gap-1.5 text-xs text-muted-foreground"
      }
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      <span>
        {flagged
          ? t("chat.answerCheck.mismatch", { count: String(check.mismatch) })
          : t("chat.answerCheck.matched", { count: String(check.matched) })}
      </span>
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger
            className="rounded-full text-muted-foreground focus-visible:ring-2 focus-visible:ring-foreground/60"
            aria-label={t("chat.answerCheck.details")}
          >
            <Info className="size-3.5" aria-hidden="true" />
          </TooltipTrigger>
          <TooltipContent className="max-w-xs space-y-1.5 py-2 font-normal">
            {shown.map((claim, index) => (
              <p key={`${claim.text}:${index}`}>
                <span className="font-semibold tabular-nums">{claim.text}</span>
                {claim.expected && (
                  <span className="block opacity-80">
                    {t("chat.answerCheck.expected", {
                      value: format.format(claim.expected.value),
                      label: claim.expected.label,
                    })}
                  </span>
                )}
              </p>
            ))}
            {check.unverified > 0 && (
              <p className="opacity-80">{t("chat.answerCheck.unverified", { count: String(check.unverified) })}</p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
