import { useState, useCallback } from "react";
import { Download, Copy, Check, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MarkdownBody } from "./markdown";
import { TranslateButton } from "./translate";
import { useContentTranslation } from "./hooks";
import { toast } from "sonner";

export function ReportCard({
  title,
  icon: Icon,
  content,
  className,
  locale,
  t,
  headerExtra,
  bordered = true,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  content: string | null | undefined;
  className?: string;
  locale: string;
  t: (key: string) => string;
  headerExtra?: React.ReactNode;
  bordered?: boolean;
}) {
  const { displayContent, showTranslated, isTranslating, toggle } =
    useContentTranslation(content, locale);

  const [copied, setCopied] = useState(false);

  const getText = useCallback(
    () => `# ${title}\n\n${displayContent || content || ""}`,
    [title, displayContent, content]
  );

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(getText()).then(() => {
      setCopied(true);
      toast.success(t("tradingAnalysis.debate.copied"));
      setTimeout(() => setCopied(false), 2000);
    });
  }, [getText, t]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([getText()], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/\s+/g, "_")}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [getText, title]);

  const handleShare = useCallback(async () => {
    const text = getText();
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
  }, [getText, title, t]);

  if (!content) return null;
  return (
    <TooltipProvider>
      <section className={cn("min-w-0", bordered && "border-t border-border pt-6", className)}>
        {headerExtra && <div className="mb-6 overflow-x-auto pb-1">{headerExtra}</div>}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <h2 className="flex w-full items-center gap-2 text-xl font-semibold text-foreground sm:w-auto">
            <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
            {title}
          </h2>
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
        <MarkdownBody content={displayContent || ""} />
      </section>
    </TooltipProvider>
  );
}
