"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ChatMessageList } from "./ChatMessageList";
import { ChatInput } from "./ChatInput";
import { useChatHistory } from "./useChatHistory";
import type { AIModel, SearchSource } from "./types";
import { LoadingSpinner } from "../common";

interface ChatDetailContainerProps {
  className?: string;
  conversationId: string;
  onConversationChange?: (
    conversation: {
      id: string;
      title: string;
    } | null
  ) => void;
}

export function ChatDetailContainer({
  className,
  conversationId,
  onConversationChange,
}: ChatDetailContainerProps) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [activeSources, setActiveSources] = useState<SearchSource[]>(["kol"]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [pendingUserMessage, setPendingUserMessage] = useState("");
  const [selectedModel, setSelectedModel] = useState<AIModel>("gpt-4o-mini");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    currentConversationId,
    currentConversation,
    messages,
    addMessage,
    selectConversation,
    deleteConversation,
  } = useChatHistory();

  // Notify parent when conversation changes
  useEffect(() => {
    if (onConversationChange) {
      onConversationChange(
        currentConversation
          ? { id: currentConversation.id, title: currentConversation.title }
          : null
      );
    }
  }, [currentConversation, onConversationChange]);

  // Load conversation when ID changes
  useEffect(() => {
    if (conversationId && currentConversationId !== conversationId) {
      selectConversation(conversationId);
    }
  }, [conversationId, currentConversationId, selectConversation]);

  // Listen for sidebar events
  useEffect(() => {
    const handleSelectChat = (e: CustomEvent<{ id: string }>) => {
      selectConversation(e.detail.id);
      setStreamingContent("");
    };

    const handleDeleteChat = (e: CustomEvent<{ id: string }>) => {
      deleteConversation(e.detail.id);
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

  const handleSubmit = useCallback(
    async (messageText: string) => {
      if (!messageText.trim() || isLoading) return;

      const trimmedMessage = messageText.trim();
      setQuery("");
      setIsLoading(true);
      setStreamingContent("");

      // Optimistic update: show user message immediately
      setPendingUserMessage(trimmedMessage);

      // Build messages array for API
      const messagesForApi = [
        ...messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        { role: "user", content: trimmedMessage },
      ];

      try {
        // Add user message to history (don't await - let it happen in background)
        addMessage({
          role: "user",
          content: trimmedMessage,
        }).then(() => {
          // Clear pending message once it's saved
          setPendingUserMessage("");
        });

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: messagesForApi,
            stream: true,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to get response");
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let accumulatedContent = "";

        while (reader) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value);
          const lines = text.split("\n").filter((line) => line.trim());

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") {
                if (accumulatedContent) {
                  await addMessage({
                    role: "assistant",
                    content: accumulatedContent,
                  });
                  setStreamingContent("");
                }
              } else {
                try {
                  const json = JSON.parse(data);
                  if (json.content) {
                    accumulatedContent += json.content;
                    setStreamingContent(accumulatedContent);
                  }
                } catch {
                  // Ignore parse errors
                }
              }
            }
          }
        }
      } catch (error) {
        console.error("Chat error:", error);
        setPendingUserMessage("");
        await addMessage({
          role: "assistant",
          content:
            "Sorry, I couldn't process your request. Please make sure Ollama is running locally.\n\nStart command: `ollama serve`",
        });
      } finally {
        setIsLoading(false);
        setStreamingContent("");
      }
    },
    [messages, isLoading, addMessage]
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
              placeholder="Continue the conversation..."
              activeSources={activeSources}
              onToggleSource={toggleSource}
              showSourceToggle={true}
              showModelSelector={true}
              selectedModel={selectedModel}
              onSelectModel={(model) => {
                setSelectedModel(model);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
