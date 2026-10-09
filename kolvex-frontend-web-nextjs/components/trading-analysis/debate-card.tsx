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
  const isBull = variant === "bull";
  return (
    <details className="group min-w-0 border-t border-border py-4">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-sm text-base font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-details-marker]:hidden">
        <Icon className={cn("h-5 w-5 shrink-0", isBull ? "text-positive" : "text-negative")} />
        <span className="flex-1">{label}</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="pt-5"><MarkdownBody content={content} /></div>
    </details>
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

  return (
    <TooltipProvider>
      <div
        className={cn(
          "min-w-0 border-t border-border pt-6",
          className
        )}
      >
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <h3 className="w-full text-xl font-semibold text-foreground sm:w-auto sm:flex-1">
            {title}
          </h3>
          <div className="ml-auto flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleCopy}
                  aria-label={copied ? t("tradingAnalysis.debate.copied") : t("tradingAnalysis.debate.copyAll")}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
                  aria-label={t("tradingAnalysis.debate.download")}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
                  aria-label={t("tradingAnalysis.debate.share")}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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

        {/* Judge Verdict */}
        {hasJudge && (
          <div className="mb-6">
            <div className="rounded-xl bg-muted/60 p-5 md:p-6">
              <div className="mb-2 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0 text-foreground" />
                <span className="text-base font-semibold text-foreground">
                  {judgeLabel}
                </span>
              </div>
              <MarkdownBody content={judgeContent} />
            </div>
          </div>
        )}

        {/* Bull vs Bear */}
        {(hasBull || hasBear) && (
          <div>
            <div className="space-y-2">
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

      </div>
    </TooltipProvider>
  );
}
