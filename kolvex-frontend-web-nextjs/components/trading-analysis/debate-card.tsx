import { useMemo } from "react";
import { TrendingUp, TrendingDown, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MarkdownBody } from "./markdown";
import { TranslateButton } from "./translate";
import { useDebateTranslation } from "./hooks";

export function DebateCard({
  title,
  icon: Icon,
  debate,
  bullLabel,
  bearLabel,
  judgeLabel,
  className,
  locale,
  t,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  debate: Record<string, string> | null | undefined;
  bullLabel: string;
  bearLabel: string;
  judgeLabel: string;
  className?: string;
  locale: string;
  t: (key: string) => string;
}) {
  const bullKey =
    debate &&
    (Object.keys(debate).find(
      (k) => k.includes("bull") || k.includes("aggressive")
    ) ||
      "");
  const bearKey =
    debate &&
    (Object.keys(debate).find(
      (k) => k.includes("bear") || k.includes("conservative")
    ) ||
      "");
  const judgeKey =
    debate &&
    (Object.keys(debate).find((k) => k.includes("judge")) || "");

  const debateKeys = useMemo(
    () => [bullKey || "", bearKey || "", judgeKey || ""].filter(Boolean),
    [bullKey, bearKey, judgeKey]
  );

  const { showTranslated, isTranslating, toggle, getContent } =
    useDebateTranslation(debate, debateKeys, locale);

  if (!debate) return null;

  return (
    <TooltipProvider>
      <div
        className={cn(
          "bg-white dark:bg-card-dark border border-border-light dark:border-border-dark rounded-lg overflow-hidden transition-all duration-300 hover:border-primary/30 dark:hover:border-primary/20",
          className
        )}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border-light dark:border-border-dark bg-gray-50/50 dark:bg-white/[0.02]">
          <div className="w-6 h-6 rounded-md bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
            <Icon className="w-3.5 h-3.5 text-primary" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex-1">
            {title}
          </h3>
          <TranslateButton
            showTranslated={showTranslated}
            isTranslating={isTranslating}
            onToggle={toggle}
            t={t}
          />
        </div>
        <div className="divide-y divide-border-light dark:divide-border-dark">
          {bullKey && debate[bullKey] && (
            <div className="pl-4 py-4">
              <div className="flex items-center gap-1.5 mb-4">
                <TrendingUp className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-semibold text-primary">
                  {bullLabel}
                </span>
              </div>
              <div className="max-h-[300px] overflow-y-auto pr-4">
                <MarkdownBody content={getContent(bullKey) || ""} />
              </div>
            </div>
          )}
          {bearKey && debate[bearKey] && (
            <div className="pl-4 py-4">
              <div className="flex items-center gap-1.5 mb-4">
                <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                  {bearLabel}
                </span>
              </div>
              <div className="max-h-[300px] overflow-y-auto pr-4">
                <MarkdownBody content={getContent(bearKey) || ""} />
              </div>
            </div>
          )}
          {judgeKey && debate[judgeKey] && (
            <div className="pl-4 py-4 bg-gray-50/50 dark:bg-white/[0.02]">
              <div className="flex items-center gap-1.5 mb-4">
                <ShieldCheck className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  {judgeLabel}
                </span>
              </div>
              <div className="max-h-[300px] overflow-y-auto pr-4">
                <MarkdownBody content={getContent(judgeKey) || ""} />
              </div>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
