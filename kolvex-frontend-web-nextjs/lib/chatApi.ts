/**
 * Chat History API Module
 * Client-side API calls for chat history functionality
 */

const API_PREFIX = "/api/chat-history";

// ===== Types =====

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}

export interface ChatConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
}

export interface ConversationsListResponse {
  conversations: ChatConversation[];
  total: number;
  page: number;
  page_size: number;
}

export interface SuccessResponse {
  message: string;
  success: boolean;
}

// ===== API Request Helper =====

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_PREFIX}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Request failed: ${response.status}`);
  }

  return response.json();
}

// ===== Conversation Operations =====

/**
 * Get all conversations
 * @param page Page number
 * @param pageSize Number of items per page
 */
export async function getConversations(
  page: number = 1,
  pageSize: number = 50
): Promise<ConversationsListResponse> {
  return apiRequest<ConversationsListResponse>(
    `/conversations?page=${page}&page_size=${pageSize}`
  );
}

/**
 * Get a single conversation with messages
 * @param conversationId Conversation ID
 */
export async function getConversation(
  conversationId: string
): Promise<ChatConversation> {
  return apiRequest<ChatConversation>(`/conversations/${conversationId}`);
}

/**
 * Create a new conversation
 * @param title Optional title for the conversation
 */
export async function createConversation(
  title: string = "New Chat"
): Promise<ChatConversation> {
  return apiRequest<ChatConversation>("/conversations", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

/**
 * Update conversation title
 * @param conversationId Conversation ID
 * @param title New title
 */
export async function updateConversationTitle(
  conversationId: string,
  title: string
): Promise<SuccessResponse> {
  return apiRequest<SuccessResponse>(`/conversations/${conversationId}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}

/**
 * Delete a conversation
 * @param conversationId Conversation ID
 */
export async function deleteConversation(
  conversationId: string
): Promise<SuccessResponse> {
  return apiRequest<SuccessResponse>(`/conversations/${conversationId}`, {
    method: "DELETE",
  });
}

/**
 * Delete all conversations
 */
export async function deleteAllConversations(): Promise<SuccessResponse> {
  return apiRequest<SuccessResponse>("/conversations", {
    method: "DELETE",
  });
}

// ===== Message Operations =====

/**
 * Get messages for a conversation
 * @param conversationId Conversation ID
 */
export async function getMessages(
  conversationId: string
): Promise<{ messages: ChatMessage[] }> {
  return apiRequest<{ messages: ChatMessage[] }>(
    `/conversations/${conversationId}/messages`
  );
}

/**
 * Add a message to a conversation
 * @param conversationId Conversation ID
 * @param role Message role (user, assistant, system)
 * @param content Message content
 */
export async function addMessage(
  conversationId: string,
  role: "user" | "assistant" | "system",
  content: string
): Promise<ChatMessage> {
  return apiRequest<ChatMessage>(
    `/conversations/${conversationId}/messages`,
    {
      method: "POST",
      body: JSON.stringify({ role, content }),
    }
  );
}
