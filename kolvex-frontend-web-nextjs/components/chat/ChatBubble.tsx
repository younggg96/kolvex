"use client";

import { cn } from "@/lib/utils";
import { Copy, Check, RotateCcw } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatBubbleProps } from "./types";
import { Button } from "../ui/button";
import { useTranslation } from "@/lib/i18n";

export function ChatBubble({
  role,
  content,
  isStreaming,
  timestamp,
  isFirst,
  onRetry,
  modelName,
}: ChatBubbleProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const isUser = role === "user";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTime = (date?: Date) => {
    if (!date) return "";
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  };

  if (isUser) {
    return (
      <div className="flex w-full justify-end animate-fade-in">
        <div className="max-w-[88%] md:max-w-[70%]">
          <div
            className="rounded-[22px] bg-muted px-4 py-2.5 text-foreground"
            aria-label={t("chat.userName")}
          >
            <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
              {content}
            </p>
          </div>
          {timestamp && (
            <p className="mt-1 px-1 text-right text-[11px] text-muted-foreground">
              {formatTime(timestamp)}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="group flex w-full justify-start animate-fade-in">
      <div className="w-full min-w-0 max-w-[720px]">
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">
              {t("chat.assistantName")}
            </span>
            {modelName && <span>{modelName}</span>}
            {timestamp && <span>{formatTime(timestamp)}</span>}
          </div>

          <div className="text-foreground">
            <div
              className={cn(
                "prose prose-sm dark:prose-invert max-w-none prose-a:text-positive",
                "break-words prose-headings:mt-4 prose-headings:mb-2 prose-headings:font-semibold",
                "prose-h1:text-xl prose-h1:leading-tight",
                "prose-h2:text-base prose-h3:text-sm",
                "prose-p:my-2 prose-p:leading-7 prose-p:text-[15px]",
                "prose-ul:my-2 prose-ul:pl-4 prose-li:my-0.5 prose-li:text-[15px]",
                "prose-ol:my-1.5 prose-ol:pl-4",
                "prose-strong:text-foreground prose-strong:font-semibold",
                "prose-code:text-xs prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded",
                "prose-pre:bg-muted prose-pre:text-foreground prose-pre:rounded-xl prose-pre:text-xs",
                "prose-table:block prose-table:max-w-full prose-table:overflow-x-auto prose-table:text-xs prose-th:px-2 prose-th:py-1 prose-td:px-2 prose-td:py-1",
                "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
              )}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
              {isStreaming && (
                <span className="inline-flex ml-0.5 align-middle">
                  <span className="h-[18px] w-[3px] animate-pulse rounded-sm bg-foreground" />
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          {!isStreaming && content && (
            <div
              className={cn(
                "flex items-center gap-1 mt-2 px-0.5",
                "opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity duration-150"
              )}
            >
              <Button
                variant="ghost"
                size="xs"
                onClick={handleCopy}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-2.5 py-1",
                  "text-xs text-muted-foreground",
                  "hover:text-foreground hover:bg-muted",
                  "transition-colors duration-150"
                )}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-positive" />
                    <span className="text-positive">{t("chat.actions.copied")}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>{t("chat.actions.copy")}</span>
                  </>
                )}
              </Button>

              {onRetry && (
                <Button variant="ghost" size="xs" onClick={onRetry}>
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{t("chat.actions.retry")}</span>
                </Button>
              )}
            </div>
          )}
      </div>
    </div>
  );
}
