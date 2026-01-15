"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ChatWelcome } from "./ChatWelcome";
import { useChatHistory } from "./useChatHistory";
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
  const [activeSources, setActiveSources] = useState<SearchSource[]>(["kol"]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<AIModel>("gpt-4o-mini");
  const pendingNavigationRef = useRef(false);

  const { addMessage } = useChatHistory();

  // Listen for new conversation creation and navigate
  useEffect(() => {
    const handleChatChanged = (e: CustomEvent<{ id: string | null }>) => {
      if (pendingNavigationRef.current && e.detail.id) {
        pendingNavigationRef.current = false;
        router.push(`/dashboard/chat/${e.detail.id}`);
      }
    };

    window.addEventListener(
      "kolvex:currentChatChanged",
      handleChatChanged as EventListener
    );

    return () => {
      window.removeEventListener(
        "kolvex:currentChatChanged",
        handleChatChanged as EventListener
      );
    };
  }, [router]);

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
      pendingNavigationRef.current = true;

      try {
        // Add user message - this will create a new conversation
        // and trigger kolvex:currentChatChanged event
        await addMessage({
          role: "user",
          content: trimmedMessage,
        });
      } catch (error) {
        console.error("Failed to start chat:", error);
        pendingNavigationRef.current = false;
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, addMessage]
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
          />
        </div>
      </div>
    </div>
  );
}
