"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { useTranslation } from "@/lib/i18n";
import { savedAnalysisLanguage } from "@/lib/contentLanguage";
import { TranslateButton } from "./translate";
import { useTextTranslations } from "./hooks";

export function useSavedAnalysisLanguage(
  text: (string | null | undefined)[],
  requestLanguage?: unknown,
) {
  const { locale } = useTranslation();
  const entries = [...new Set(text.filter((value): value is string => Boolean(value?.trim())))];
  const sourceLanguage = savedAnalysisLanguage(entries.join("\n"), requestLanguage);
  const available = entries.length > 0 && sourceLanguage !== undefined && sourceLanguage !== locale;
  const translation = useTextTranslations(
    available ? entries.map((value, index) => [String(index), value]) : [],
    locale,
  );
  const visibleLanguage = translation.showTranslated ? locale : sourceLanguage;
  return {
    ...translation,
    available,
    lang: visibleLanguage === "zh" ? "zh-CN" : visibleLanguage,
    read: (value: string) =>
      (translation.showTranslated && translation.translated?.[String(entries.indexOf(value))]) ||
      value,
  };
}

export function SavedAnalysisLanguage({
  control,
}: {
  control: ReturnType<typeof useSavedAnalysisLanguage>;
}) {
  const { t } = useTranslation();
  if (!control.available) return null;
  return (
    <div className="my-2 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
      <span role={control.translationError ? "status" : undefined}>
        {t(
          control.translationError
            ? "youtubeOpinions.ai.textLanguage.failed"
            : control.showTranslated
              ? "youtubeOpinions.ai.textLanguage.translated"
              : "youtubeOpinions.ai.textLanguage.original",
        )}
      </span>
      <TooltipProvider>
        <TranslateButton
          showTranslated={control.showTranslated}
          isTranslating={control.isTranslating}
          onToggle={control.toggle}
          t={t}
        />
      </TooltipProvider>
    </div>
  );
}
