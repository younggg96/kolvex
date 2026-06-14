"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import {
  AlertCircle,
  BarChart3,
  BookOpen,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  Globe,
  Loader2,
  Newspaper,
  RotateCcw,
  Search,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatBubble } from "./ChatBubble";
import type { ChatMessageListProps, ToolStatus } from "./types";
import { Button } from "../ui/button";
import { useTranslation } from "@/lib/i18n";

// Tool category icons
function getToolIcon(toolName: string) {
  if (toolName.includes("stock") || toolName.includes("quote") || toolName.includes("financials") || toolName.includes("history") || toolName.includes("company") || toolName.includes("analyst")) {
    return <BarChart3 className="w-3 h-3" />;
  }
  if (toolName.includes("news") || toolName.includes("trending")) {
    return <Newspaper className="w-3 h-3" />;
  }
  if (toolName.includes("kol") || toolName.includes("sentiment")) {
    return <Users className="w-3 h-3" />;
  }
  if (toolName.includes("portfolio") || toolName.includes("robinhood")) {
    return <Briefcase className="w-3 h-3" />;
  }
  if (toolName.includes("knowledge") || toolName.includes("superinvestor")) {
    return <BookOpen className="w-3 h-3" />;
  }
  if (toolName.includes("web_search")) {
    return <Globe className="w-3 h-3" />;
  }
  return <Search className="w-3 h-3" />;
}

/**
 * Compact agent activity indicator — shows thinking + tool calls in a
 * single inline block below the user's message, above the AI response.
 */
function AgentActivityIndicator({
  tools,
  isThinking,
  modelName,
  statusMessage,
}: {
  tools: ToolStatus[];
  isThinking: boolean;
  modelName?: string;
  statusMessage?: string;
}) {
  const { t } = useTranslation();
  if (!isThinking && tools.length === 0) return null;

  return (
    <div className="flex w-full justify-start animate-fade-in">
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

        {/* Compact status */}
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center gap-2 px-0.5">
            <span className="text-xs font-medium text-muted-foreground">
              {t("chat.assistantName")}
            </span>
            {modelName && (
              <span className="text-[10px] text-muted-foreground/50 font-medium px-1.5 py-0.5 rounded-full bg-muted/50 border border-border/50">
                {modelName}
              </span>
            )}
          </div>
          <div
            className={cn(
              "px-3.5 py-2.5 rounded-2xl rounded-tl-sm",
              "bg-card",
              "border border-border"
            )}
          >
            <div className="flex flex-col gap-1.5">
              {/* Tool items */}
              {tools.map((tool) => (
                <div
                  key={tool.name}
                  className="flex items-center gap-2 text-xs"
                >
                  {tool.status === "running" ? (
                    <Loader2 className="w-3 h-3 text-primary animate-spin flex-shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                  )}
                  <span
                    className={cn(
                      "flex items-center gap-1.5",
                      tool.status === "done"
                        ? "text-muted-foreground"
                        : "text-foreground"
                    )}
                  >
                    {getToolIcon(tool.name)}
                    {tool.label}
                  </span>
                </div>
              ))}

              {/* Current agent stage */}
              {isThinking && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <div className="flex gap-0.5">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="w-1 h-1 bg-primary/60 rounded-full"
                        style={{
                          animation: "pulse 1.4s ease-in-out infinite",
                          animationDelay: `${i * 0.2}s`,
                        }}
                      />
                    ))}
                  </div>
                  <span className="ml-0.5">
                    {statusMessage || t("chat.activity.working")}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ChatMessageList({
  messages,
  pendingUserMessage,
  streamingContent,
  isLoading = false,
  messagesEndRef,
  activeTools = [],
  agentStatus,
  errorMessage,
  onRetry,
  modelName,
}: ChatMessageListProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const isNearBottomRef = useRef(true);

  const actualEndRef = messagesEndRef || endRef;

  const scrollToBottom = useCallback(() => {
    actualEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [actualEndRef]);

  // Auto-scroll when anything changes
  useEffect(() => {
    if (
      messages.length > 0 ||
      streamingContent ||
      pendingUserMessage ||
      isLoading ||
      activeTools.length > 0
    ) {
      if (isNearBottomRef.current || pendingUserMessage) {
        scrollToBottom();
      }
    }
  }, [messages, streamingContent, pendingUserMessage, isLoading, activeTools, scrollToBottom]);

  // Check if we should show scroll button
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      isNearBottomRef.current = isNearBottom;
      setShowScrollButton(!isNearBottom && messages.length > 0);
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [messages.length]);

  if (
    messages.length === 0 &&
    !pendingUserMessage &&
    !streamingContent &&
    !isLoading &&
    !errorMessage &&
    activeTools.length === 0
  ) {
    return null;
  }

  // Determine if the agent is still "thinking" (loading but no streaming content yet)
  const showThinking = isLoading;
  const statusLabels: Record<string, string> = {
    routing: t("chat.activity.routing"),
    planning: t("chat.activity.planning"),
    writing: t("chat.activity.writing"),
  };
  const statusMessage = agentStatus
    ? statusLabels[agentStatus.stage] || agentStatus.message
    : undefined;

  return (
    <div ref={containerRef} className="relative flex-1 overflow-y-auto">
      <div className="mx-auto flex min-h-full max-w-4xl flex-col justify-end px-4 py-6 md:px-6">
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

          {/* Pending user message (optimistic update — always visible) */}
          {pendingUserMessage && (
            <ChatBubble
              role="user"
              content={pendingUserMessage}
              isFirst={messages.length === 0}
            />
          )}

          {/* Agent activity: tools + thinking indicator (compact, single block) */}
          {(activeTools.length > 0 || showThinking) && (
            <AgentActivityIndicator
              tools={activeTools}
              isThinking={showThinking}
              modelName={modelName}
              statusMessage={statusMessage}
            />
          )}

          {/* Streaming response */}
          {streamingContent && (
            <ChatBubble
              role="assistant"
              content={streamingContent}
              isStreaming={true}
              modelName={modelName}
            />
          )}

          {errorMessage && (
            <div className="flex w-full justify-start">
              <div className="ml-12 flex max-w-xl items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
                <div className="min-w-0">
                  <p className="font-medium text-foreground">
                    {t("chat.activity.interrupted")}
                  </p>
                  <p className="mt-1 text-muted-foreground">{errorMessage}</p>
                  {onRetry && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={onRetry}
                      className="mt-2 gap-1.5 px-0 text-primary hover:bg-transparent"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      {t("chat.actions.retry")}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Scroll anchor */}
        <div ref={actualEndRef} className="h-4" />
      </div>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <Button
          onClick={scrollToBottom}
          size="icon"
          variant="default"
          className={cn(
            "fixed bottom-40 left-1/2 -translate-x-1/2 z-20",
            "w-9 h-9 !rounded-full",
            "transition-all duration-200",
            "hover:scale-105 hover:shadow-xl",
            "animate-fade-in"
          )}
          aria-label="Scroll to bottom"
        >
          <ChevronDown className="w-4 h-4 text-background" />
        </Button>
      )}
    </div>
  );
}
