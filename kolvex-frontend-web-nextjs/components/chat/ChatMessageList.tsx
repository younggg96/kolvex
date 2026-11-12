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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatBubble } from "./ChatBubble";
import type { ChatMessageListProps, ToolStatus } from "./types";
import { Button } from "../ui/button";
import { useTranslation } from "@/lib/i18n";

const USER_SCROLL_THRESHOLD_PX = 12;

// Tool category icons
function getToolIcon(toolName: string) {
  if (toolName === "get_user_watchlist" || toolName.includes("stock") || toolName.includes("quote") || toolName.includes("financials") || toolName === "get_reported_revenue" || toolName.includes("history") || toolName.includes("company") || toolName.includes("analyst")) {
    return <BarChart3 className="w-3 h-3" />;
  }
  if (toolName === "get_daily_brief" || toolName.includes("news") || toolName.includes("trending")) {
    return <Newspaper className="w-3 h-3" />;
  }
  if (toolName.includes("portfolio") || toolName.includes("plaid")) {
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
    <div className="flex w-full justify-start animate-fade-in" aria-live="polite">
      <div className="w-full max-w-[45rem]">
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">
              {t("chat.assistantName")}
            </span>
            {modelName && <span>{modelName}</span>}
          </div>
          <div>
            <div className="flex flex-col gap-1.5">
              {/* Tool items */}
              {tools.map((tool) => (
                <div
                  key={tool.name}
                  className="flex items-center gap-2 text-xs"
                >
                  {tool.status === "running" ? (
                    <Loader2 className="w-3 h-3 text-muted-foreground animate-spin flex-shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-3 h-3 text-positive flex-shrink-0" />
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
                        className="h-1 w-1 rounded-full bg-foreground/60"
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
  );
}

export function ChatMessageList({
  messages,
  pendingUserMessage,
  streamingContent,
  streamingQuoteEvidence,
  streamingRevenueEvidence,
  isLoading = false,
  messagesEndRef,
  activeTools = [],
  agentStatus,
  errorMessage,
  onRetry,
  modelName,
  symbols,
  onUserScroll,
  composerCollapsed = false,
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

  // Reads the gesture rather than `scroll`, which also fires for streaming auto-follow.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !onUserScroll) return;

    const canScroll = () => container.scrollHeight > container.clientHeight;
    let touchStartY: number | null = null;
    const handleTouchStart = (event: TouchEvent) => {
      touchStartY = event.touches[0]?.clientY ?? null;
    };
    const handleTouchMove = (event: TouchEvent) => {
      const y = event.touches[0]?.clientY;
      if (touchStartY === null || y === undefined) return;
      if (Math.abs(y - touchStartY) > USER_SCROLL_THRESHOLD_PX && canScroll()) onUserScroll();
    };
    const handleWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) > 0 && canScroll()) onUserScroll();
    };

    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: true });
    container.addEventListener("wheel", handleWheel, { passive: true });
    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("wheel", handleWheel);
    };
  }, [messages.length, onUserScroll]);

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
      <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-end px-[16px] py-6 max-lg:pb-[calc(var(--chat-bottom-overlay)+1rem)] max-lg:pt-[calc(var(--chat-top-overlay)+1rem)] md:px-6">
        {/* Messages */}
        <div className="space-y-8">
          {messages.map((message, index) => (
            <ChatBubble
              key={message.id}
              role={message.role as "user" | "assistant"}
              content={message.content}
              quoteEvidence={message.quoteEvidence}
              revenueEvidence={message.revenueEvidence}
              answerCheck={message.answerCheck}
              timestamp={message.timestamp}
              isFirst={index === 0}
              symbols={symbols}
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
              quoteEvidence={streamingQuoteEvidence}
              revenueEvidence={streamingRevenueEvidence}
              isStreaming={true}
              modelName={modelName}
            />
          )}

          {errorMessage && (
            <div className="flex w-full justify-start">
              <div role="alert" className="flex max-w-xl items-start gap-3 rounded-3xl bg-negative/10 px-4 py-3 text-sm">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-negative" />
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
                      className="mt-2 gap-1.5 px-0 font-semibold text-foreground hover:bg-transparent hover:underline"
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
          variant="outline"
          className={cn(
            "fixed bottom-40 left-1/2 -translate-x-1/2 z-20 max-lg:[transition:bottom_var(--spring-standard)_var(--spring)]",
            // A collapsed composer frees its space, so the button drops level with the round one.
            composerCollapsed
              ? "max-lg:bottom-[calc(5.5rem+env(safe-area-inset-bottom)+24px-1.125rem)]"
              : "max-lg:bottom-[calc(var(--chat-bottom-overlay)+0.5rem)]",
            "w-9 h-9 !rounded-full bg-background surface-overlay",
            "animate-fade-in"
          )}
          aria-label="Scroll to bottom"
        >
          <ChevronDown className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}
