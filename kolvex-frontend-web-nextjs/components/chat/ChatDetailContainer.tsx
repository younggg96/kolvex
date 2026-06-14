"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ChatMessageList } from "./ChatMessageList";
import { ChatInput, MODEL_CONFIGS } from "./ChatInput";
import { useChatHistory } from "./useChatHistory";
import { useAvailableProviders } from "@/hooks/useAvailableProviders";
import {
  readAgentStream,
  streamAgentMessage,
  type AgentStreamEvent,
} from "@/lib/chatApi";
import type {
  AgentStatus,
  AIModel,
  SearchSource,
  ToolStatus,
} from "./types";
import { TOOL_LABELS as toolLabels } from "./types";
import { useTranslation } from "@/lib/i18n";

// ===== localStorage helpers for persisting chat preferences =====
const PREFS_SOURCES_KEY = "kolvex:sources";
const PREFS_MODEL_KEY = "kolvex:model";
const AVAILABLE_SOURCES: SearchSource[] = [
  "robinhood",
  "portfolio",
  "news",
  "web",
];

function loadSavedSources(conversationId: string): SearchSource[] | null {
  try {
    const raw = localStorage.getItem(`${PREFS_SOURCES_KEY}:${conversationId}`);
    if (raw) {
      const parsed = JSON.parse(raw) as SearchSource[];
      return parsed.filter((source) => AVAILABLE_SOURCES.includes(source));
    }
  } catch {}
  return null;
}

function saveSources(conversationId: string, sources: SearchSource[]) {
  try {
    localStorage.setItem(`${PREFS_SOURCES_KEY}:${conversationId}`, JSON.stringify(sources));
  } catch {}
}

function loadSavedModel(conversationId: string): AIModel | null {
  try {
    const raw = localStorage.getItem(`${PREFS_MODEL_KEY}:${conversationId}`);
    if (raw) return raw as AIModel;
  } catch {}
  return null;
}

function saveModel(conversationId: string, model: AIModel) {
  try {
    localStorage.setItem(`${PREFS_MODEL_KEY}:${conversationId}`, model);
  } catch {}
}

// ===== Component =====

interface ChatDetailContainerProps {
  className?: string;
  conversationId: string;
  /** First message to auto-send (from welcome page navigation) */
  firstMessage?: string;
  /** Initial sources from welcome page (comma-separated in URL) */
  initialSources?: string;
  /** Initial model from welcome page */
  initialModel?: string;
  onConversationChange?: (
    conversation: {
      id: string;
      title: string;
    } | null
  ) => void;
}

/** Default sources when nothing is saved */
const DEFAULT_SOURCES: SearchSource[] = AVAILABLE_SOURCES;

