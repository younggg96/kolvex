/**
 * Hooks for chat/AI data fetching
 */
import { useState, useCallback } from 'react';
import { useApi } from './useApi';
import { chatApi } from '@/lib/api';
import type { Conversation, ChatMessage, ConversationsResponse, MessagesResponse, SendMessageResponse } from '@/lib/types';

/** Fetch conversations list */
export function useConversations() {
  const fetcher = useCallback(() => chatApi.getConversations(), []);
  return useApi<ConversationsResponse>(fetcher);
}

/** Fetch messages for a conversation */
export function useConversationMessages(conversationId: string | null) {
  const fetcher = useCallback(
    () => {
      if (!conversationId) return Promise.resolve({ messages: [], total: 0 } as MessagesResponse);
      return chatApi.getMessages(conversationId);
    },
    [conversationId]
  );
  return useApi<MessagesResponse>(fetcher, { deps: [conversationId] });
}

/** Hook for managing chat state */
export function useChatSession() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createConversation = useCallback(async (title?: string) => {
    try {
      const conv = await chatApi.createConversation(title);
      setConversationId(conv.id);
      setMessages([]);
      return conv;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create conversation');
      return null;
    }
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!conversationId || sending) return null;

    setSending(true);
    setError(null);

    // Optimistically add user message
    const tempUserMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      conversation_id: conversationId,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const result = await chatApi.sendMessage(conversationId, content);
      // Replace temp message with real ones
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== tempUserMsg.id);
        return [...filtered, result.message, result.response];
      });
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempUserMsg.id));
      return null;
    } finally {
      setSending(false);
    }
  }, [conversationId, sending]);

  const loadConversation = useCallback(async (convId: string) => {
    setConversationId(convId);
    try {
      const result = await chatApi.getMessages(convId);
      setMessages(result.messages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages');
    }
  }, []);

  const resetChat = useCallback(() => {
    setConversationId(null);
    setMessages([]);
    setError(null);
  }, []);

  return {
    conversationId,
    messages,
    sending,
    error,
    createConversation,
    sendMessage,
    loadConversation,
    resetChat,
  };
}
