"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ChatWelcome } from "./ChatWelcome";
import { useChatHistory } from "./useChatHistory";
import { useAvailableProviders } from "@/hooks/useAvailableProviders";
import { getFirstAvailableModelId } from "./ChatInput";
import { evidenceStorageKey } from "./pageEvidence";
import type { AIModel, ChatWelcomeProps, SearchSource } from "./types";

interface ChatWelcomeContainerProps {
  className?: string;
  variant?: ChatWelcomeProps["variant"];
  suggestions?: string[];
  placeholder?: string;
  decisionContext?: string;
  evidenceLabel?: string;
  onClearEvidence?: () => void;
  onSubmitted?: () => void;
  onConversationChange?: (
    conversation: {
      id: string;
      title: string;
    } | null
  ) => void;
}

export function ChatWelcomeContainer({
  className,
  variant,
  suggestions,
  placeholder,
  onConversationChange,
  decisionContext,
  evidenceLabel,
  onClearEvidence,
  onSubmitted,
}: ChatWelcomeContainerProps) {
  const router = useRouter();
  const [activeSources, setActiveSources] = useState<SearchSource[]>([
    "plaid",
    "portfolio",
    "web",
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const submittingRef = useRef(false);
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
      if (!messageText.trim() || submittingRef.current) return;

      const trimmedMessage = messageText.trim();
      submittingRef.current = true;
      setIsLoading(true);

      try {
        // Create a new conversation
        const conversationId = await createConversation();

        // Persist sources & model to localStorage for this conversation
        try {
          localStorage.setItem(`kolvex:sources:${conversationId}`, JSON.stringify(activeSources));
          localStorage.setItem(`kolvex:model:${conversationId}`, selectedModel);
          if (decisionContext) {
            localStorage.setItem(evidenceStorageKey(conversationId), decisionContext);
          }
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
        onSubmitted?.();
      } catch (error) {
        console.error("Failed to start chat:", error);
        toast.error("Unable to start a conversation. Please try again.");
        submittingRef.current = false;
        setIsLoading(false);
      }
    },
    [createConversation, router, activeSources, selectedModel, decisionContext, onSubmitted]
  );

  return (
    <div className={cn("flex h-full", className)}>
      <div className="flex-1 flex flex-col min-w-0 relative">

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
            variant={variant}
            suggestions={suggestions}
            placeholder={placeholder}
            evidenceLabel={evidenceLabel}
            onClearEvidence={onClearEvidence}
          />
        </div>
      </div>
    </div>
  );
}
