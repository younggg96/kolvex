"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ChatWelcome } from "./ChatWelcome";
import { useChatHistory } from "./useChatHistory";
import { useAvailableProviders } from "@/hooks/useAvailableProviders";
import { getFirstAvailableModelId } from "./ChatInput";
import type { AIModel, SearchSource } from "./types";

interface ChatWelcomeContainerProps {
  className?: string;
  onConversationChange?: (
    conversation: {
      id: string;
      title: string;
    } | null
  ) => void;
}

export function ChatWelcomeContainer({
  className,
  onConversationChange,
}: ChatWelcomeContainerProps) {
  const router = useRouter();
  const [activeSources, setActiveSources] = useState<SearchSource[]>(["kol", "news", "web", "portfolio"]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<AIModel>("deepseek-chat");

  const { createConversation } = useChatHistory();
  const { availableProviders } = useAvailableProviders();

  // Default to first available model when API keys load
  useEffect(() => {
    const first = getFirstAvailableModelId(availableProviders);
    if (first) setSelectedModel(first);
  }, [availableProviders]);

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
      setIsLoading(true);

      try {
        // Create a new conversation
        const conversationId = await createConversation();

        // Persist sources & model to localStorage for this conversation
        try {
          localStorage.setItem(`kolvex:sources:${conversationId}`, JSON.stringify(activeSources));
          localStorage.setItem(`kolvex:model:${conversationId}`, selectedModel);
        } catch {}

        // Navigate to chat detail page with the first message + sources as query params
        // The ChatDetailContainer will pick this up and send it to the agent
        const params = new URLSearchParams();
        params.set("firstMessage", trimmedMessage);
        params.set("sources", activeSources.join(","));
        params.set("model", selectedModel);
        router.push(
          `/dashboard/chat/${conversationId}?${params.toString()}`
        );
      } catch (error) {
        console.error("Failed to start chat:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, createConversation, router, activeSources, selectedModel]
  );

  return (
    <div className={cn("flex h-full", className)}>
      <div className="flex-1 flex flex-col min-w-0 relative bg-background-light dark:bg-background-dark">
        {/* Background Grid */}
        <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />

        {/* Content Area */}
        <div className="relative flex-1 flex flex-col overflow-hidden">
          <ChatWelcome
            onSubmit={handleSubmit}
            isLoading={isLoading}
            activeSources={activeSources}
            onToggleSource={toggleSource}
            selectedModel={selectedModel}
            onSelectModel={setSelectedModel}
            availableProviders={availableProviders}
          />
        </div>
      </div>
    </div>
  );
}
