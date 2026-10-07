import { useMemo, useState, useCallback } from "react";
import {
  TrendingUp,
  TrendingDown,
  ShieldCheck,
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
        "flex-1 min-w-0"
      )}
    >
      <div className="flex items-center gap-2 pb-2">
        <Icon
          className={cn(
            "w-3.5 h-3.5 shrink-0",
            isBull ? "text-positive" : "text-negative"
          )}
        />
        <span
          className={cn(
            "text-[13px] font-semibold",
            isBull ? "text-positive" : "text-negative"
          )}
        >
          {label}
        </span>
      </div>
      <div>
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
            className="mt-2 flex items-center gap-1 text-xs font-semibold text-foreground hover:underline"
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
          "border-t border-border pt-4",
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-2 pb-4">
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <h3 className="flex-1 text-[17px] font-semibold text-foreground">
            {title}
          </h3>
          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-positive" />
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
                  className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
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
                  className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
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
          <div>
            <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2">
              {hasBull && (
                <DebatePanel
                  label={bullLabel}
                  icon={TrendingUp}
                  content={getContent(bullKey!) || ""}
                  variant="bull"
                />
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
          <div className="mt-6">
            <div className="rounded-2xl bg-muted px-4 py-4">
              <div className="mb-2 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0 text-foreground" />
                <span className="text-[13px] font-semibold text-foreground">
                  {judgeLabel}
                </span>
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
                  className="mt-2 flex items-center gap-1 text-xs font-semibold text-foreground hover:underline"
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
