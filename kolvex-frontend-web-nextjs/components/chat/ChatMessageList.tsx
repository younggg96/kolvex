"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatBubble } from "./ChatBubble";
import type { ChatMessageListProps } from "./types";

// Loading indicator component
function ThinkingIndicator() {
  return (
    <div className="flex w-full mb-6 justify-start animate-fade-in">
      <div className="flex gap-3 max-w-[85%] md:max-w-[75%]">
        {/* Avatar */}
        <div className="flex-shrink-0 mt-1">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-emerald-600 shadow-lg shadow-primary/25 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
        </div>

        {/* Thinking bubble */}
        <div className="flex flex-col gap-1 items-start">
          <div className="flex items-center gap-2 px-1">
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              Kolvex AI
            </span>
          </div>
          
          <div className="relative px-4 py-3 rounded-2xl rounded-tl-md bg-white dark:bg-card-dark border border-gray-100 dark:border-white/10 shadow-sm">
            <div className="absolute inset-0 rounded-2xl rounded-tl-md bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
            <div className="relative flex items-center gap-2">
              <div className="flex gap-1">
                <span
                  className="w-2 h-2 bg-primary rounded-full animate-bounce"
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className="w-2 h-2 bg-primary rounded-full animate-bounce"
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className="w-2 h-2 bg-primary rounded-full animate-bounce"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Thinking...
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ChatMessageList({
  messages,
  streamingContent,
  isLoading = false,
  messagesEndRef,
}: ChatMessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const actualEndRef = messagesEndRef || endRef;

  const scrollToBottom = useCallback(() => {
    actualEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [actualEndRef]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (messages.length > 0 || streamingContent) {
      scrollToBottom();
    }
  }, [messages, streamingContent, scrollToBottom]);

  // Check if we should show scroll button
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isNearBottom && messages.length > 0);
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [messages.length]);

  if (messages.length === 0 && !streamingContent && !isLoading) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="relative flex-1 overflow-y-auto"
    >
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Messages */}
        {messages.map((message) => (
          <ChatBubble
            key={message.id}
            role={message.role}
            content={message.content}
            timestamp={message.timestamp}
          />
        ))}

        {/* Streaming response */}
        {streamingContent && (
          <ChatBubble
            role="assistant"
            content={streamingContent}
            isStreaming={true}
          />
        )}

        {/* Loading indicator */}
        {isLoading && !streamingContent && <ThinkingIndicator />}

        {/* Scroll anchor */}
        <div ref={actualEndRef} className="h-4" />
      </div>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <button
          onClick={scrollToBottom}
          className={cn(
            "fixed bottom-32 left-1/2 -translate-x-1/2",
            "p-2.5 rounded-full",
            "bg-white dark:bg-card-dark",
            "border border-gray-200 dark:border-white/10",
            "shadow-lg hover:shadow-xl",
            "transition-all duration-200",
            "animate-fade-in",
            "z-10",
            "group"
          )}
        >
          <ChevronDown className="w-5 h-5 text-gray-600 dark:text-gray-300 group-hover:text-primary transition-colors" />
        </button>
      )}
    </div>
  );
}