export function ChatDetailContainer({
  className,
  conversationId,
  firstMessage,
  initialSources,
  initialModel,
  onConversationChange,
}: ChatDetailContainerProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  // Resolve initial sources: URL params > localStorage > defaults
  const [activeSources, setActiveSources] = useState<SearchSource[]>(() => {
    if (initialSources) {
      const parsed = initialSources
        .split(",")
        .filter((source): source is SearchSource =>
          AVAILABLE_SOURCES.includes(source as SearchSource)
        );
      if (parsed.length > 0) return parsed;
    }
    const saved = loadSavedSources(conversationId);
    if (saved && saved.length > 0) return saved;
    return DEFAULT_SOURCES;
  });

  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [pendingUserMessage, setPendingUserMessage] = useState("");
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [lastSubmittedMessage, setLastSubmittedMessage] = useState("");

  // Resolve initial model: URL params > localStorage > default
  const [selectedModel, setSelectedModel] = useState<AIModel>(() => {
    if (initialModel) return initialModel as AIModel;
    const saved = loadSavedModel(conversationId);
    if (saved) return saved;
    return "deepseek-chat";
  });
  const [activeTools, setActiveTools] = useState<ToolStatus[]>([]);
  const { availableProviders } = useAvailableProviders();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sentFirstMessageRef = useRef<string | null>(null);
  const isLoadingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Keep loading ref in sync
  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  // Persist sources & model to localStorage whenever they change
  useEffect(() => {
    saveSources(conversationId, activeSources);
  }, [conversationId, activeSources]);

  useEffect(() => {
    saveModel(conversationId, selectedModel);
  }, [conversationId, selectedModel]);

  const {
    currentConversationId,
    currentConversation,
    messages,
    selectConversation,
    deleteConversation,
  } = useChatHistory();

  // ---- Stream processing helper ----
  const processAgentStream = useCallback(
    async (response: Response) => {
      let accumulatedContent = "";
      let completed = false;

      await readAgentStream(response, (event: AgentStreamEvent) => {
        switch (event.type) {
          case "status":
            setAgentStatus({
              stage: event.stage || "working",
              message: event.content,
            });
            break;

          case "token":
            if (event.content) {
              accumulatedContent += event.content;
              setStreamingContent(accumulatedContent);
              setAgentStatus({ stage: "writing", message: event.content });
            }
            break;

          case "tool_start":
            if (event.tool) {
              const toolName = event.tool;
              const translationKey = `chat.tools.${toolName}`;
              const translatedLabel = t(translationKey);
              const label =
                translatedLabel === translationKey
                  ? toolLabels[toolName] || toolName
                  : translatedLabel;
              setActiveTools((prev) => [
                ...prev.filter((tool) => tool.name !== toolName),
                { name: toolName, label, status: "running" },
              ]);
            }
            break;

          case "tool_end":
            if (event.tool) {
              setActiveTools((prev) =>
                prev.map((tool) =>
                  tool.name === event.tool ? { ...tool, status: "done" } : tool
                )
              );
            }
            break;

          case "done":
            completed = true;
            break;

          case "error":
            throw new Error(event.content || "The AI agent could not complete the response.");
          }
      });

      if (!completed) {
        throw new Error("The response stream ended before completion.");
      }
    },
    [t]
  );

  // ---- Notify parent when conversation changes ----
  useEffect(() => {
    if (onConversationChange) {
      onConversationChange(
        currentConversation
          ? { id: currentConversation.id, title: currentConversation.title }
          : null
      );
    }
  }, [currentConversation, onConversationChange]);

  // ---- Load conversation when ID changes ----
  useEffect(() => {
    if (conversationId && currentConversationId !== conversationId) {
      selectConversation(conversationId).catch(() => {
        // Conversation not found (deleted or invalid) — redirect to new chat
        router.replace("/dashboard/chat");
      });
    }
  }, [conversationId, currentConversationId, selectConversation, router]);

  useEffect(() => {
    return () => abortControllerRef.current?.abort();
  }, [conversationId]);

  // ---- Auto-send first message from welcome page ----
  // Guard: use the actual firstMessage+conversationId combo as the dedup key
  // so React strict mode double-runs won't cause duplicate sends
  useEffect(() => {
    if (!firstMessage || isLoadingRef.current) return;

    const dedupKey = `${conversationId}:${firstMessage}`;
    if (sentFirstMessageRef.current === dedupKey) return;
    sentFirstMessageRef.current = dedupKey;

    // Clean up URL — remove ?firstMessage= to prevent re-trigger on refresh
    if (pathname) {
      window.history.replaceState(null, "", pathname);
    }

    // Show the user message optimistically and send to agent
    setPendingUserMessage(firstMessage);
    setIsLoading(true);
    setStreamingContent("");
    setActiveTools([]);
    setAgentStatus({ stage: "routing" });
    setStreamError(null);
    setLastSubmittedMessage(firstMessage);

    (async () => {
      const controller = new AbortController();
      abortControllerRef.current = controller;
      try {
        const response = await streamAgentMessage(
          conversationId,
          firstMessage,
          {
            model: selectedModel,
            sources: activeSources,
          },
          controller.signal
        );
        await processAgentStream(response);
        await selectConversation(conversationId);
      } catch (error) {
        console.error("First message error:", error);
        const aborted = error instanceof DOMException && error.name === "AbortError";
        setStreamError(
          aborted
            ? "Generation was stopped."
            : error instanceof Error
              ? error.message
              : "The AI agent may be unavailable. Please try again."
        );
        await selectConversation(conversationId).catch(() => undefined);
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
        setIsLoading(false);
        setPendingUserMessage("");
        setStreamingContent("");
        setActiveTools([]);
        setAgentStatus(null);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstMessage, conversationId]);

  // ---- Sidebar events ----
  useEffect(() => {
    const handleSelectChat = (e: CustomEvent<{ id: string }>) => {
      selectConversation(e.detail.id);
      setStreamingContent("");
      setActiveTools([]);
      setAgentStatus(null);
      setStreamError(null);
    };

    const handleDeleteChat = (e: CustomEvent<{ id: string }>) => {
      deleteConversation(e.detail.id);
      // If the deleted chat is the current one, navigate to new chat
      if (e.detail.id === conversationId) {
        router.replace("/dashboard/chat");
      }
    };

    window.addEventListener(
      "kolvex:selectChat",
      handleSelectChat as EventListener
    );
    window.addEventListener(
      "kolvex:deleteChat",
      handleDeleteChat as EventListener
    );

    return () => {
      window.removeEventListener(
        "kolvex:selectChat",
        handleSelectChat as EventListener
      );
      window.removeEventListener(
        "kolvex:deleteChat",
        handleDeleteChat as EventListener
      );
    };
  }, [conversationId, deleteConversation, router, selectConversation]);

  const toggleSource = (source: SearchSource) => {
    setActiveSources((prev) => {
      if (prev.includes(source)) {
        if (prev.length === 1) return prev;
        return prev.filter((s) => s !== source);
      }
      return [...prev, source];
    });
  };

  // Whether the user has any usable model
  const isBlocked =
    availableProviders !== undefined && availableProviders.length === 0;

  // ---- Submit user message from input ----
  const handleSubmit = useCallback(
    async (messageText: string) => {
      if (!messageText.trim() || isLoading || isBlocked) return;

      const trimmedMessage = messageText.trim();
      setQuery("");
      setIsLoading(true);
      setStreamingContent("");
      setActiveTools([]);
      setAgentStatus({ stage: "routing" });
      setStreamError(null);
      setLastSubmittedMessage(trimmedMessage);

      // Optimistic update: show user message immediately
      setPendingUserMessage(trimmedMessage);

      const controller = new AbortController();
      abortControllerRef.current = controller;
      try {
        // Stream response from LangGraph Agent via backend
        // The /stream endpoint saves user message + generates AI response
        const response = await streamAgentMessage(
          conversationId,
          trimmedMessage,
          {
            model: selectedModel,
            sources: activeSources,
          },
          controller.signal
        );

        await processAgentStream(response);
        await selectConversation(conversationId);
      } catch (error) {
        console.error("Chat error:", error);
        const aborted = error instanceof DOMException && error.name === "AbortError";
        setStreamError(
          aborted
            ? "Generation was stopped."
            : error instanceof Error
              ? error.message
              : "The AI agent may be unavailable. Please try again."
        );
        await selectConversation(conversationId).catch(() => undefined);
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
        setIsLoading(false);
        setPendingUserMessage("");
        setStreamingContent("");
        setActiveTools([]);
        setAgentStatus(null);
      }
    },
    [conversationId, isLoading, isBlocked, processAgentStream, selectConversation, selectedModel, activeSources]
  );

  const handleCancel = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const handleRetry = useCallback(() => {
    if (lastSubmittedMessage && !isLoading) {
      handleSubmit(lastSubmittedMessage);
    }
  }, [handleSubmit, isLoading, lastSubmittedMessage]);

  const handleFormSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isBlocked) return;
    handleSubmit(query);
  };

  return (
    <div className={cn("flex h-full", className)}>
      <div className="flex-1 flex flex-col min-w-0 relative bg-background">
        {/* Background Grid */}
        <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />

        {/* Content Area */}
        <ChatMessageList
          messages={messages}
          pendingUserMessage={pendingUserMessage}
          streamingContent={streamingContent}
          isLoading={isLoading}
          messagesEndRef={messagesEndRef}
          activeTools={activeTools}
          agentStatus={agentStatus}
          errorMessage={streamError}
          onRetry={streamError ? handleRetry : undefined}
          modelName={MODEL_CONFIGS.find((m) => m.id === selectedModel)?.name}
        />
        {/* Chat Input */}
        <div className="sticky bottom-0 z-20 border-t border-border bg-background/90 backdrop-blur-xl">
          <div className="max-w-4xl mx-auto p-4">
            <ChatInput
              value={query}
              onChange={setQuery}
              onSubmit={handleFormSubmit}
              onCancel={handleCancel}
              isLoading={isLoading}
              isFocused={isFocused}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              inputRef={inputRef}
              placeholder={t("chat.input.placeholder")}
              activeSources={activeSources}
              onToggleSource={toggleSource}
              showSourceToggle={true}
              showModelSelector={true}
              selectedModel={selectedModel}
              onSelectModel={(model) => setSelectedModel(model)}
              availableProviders={availableProviders}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
