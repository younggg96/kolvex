"use client";

import { cn } from "@/lib/utils";
import { Copy, Check, RotateCcw } from "lucide-react";
import { useState } from "react";
import type { ChatBubbleProps } from "./types";

export function ChatBubble({
  role,
  content,
  isStreaming,
  timestamp,
  isFirst,
  onRetry,
}: ChatBubbleProps) {
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
        <div className="max-w-[85%] md:max-w-[70%]">
          <div className="flex items-center justify-end gap-2 mb-1.5 px-0.5">
            <span className="text-xs font-medium text-muted-foreground">
              You
            </span>
            {timestamp && (
              <span className="text-[11px] text-muted-foreground/60">
                {formatTime(timestamp)}
              </span>
            )}
          </div>
          <div
            className={cn(
              "px-4 py-3 rounded-2xl rounded-tr-sm",
              "bg-gray-900 dark:bg-white",
              "text-white dark:text-gray-900",
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
      <div className="flex gap-4 max-w-[85%] md:max-w-[80%]">
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
              Kolvex
            </span>
            {timestamp && (
              <span className="text-[11px] text-muted-foreground/60">
                {formatTime(timestamp)}
              </span>
            )}
          </div>

          {/* Bubble */}
          <div
            className={cn(
              "relative px-4 py-3 rounded-2xl rounded-tl-sm",
              "bg-card-light dark:bg-card-dark",
              "border border-border-light dark:border-border-dark",
              "text-foreground"
            )}
          >
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-[15px] leading-relaxed whitespace-pre-wrap m-0">
                {content}
                {isStreaming && (
                  <span className="inline-flex ml-0.5 align-middle">
                    <span className="w-[3px] h-[18px] bg-primary rounded-sm animate-pulse" />
                  </span>
                )}
              </p>
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
              <button
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
                    <span className="text-primary">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>

              {onRetry && (
                <button
                  onClick={onRetry}
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded-md",
                    "text-xs text-muted-foreground",
                    "hover:text-foreground hover:bg-muted",
                    "transition-colors duration-150"
                  )}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
