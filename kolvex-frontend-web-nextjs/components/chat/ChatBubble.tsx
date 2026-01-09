"use client";

import { cn } from "@/lib/utils";
import { Bot, User, Copy, Check, Sparkles } from "lucide-react";
import { useState } from "react";
import type { ChatBubbleProps } from "./types";

export function ChatBubble({
  role,
  content,
  isStreaming,
  timestamp,
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

  return (
    <div
      className={cn(
        "group flex w-full mb-6 animate-fade-in",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "flex gap-3 max-w-[85%] md:max-w-[75%]",
          isUser ? "flex-row-reverse" : "flex-row"
        )}
      >
        {/* Avatar */}
        <div className="flex-shrink-0 mt-1">
          <div
            className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center shadow-lg transition-transform duration-200 group-hover:scale-105",
              isUser
                ? "bg-gradient-to-br from-gray-700 to-gray-900 dark:from-gray-600 dark:to-gray-800"
                : "bg-gradient-to-br from-primary to-emerald-600 shadow-primary/25"
            )}
          >
            {isUser ? (
              <User className="w-4 h-4 text-white" />
            ) : (
              <Sparkles className="w-4 h-4 text-white" />
            )}
          </div>
        </div>

        {/* Message Content */}
        <div className={cn("flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
          {/* Name & Time */}
          <div
            className={cn(
              "flex items-center gap-2 px-1",
              isUser ? "flex-row-reverse" : "flex-row"
            )}
          >
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              {isUser ? "You" : "Kolvex AI"}
            </span>
            {timestamp && (
              <span className="text-[10px] text-gray-400 dark:text-gray-500">
                {formatTime(timestamp)}
              </span>
            )}
          </div>

          {/* Bubble */}
          <div
            className={cn(
              "relative px-4 py-3 rounded-2xl transition-all duration-200",
              isUser
                ? "bg-gray-900 dark:bg-white/95 text-white dark:text-gray-900 rounded-tr-md"
                : "bg-white dark:bg-card-dark border border-gray-100 dark:border-white/10 text-gray-800 dark:text-gray-200 rounded-tl-md shadow-sm"
            )}
          >
            {/* Decorative gradient for AI bubble */}
            {!isUser && (
              <div className="absolute inset-0 rounded-2xl rounded-tl-md bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
            )}

            <div className="relative">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {content}
                {isStreaming && (
                  <span className="inline-flex items-center ml-1">
                    <span className="w-1.5 h-4 bg-primary rounded-sm animate-pulse" />
                  </span>
                )}
              </p>
            </div>

            {/* Copy button for AI messages */}
            {!isUser && !isStreaming && content && (
              <button
                onClick={handleCopy}
                className={cn(
                  "absolute -bottom-7 left-0 flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all",
                  "opacity-0 group-hover:opacity-100",
                  "text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300",
                  "hover:bg-gray-100 dark:hover:bg-white/5"
                )}
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-primary" />
                    <span className="text-primary">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
