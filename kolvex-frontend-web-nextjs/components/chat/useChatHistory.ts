"use client";

import { useState, useCallback, useEffect } from "react";
import type { Message, ChatConversation, ChatHistoryItem } from "./types";

const STORAGE_KEY = "kolvex_chat_history";
const MAX_CONVERSATIONS = 50;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateTitle(firstMessage: string): string {
  // Truncate and clean up the first message for title
  const title = firstMessage.trim().slice(0, 50);
  return title.length < firstMessage.trim().length ? `${title}...` : title;
}

function loadFromStorage(): ChatConversation[] {
  if (typeof window === "undefined") return [];
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const data = JSON.parse(stored);
    return data.map((conv: ChatConversation) => ({
      ...conv,
      createdAt: new Date(conv.createdAt),
      updatedAt: new Date(conv.updatedAt),
      messages: conv.messages.map((msg) => ({
        ...msg,
        timestamp: msg.timestamp ? new Date(msg.timestamp) : undefined,
      })),
    }));
  } catch {
    return [];
  }
}

function saveToStorage(conversations: ChatConversation[]): void {
  if (typeof window === "undefined") return;
  
  try {
    // Limit stored conversations
    const limited = conversations.slice(0, MAX_CONVERSATIONS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(limited));
  } catch {
    // Storage full or unavailable, silently fail
  }
}

export function useChatHistory() {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from storage on mount
  useEffect(() => {
    const loaded = loadFromStorage();
    setConversations(loaded);
    setIsLoaded(true);
  }, []);

  // Save to storage when conversations change
  useEffect(() => {
    if (isLoaded && conversations.length > 0) {
      saveToStorage(conversations);
    }
  }, [conversations, isLoaded]);

  // Get current conversation
  const currentConversation = conversations.find(
    (c) => c.id === currentConversationId
  );

  // Get history items for sidebar
  const historyItems: ChatHistoryItem[] = conversations
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .map((conv) => ({
      id: conv.id,
      title: conv.title,
      preview:
        conv.messages[conv.messages.length - 1]?.content.slice(0, 100) || "",
      updatedAt: conv.updatedAt,
      messageCount: conv.messages.length,
    }));

  // Create new conversation
  const createConversation = useCallback((): string => {
    const newConversation: ChatConversation = {
      id: generateId(),
      title: "New Chat",
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setConversations((prev) => [newConversation, ...prev]);
    setCurrentConversationId(newConversation.id);
    return newConversation.id;
  }, []);

  // Add message to current or new conversation
  const addMessage = useCallback(
    (message: Omit<Message, "id" | "timestamp">): Message => {
      const newMessage: Message = {
        ...message,
        id: generateId(),
        timestamp: new Date(),
      };

      setConversations((prev) => {
        let targetId = currentConversationId;
        let updated = [...prev];

        // If no current conversation, create one
        if (!targetId) {
          const newConv: ChatConversation = {
            id: generateId(),
            title:
              message.role === "user"
                ? generateTitle(message.content)
                : "New Chat",
            messages: [newMessage],
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          targetId = newConv.id;
          setCurrentConversationId(targetId);
          // Broadcast new conversation created
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("kolvex:currentChatChanged", { detail: { id: targetId } })
            );
          }
          return [newConv, ...updated];
        }

        // Update existing conversation
        updated = prev.map((conv) => {
          if (conv.id === targetId) {
            const isFirstUserMessage =
              conv.messages.length === 0 && message.role === "user";
            return {
              ...conv,
              title: isFirstUserMessage
                ? generateTitle(message.content)
                : conv.title,
              messages: [...conv.messages, newMessage],
              updatedAt: new Date(),
            };
          }
          return conv;
        });

        return updated;
      });

      return newMessage;
    },
    [currentConversationId]
  );

  // Select a conversation
  const selectConversation = useCallback((id: string) => {
    setCurrentConversationId(id);
    // Broadcast current conversation change
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("kolvex:currentChatChanged", { detail: { id } })
      );
    }
  }, []);

  // Delete a conversation
  const deleteConversation = useCallback(
    (id: string) => {
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (currentConversationId === id) {
        setCurrentConversationId(null);
      }
    },
    [currentConversationId]
  );

  // Start new chat (clear current selection)
  const startNewChat = useCallback(() => {
    setCurrentConversationId(null);
    // Broadcast current conversation change
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("kolvex:currentChatChanged", { detail: { id: null } })
      );
    }
  }, []);

  // Clear all history
  const clearHistory = useCallback(() => {
    setConversations([]);
    setCurrentConversationId(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Get messages for current conversation
  const messages = currentConversation?.messages || [];

  return {
    conversations,
    historyItems,
    currentConversationId,
    currentConversation,
    messages,
    isLoaded,
    createConversation,
    addMessage,
    selectConversation,
    deleteConversation,
    startNewChat,
    clearHistory,
  };
}
