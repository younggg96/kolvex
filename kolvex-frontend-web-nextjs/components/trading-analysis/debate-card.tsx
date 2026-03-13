import { useMemo, useState, useCallback } from "react";
import {
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Swords,
  ChevronDown,
  Download,
  Copy,
  Check,
  Share2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MarkdownBody } from "./markdown";
import { TranslateButton } from "./translate";
import { useDebateTranslation } from "./hooks";
import { toast } from "sonner";

function DebatePanel({
  label,
  icon: Icon,
  content,
  variant,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  content: string;
  variant: "bull" | "bear";
}) {
  const [expanded, setExpanded] = useState(false);
  const needsExpand = content.length > 600;
  const isBull = variant === "bull";

  return (
    <div
      className={cn(
        "flex-1 min-w-0 rounded-lg transition-all duration-300",
        isBull
          ? "border-primary/60 bg-primary/[0.03] dark:bg-primary/[0.04]"
          : "border-red-400/60 dark:border-red-500/40 bg-red-500/[0.03] dark:bg-red-500/[0.04]"
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <Icon
          className={cn(
            "w-3.5 h-3.5 shrink-0",
            isBull ? "text-primary" : "text-red-500"
          )}
        />
        <span
          className={cn(
            "text-xs font-semibold",
            isBull ? "text-primary" : "text-red-600 dark:text-red-400"
          )}
        >
          {label}
        </span>
      </div>
      <div className="px-3 pb-3">
        <div
          className={cn(
            "overflow-y-auto transition-all duration-300",
            expanded || !needsExpand ? "max-h-[400px]" : "max-h-[200px]"
          )}
        >
          <MarkdownBody content={content} />
        </div>
        {needsExpand && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-2 flex items-center gap-1 text-[11px] font-medium text-muted-foreground opacity-70 hover:opacity-100 transition-colors"
          >
            <ChevronDown
              className={cn(
                "w-3 h-3 transition-transform duration-200",
                expanded && "rotate-180"
              )}
            />
            {expanded ? "Collapse" : "Expand"}
          </button>
        )}
      </div>
    </div>
  );
}

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

  const [judgeExpanded, setJudgeExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const buildMarkdownText = useCallback(() => {
    if (!debate) return "";
    const sections: string[] = [`# ${title}\n`];
    if (bullKey && debate[bullKey]) {
      sections.push(`## ${bullLabel}\n\n${getContent(bullKey) || debate[bullKey]}\n`);
    }
    if (bearKey && debate[bearKey]) {
      sections.push(`## ${bearLabel}\n\n${getContent(bearKey) || debate[bearKey]}\n`);
    }
    if (judgeKey && debate[judgeKey]) {
      sections.push(`## ${judgeLabel}\n\n${getContent(judgeKey) || debate[judgeKey]}\n`);
    }
    return sections.join("\n");
  }, [debate, title, bullKey, bearKey, judgeKey, bullLabel, bearLabel, judgeLabel, getContent]);

  const handleCopy = useCallback(() => {
    const text = buildMarkdownText();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.success(t("tradingAnalysis.debate.copied"));
      setTimeout(() => setCopied(false), 2000);
    });
  }, [buildMarkdownText, t]);

  const handleDownload = useCallback(() => {
    const text = buildMarkdownText();
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/\s+/g, "_")}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [buildMarkdownText, title]);

  const handleShare = useCallback(async () => {
    const text = buildMarkdownText();
    if (navigator.share) {
      try {
        await navigator.share({ title, text });
      } catch (e: any) {
        if (e.name !== "AbortError") console.error("Share failed:", e);
      }
    } else {
      navigator.clipboard.writeText(text).then(() => {
        toast.success(t("tradingAnalysis.debate.copied"));
      });
    }
  }, [buildMarkdownText, title, t]);

  if (!debate) return null;

  const hasBull = bullKey && debate[bullKey];
  const hasBear = bearKey && debate[bearKey];
  const hasJudge = judgeKey && debate[judgeKey];
  const judgeContent = hasJudge ? getContent(judgeKey!) || "" : "";
  const judgeNeedsExpand = judgeContent.length > 600;

  return (
    <TooltipProvider>
      <div
        className={cn(
          "bg-card border border-border rounded-lg overflow-hidden transition-all duration-300 hover:border-primary/30 dark:hover:border-primary/20",
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-gray-50/50 dark:bg-white/[0.02]">
          <div className="w-6 h-6 rounded-md bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
            <Icon className="w-3.5 h-3.5 text-primary" />
          </div>
          <h3 className="text-sm font-semibold text-foreground flex-1">
            {title}
          </h3>
          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-primary" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-xs">
                  {copied
                    ? t("tradingAnalysis.debate.copied")
                    : t("tradingAnalysis.debate.copyAll")}
                </p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-xs">{t("tradingAnalysis.debate.download")}</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleShare}
                  className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-xs">{t("tradingAnalysis.debate.share")}</p>
              </TooltipContent>
            </Tooltip>

            <TranslateButton
              showTranslated={showTranslated}
              isTranslating={isTranslating}
              onToggle={toggle}
              t={t}
            />
          </div>
        </div>

        {/* Bull vs Bear */}
        {(hasBull || hasBear) && (
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-stretch">
              {hasBull && (
                <DebatePanel
                  label={bullLabel}
                  icon={TrendingUp}
                  content={getContent(bullKey!) || ""}
                  variant="bull"
                />
              )}

              {hasBull && hasBear && (
                <div className="hidden md:flex flex-col items-center justify-center py-4">
                  <div className="w-px flex-1 bg-border" />
                  <div className="my-2 w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 border border-border flex items-center justify-center">
                    <Swords className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                  </div>
                  <div className="w-px flex-1 bg-border" />
                </div>
              )}

              {hasBull && hasBear && (
                <div className="flex md:hidden items-center gap-2 py-1">
                  <div className="flex-1 h-px bg-border" />
                  <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 border border-border flex items-center justify-center">
                    <Swords className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                  </div>
                  <div className="flex-1 h-px bg-border" />
                </div>
              )}

              {hasBear && (
                <DebatePanel
                  label={bearLabel}
                  icon={TrendingDown}
                  content={getContent(bearKey!) || ""}
                  variant="bear"
                />
              )}
            </div>
          </div>
        )}

        {/* Judge Verdict */}
        {hasJudge && (
          <div className="border-t border-border">
            <div className="bg-gray-50/50 dark:bg-white/[0.02] px-4 py-4">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400 shrink-0" />
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  {judgeLabel}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div
                className={cn(
                  "overflow-y-auto transition-all duration-300",
                  judgeExpanded || !judgeNeedsExpand
                    ? "max-h-[400px]"
                    : "max-h-[200px]"
                )}
              >
                <MarkdownBody content={judgeContent} />
              </div>
              {judgeNeedsExpand && (
                <button
                  type="button"
                  onClick={() => setJudgeExpanded((v) => !v)}
                  className="mt-2 flex items-center gap-1 text-[11px] font-medium text-muted-foreground opacity-70 hover:opacity-100 transition-colors"
                >
                  <ChevronDown
                    className={cn(
                      "w-3 h-3 transition-transform duration-200",
                      judgeExpanded && "rotate-180"
                    )}
                  />
                  {judgeExpanded ? "Collapse" : "Expand"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
