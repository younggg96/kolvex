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
          <div className="flex items-center justify-end gap-2 mb-1.5 px-0.5">
            <span className="text-xs font-medium text-muted-foreground">
              {t("chat.userName")}
            </span>
            {timestamp && (
              <span className="text-[11px] text-muted-foreground/60">
                {formatTime(timestamp)}
              </span>
            )}
          </div>
          <div
            className={cn(
              "px-4 py-3 rounded-lg rounded-tr-sm",
              "bg-gray-900 dark:bg-primary/70",
              "text-white dark:text-primary-foreground",
              "shadow-sm"
            )}
          >
            <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
              {content}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="group flex w-full justify-start animate-fade-in">
      <div className="flex w-full gap-3 md:gap-4 max-w-[96%] md:max-w-[90%]">
        {/* AI Avatar */}
        <div className="flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center ring-2 ring-primary/20">
            <svg
              viewBox="0 0 24 24"
              className="w-4 h-4 text-primary"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" />
              <circle cx="12" cy="12" r="4" />
            </svg>
          </div>
        </div>

        {/* Message Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1.5 px-0.5">
            <span className="text-xs font-medium text-muted-foreground">
              {t("chat.assistantName")}
            </span>
            {modelName && (
              <span className="text-[10px] text-muted-foreground/50 font-medium px-1.5 py-0.5 rounded-full bg-muted/50 border border-border/50">
                {modelName}
              </span>
            )}
            {timestamp && (
              <span className="text-[11px] text-muted-foreground/60">
                {formatTime(timestamp)}
              </span>
            )}
          </div>

          {/* Bubble */}
          <div
            className={cn(
              "relative px-4 py-3 rounded-lg rounded-tl-sm",
              "bg-card",
              "border border-border",
              "text-foreground"
            )}
          >
            <div
              className={cn(
                "prose prose-sm dark:prose-invert max-w-none",
                "break-words prose-headings:mt-4 prose-headings:mb-2 prose-headings:font-semibold",
                "prose-h1:text-xl prose-h1:leading-tight",
                "prose-h2:text-base prose-h3:text-sm",
                "prose-p:my-1.5 prose-p:leading-relaxed prose-p:text-[14px]",
                "prose-ul:my-1.5 prose-ul:pl-4 prose-li:my-0.5 prose-li:text-[14px]",
                "prose-ol:my-1.5 prose-ol:pl-4",
                "prose-strong:text-foreground prose-strong:font-semibold",
                "prose-code:text-xs prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded",
                "prose-pre:bg-muted prose-pre:rounded-lg prose-pre:text-xs",
                "prose-table:block prose-table:max-w-full prose-table:overflow-x-auto prose-table:text-xs prose-th:px-2 prose-th:py-1 prose-td:px-2 prose-td:py-1",
                "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
              )}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
              {isStreaming && (
                <span className="inline-flex ml-0.5 align-middle">
                  <span className="w-[3px] h-[18px] bg-primary rounded-sm animate-pulse" />
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          {!isStreaming && content && (
            <div
              className={cn(
                "flex items-center gap-1 mt-2 px-0.5",
                "opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              )}
            >
              <Button
                variant="ghost"
                size="xs"
                onClick={handleCopy}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-md",
                  "text-xs text-muted-foreground",
                  "hover:text-foreground hover:bg-muted",
                  "transition-colors duration-150"
                )}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-primary" />
                    <span className="text-primary">{t("chat.actions.copied")}</span>
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
    </div>
  );
}
