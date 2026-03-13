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
      <div
        className={cn(
          "bg-card border border-border rounded-lg overflow-hidden transition-all duration-300 hover:border-primary/30 dark:hover:border-primary/20",
          className
        )}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-gray-50/50 dark:bg-white/[0.02]">
          <div className="w-6 h-6 rounded-md bg-primary/10 dark:bg-primary/20 flex items-center justify-center shrink-0">
            <Icon className="w-3.5 h-3.5 text-primary" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">
            {title}
          </h3>
          {headerExtra && (
            <div className="flex-1 flex justify-end">{headerExtra}</div>
          )}
          {!headerExtra && <div className="flex-1" />}
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
        <div className="p-4 max-h-[500px] overflow-y-auto">
          <MarkdownBody content={displayContent || ""} />
        </div>
      </div>
    </TooltipProvider>
  );
}
