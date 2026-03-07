import { Languages } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const GET_URL_SAFE_LIMIT = 1500;

export async function translateText(
  text: string,
  targetLang: string
): Promise<string> {
  if (!text?.trim()) return text;
  const tl = targetLang === "zh" ? "zh-CN" : targetLang;

  const usePost = text.length > GET_URL_SAFE_LIMIT;

  const res = usePost
    ? await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: text, tl }),
      })
    : await fetch(
        `/api/translate?tl=${encodeURIComponent(tl)}&q=${encodeURIComponent(text)}`
      );

  if (!res.ok) throw new Error("Translation failed");
  const data = await res.json();
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
          aria-label={label}
          className={cn(
            "p-1.5 rounded-md transition-colors",
            showTranslated
              ? "text-primary bg-primary/10"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
            isTranslating && "opacity-50 cursor-not-allowed"
          )}
        >
          <Languages
            className={cn("w-3.5 h-3.5", isTranslating && "animate-pulse")}
          />
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
