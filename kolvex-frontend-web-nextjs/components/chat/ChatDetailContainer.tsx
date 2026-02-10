"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ChatMessageList } from "./ChatMessageList";
import { ChatInput } from "./ChatInput";
import { useChatHistory } from "./useChatHistory";
import { useAvailableProviders } from "@/hooks/useAvailableProviders";
import { streamAgentMessage } from "@/lib/chatApi";
import type { AIModel, SearchSource, ToolStatus } from "./types";
import { TOOL_LABELS as toolLabels } from "./types";

// ===== localStorage helpers for persisting chat preferences =====
const PREFS_SOURCES_KEY = "kolvex:sources";
const PREFS_MODEL_KEY = "kolvex:model";

function loadSavedSources(conversationId: string): SearchSource[] | null {
  try {
    const raw = localStorage.getItem(`${PREFS_SOURCES_KEY}:${conversationId}`);
    if (raw) return JSON.parse(raw) as SearchSource[];
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
const DEFAULT_SOURCES: SearchSource[] = ["kol", "news", "web", "portfolio"];

export function ChatDetailContainer({
  className,
  conversationId,
  firstMessage,
  initialSources,
  initialModel,
  onConversationChange,
}: ChatDetailContainerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  // Resolve initial sources: URL params > localStorage > defaults
  const [activeSources, setActiveSources] = useState<SearchSource[]>(() => {
    if (initialSources) {
      const parsed = initialSources.split(",").filter(Boolean) as SearchSource[];
      if (parsed.length > 0) return parsed;
    }
    const saved = loadSavedSources(conversationId);
    if (saved && saved.length > 0) return saved;
    return DEFAULT_SOURCES;
  });

  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [pendingUserMessage, setPendingUserMessage] = useState("");

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
    addMessage,
    selectConversation,
    deleteConversation,
    refreshConversations,
  } = useChatHistory();

  // ---- Stream processing helper ----
  const processAgentStream = useCallback(
    async (response: Response) => {
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = "";
      let buffer = "";

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          const data = trimmed.slice(6);
          try {
            const event = JSON.parse(data);

            switch (event.type) {
              case "token":
                if (event.content) {
                  accumulatedContent += event.content;
                  setStreamingContent(accumulatedContent);
                }
                break;

              case "tool_start":
                if (event.tool) {
                  const label = toolLabels[event.tool] || event.tool;
                  setActiveTools((prev) => [
                    ...prev.filter((t) => t.name !== event.tool),
                    { name: event.tool, label, status: "running" },
                  ]);
                }
                break;

              case "tool_end":
                if (event.tool) {
                  setActiveTools((prev) =>
                    prev.map((t) =>
                      t.name === event.tool ? { ...t, status: "done" } : t
                    )
                  );
                }
                break;

              case "done":
                setStreamingContent("");
                setActiveTools([]);
                await refreshConversations();
                await selectConversation(conversationId);
                break;

              case "error":
                console.error("Agent error:", event.content);
                setStreamingContent("");
                setActiveTools([]);
                await refreshConversations();
                await selectConversation(conversationId);
                break;
            }
          } catch {
            // Ignore JSON parse errors for incomplete chunks
          }
        }
      }
    },
    [conversationId, refreshConversations, selectConversation]
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

    (async () => {
      try {
        const response = await streamAgentMessage(conversationId, firstMessage, {
          model: selectedModel,
          sources: activeSources,
        });
        setPendingUserMessage("");
        await processAgentStream(response);
      } catch (error) {
        console.error("First message error:", error);
        setPendingUserMessage("");
        await addMessage({
          role: "assistant",
          content:
            "Sorry, I couldn't process your request. The AI agent may be unavailable. Please try again later.",
        });
      } finally {
        setIsLoading(false);
        setStreamingContent("");
        setActiveTools([]);
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
  }, [selectConversation, deleteConversation]);

  const toggleSource = (source: SearchSource) => {
    setActiveSources((prev) => {
      if (prev.includes(source)) {
        if (prev.length === 1) return prev;
        return prev.filter((s) => s !== source);
      }
      return [...prev, source];
    });
  };

  // ---- Submit user message from input ----
  const handleSubmit = useCallback(
    async (messageText: string) => {
      if (!messageText.trim() || isLoading) return;

      const trimmedMessage = messageText.trim();
      setQuery("");
      setIsLoading(true);
      setStreamingContent("");
      setActiveTools([]);

      // Optimistic update: show user message immediately
      setPendingUserMessage(trimmedMessage);

      try {
        // Stream response from LangGraph Agent via backend
        // The /stream endpoint saves user message + generates AI response
        const response = await streamAgentMessage(
          conversationId,
          trimmedMessage,
          {
            model: selectedModel,
            sources: activeSources,
          }
        );

        // Clear pending user message once stream starts (backend saved it)
        setPendingUserMessage("");

        await processAgentStream(response);
      } catch (error) {
        console.error("Chat error:", error);
        setPendingUserMessage("");

        await addMessage({
          role: "assistant",
          content:
            "Sorry, I couldn't process your request. The AI agent may be unavailable. Please try again later.",
        });
      } finally {
        setIsLoading(false);
        setStreamingContent("");
        setActiveTools([]);
      }
    },
    [conversationId, isLoading, addMessage, processAgentStream, selectedModel, activeSources]
  );

  const handleFormSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    handleSubmit(query);
  };

  return (
    <div className={cn("flex h-full", className)}>
      <div className="flex-1 flex flex-col min-w-0 relative bg-background-light dark:bg-background-dark">
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
        />
        {/* Chat Input */}
        <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 dark:border-white/10 bg-white/80 dark:bg-background-dark/80 backdrop-blur-xl">
          <div className="max-w-4xl mx-auto p-4">
            <ChatInput
              value={query}
              onChange={setQuery}
              onSubmit={handleFormSubmit}
              isLoading={isLoading}
              isFocused={isFocused}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              inputRef={inputRef}
              placeholder="Ask about stocks, KOL opinions, market trends..."
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
