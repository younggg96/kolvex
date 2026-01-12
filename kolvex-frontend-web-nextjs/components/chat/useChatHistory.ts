"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { Message, ChatConversation, ChatHistoryItem } from "./types";
import * as chatApi from "@/lib/chatApi";

function generateTitle(firstMessage: string): string {
  const title = firstMessage.trim().slice(0, 50);
  return title.length < firstMessage.trim().length ? `${title}...` : title;
}

// Convert API response to local format
function convertApiConversation(
  apiConv: chatApi.ChatConversation
): ChatConversation {
  return {
    id: apiConv.id,
    title: apiConv.title,
    messages: apiConv.messages.map((msg) => ({
      id: msg.id,
      role: msg.role as "user" | "assistant" | "system",
      content: msg.content,
      timestamp: new Date(msg.created_at),
    })),
    createdAt: new Date(apiConv.created_at),
    updatedAt: new Date(apiConv.updated_at),
  };
}

export function useChatHistory() {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<
    string | null
  >(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialLoadDone = useRef(false);

  // Use ref to track current conversation ID to avoid closure issues
  const currentConversationIdRef = useRef<string | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    currentConversationIdRef.current = currentConversationId;
  }, [currentConversationId]);

  // Load conversations from API
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    const loadConversations = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await chatApi.getConversations();
        const apiConversations = response.conversations.map(
          convertApiConversation
        );
        setConversations(apiConversations);
      } catch (err) {
        console.error("Failed to load conversations:", err);
        setError("Failed to load chat history");
      } finally {
        setIsLoading(false);
        setIsLoaded(true);
      }
    };

    loadConversations();
  }, []);

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
  const createConversation = useCallback(async (): Promise<string> => {
    try {
      const newConv = await chatApi.createConversation();
      const converted = convertApiConversation(newConv);
      setConversations((prev) => [converted, ...prev]);
      setCurrentConversationId(converted.id);
      currentConversationIdRef.current = converted.id;

      // Broadcast change
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("kolvex:currentChatChanged", {
            detail: { id: converted.id },
          })
        );
      }

      return converted.id;
    } catch (err) {
      console.error("Failed to create conversation:", err);
      throw err;
    }
  }, []);

  // Add message to current or new conversation
  // Use ref to avoid closure issues when multiple addMessage calls happen in sequence
  const addMessage = useCallback(
    async (message: Omit<Message, "id" | "timestamp">): Promise<Message> => {
      try {
        // Use ref to get the latest conversation ID (avoids closure issues)
        let targetId = currentConversationIdRef.current;

        // If no current conversation, create one
        if (!targetId) {
          const newConv = await chatApi.createConversation(
            message.role === "user"
              ? generateTitle(message.content)
              : "New Chat"
          );
          targetId = newConv.id;
          const converted = convertApiConversation(newConv);
          setConversations((prev) => [converted, ...prev]);

          // Update both state and ref immediately
          setCurrentConversationId(targetId);
          currentConversationIdRef.current = targetId;

          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("kolvex:currentChatChanged", {
                detail: { id: targetId },
              })
            );
          }
        }

        // Add message to server
        const newMessage = await chatApi.addMessage(
          targetId,
          message.role as "user" | "assistant" | "system",
          message.content
        );

        const convertedMessage: Message = {
          id: newMessage.id,
          role: newMessage.role as "user" | "assistant" | "system",
          content: newMessage.content,
          timestamp: new Date(newMessage.created_at),
        };

        // Update local state
        setConversations((prev) =>
          prev.map((conv) => {
            if (conv.id === targetId) {
              return {
                ...conv,
                messages: [...conv.messages, convertedMessage],
                updatedAt: new Date(),
              };
            }
            return conv;
          })
        );

        // Notify sidebar to refresh
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("kolvex:conversationUpdated"));
        }

        return convertedMessage;
      } catch (err) {
        console.error("Failed to add message:", err);
        throw err;
      }
    },
    [] // No dependencies needed since we use ref
  );

  // Select a conversation
  const selectConversation = useCallback(async (id: string) => {
    setCurrentConversationId(id);
    currentConversationIdRef.current = id;

    try {
      // Fetch full conversation with messages
      const conv = await chatApi.getConversation(id);
      const converted = convertApiConversation(conv);

      setConversations((prev) => {
        const exists = prev.some((c) => c.id === id);
        if (exists) {
          // Update existing conversation with full messages
          return prev.map((c) => (c.id === id ? converted : c));
        } else {
          // Add new conversation if not in list
          return [converted, ...prev];
        }
      });
    } catch (err) {
      console.error("Failed to fetch conversation:", err);
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("kolvex:currentChatChanged", { detail: { id } })
      );
    }
  }, []);

  // Delete a conversation
  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        await chatApi.deleteConversation(id);
      } catch (err) {
        console.error("Failed to delete conversation:", err);
      }

      setConversations((prev) => prev.filter((c) => c.id !== id));

      if (currentConversationIdRef.current === id) {
        setCurrentConversationId(null);
        currentConversationIdRef.current = null;

        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("kolvex:currentChatChanged", {
              detail: { id: null },
            })
          );
        }
      }
    },
    [] // Use ref instead of state dependency
  );

  // Start new chat (clear current selection)
  const startNewChat = useCallback(() => {
    setCurrentConversationId(null);
    currentConversationIdRef.current = null;

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("kolvex:currentChatChanged", { detail: { id: null } })
      );
    }
  }, []);

  // Clear all history
  const clearHistory = useCallback(async () => {
    try {
      await chatApi.deleteAllConversations();
    } catch (err) {
      console.error("Failed to delete all conversations:", err);
    }

    setConversations([]);
    setCurrentConversationId(null);
    currentConversationIdRef.current = null;
  }, []);

  // Refresh conversations from server
  const refreshConversations = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await chatApi.getConversations();
      const apiConversations = response.conversations.map(
        convertApiConversation
      );
      setConversations(apiConversations);
    } catch (err) {
      console.error("Failed to refresh conversations:", err);
    } finally {
      setIsLoading(false);
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
    isLoading,
    error,
    createConversation,
    addMessage,
    selectConversation,
    deleteConversation,
    startNewChat,
    clearHistory,
    refreshConversations,
  };
}
