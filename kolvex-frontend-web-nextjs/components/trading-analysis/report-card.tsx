import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MarkdownBody } from "./markdown";
import { TranslateButton } from "./translate";
import { useContentTranslation } from "./hooks";

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

  if (!content) return null;
  return (
    <TooltipProvider>
      <div
        className={cn(
          "bg-white dark:bg-card-dark border border-border-light dark:border-border-dark rounded-lg overflow-hidden transition-all duration-300 hover:border-primary/30 dark:hover:border-primary/20",
          className
        )}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border-light dark:border-border-dark bg-gray-50/50 dark:bg-white/[0.02]">
          <div className="w-6 h-6 rounded-md bg-primary/10 dark:bg-primary/20 flex items-center justify-center shrink-0">
            <Icon className="w-3.5 h-3.5 text-primary" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {title}
          </h3>
          {headerExtra && (
            <div className="flex-1 flex justify-end">{headerExtra}</div>
          )}
          {!headerExtra && <div className="flex-1" />}
          <TranslateButton
            showTranslated={showTranslated}
            isTranslating={isTranslating}
            onToggle={toggle}
            t={t}
          />
        </div>
        <div className="p-4 max-h-[500px] overflow-y-auto">
          <MarkdownBody content={displayContent || ""} />
        </div>
      </div>
    </TooltipProvider>
  );
}
