import { Languages, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const GET_URL_SAFE_LIMIT = 1500;

export async function translateText(
  text: string,
  targetLang: string,
  signal?: AbortSignal
): Promise<string> {
  if (!text?.trim()) return text;
  const tl = targetLang === "zh" ? "zh-CN" : targetLang;

  const usePost = text.length > GET_URL_SAFE_LIMIT;

  const res = usePost
    ? await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: text, tl }),
        signal,
      })
    : await fetch(
        `/api/translate?tl=${encodeURIComponent(tl)}&q=${encodeURIComponent(text)}`,
        { signal }
      );

  if (!res.ok) throw new Error("Translation failed");
  const data = await res.json();
  if (typeof data.translated !== "string" || !data.translated.trim()) {
    throw new Error("Translation failed");
  }
  return data.translated;
}

export function TranslateButton({
  showTranslated,
  isTranslating,
  onToggle,
  t,
}: {
  showTranslated: boolean;
  isTranslating: boolean;
  onToggle: () => void;
  t: (key: string) => string;
}) {
  const label = showTranslated
    ? t("tradingAnalysis.showOriginal")
    : t("tradingAnalysis.translate");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onToggle}
          disabled={isTranslating}
          aria-label={isTranslating ? t("tradingAnalysis.translating") : label}
          aria-pressed={showTranslated}
          aria-busy={isTranslating}
          className={cn(
            "inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50",
            showTranslated
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {isTranslating ? (
            <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
          ) : (
            <Languages aria-hidden="true" className="h-3.5 w-3.5" />
          )}
          <span>{label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p className="text-xs">
          {isTranslating ? t("tradingAnalysis.translating") : label}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
