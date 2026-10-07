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
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  content: string | null | undefined;
  className?: string;
  locale: string;
  t: (key: string) => string;
  headerExtra?: React.ReactNode;
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
      <section className={cn("border-t border-border pt-4", className)}>
        <div className="flex flex-wrap items-center gap-2 pb-3">
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <h3 className="text-[17px] font-semibold text-foreground">
            {title}
          </h3>
          {headerExtra && (
            <div className="order-last flex w-full sm:order-none sm:w-auto sm:flex-1 sm:justify-end">{headerExtra}</div>
          )}
          {!headerExtra && <div className="flex-1" />}
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
        <div className="max-w-[72ch]">
          <MarkdownBody content={displayContent || ""} />
        </div>
      </section>
    </TooltipProvider>
  );
}
