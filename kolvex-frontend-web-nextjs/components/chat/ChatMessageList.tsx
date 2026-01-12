"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatBubble } from "./ChatBubble";
import type { ChatMessageListProps } from "./types";

// Modern thinking indicator with subtle pulse
function ThinkingIndicator() {
  return (
    <div className="flex w-full mb-6 justify-start animate-fade-in">
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

        {/* Thinking bubble */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground px-0.5">
            Kolvex
          </span>
          <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark">
            <div className="flex items-center gap-1.5">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 bg-primary/60 rounded-full"
                    style={{
                      animation: "pulse 1.4s ease-in-out infinite",
                      animationDelay: `${i * 0.2}s`,
                    }}
                  />
                ))}
              </div>
              <span className="text-sm text-muted-foreground ml-1">
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
    <div ref={containerRef} className="relative flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-8">
        {/* Messages */}
        <div className="space-y-6">
          {messages.map((message, index) => (
            <ChatBubble
              key={message.id}
              role={message.role as "user" | "assistant"}
              content={message.content}
              timestamp={message.timestamp}
              isFirst={index === 0}
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
        </div>

        {/* Scroll anchor */}
        <div ref={actualEndRef} className="h-4" />
      </div>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <button
          onClick={scrollToBottom}
          className={cn(
            "fixed bottom-28 left-1/2 -translate-x-1/2 z-20",
            "w-9 h-9 rounded-full",
            "bg-card-light dark:bg-card-dark",
            "border border-border-light dark:border-border-dark",
            "shadow-lg",
            "flex items-center justify-center",
            "transition-all duration-200",
            "hover:scale-105 hover:shadow-xl",
            "hover:border-primary/30",
            "animate-fade-in"
          )}
          aria-label="Scroll to bottom"
        >
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}
