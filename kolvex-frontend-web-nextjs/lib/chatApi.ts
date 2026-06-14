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

// ===== Agent-Powered Operations =====

export interface AgentMessageResponse {
  message: ChatMessage;
  response: ChatMessage;
}

/**
 * SSE event types from the LangGraph agent stream
 */
export interface AgentStreamEvent {
  type: "status" | "token" | "tool_start" | "tool_end" | "done" | "error";
  content?: string;
  tool?: string;
  stage?: "routing" | "planning" | "writing" | string;
  message_id?: string;
  created_at?: string;
}

/**
 * Options for agent requests
 */
export interface AgentRequestOptions {
  /** Model ID (e.g. "gpt-4o-mini", "deepseek-chat") */
  model?: string;
  /** Active data sources: "kol", "news", "web", "portfolio", "robinhood" */
  sources?: string[];
}

/**
 * Send a message and get AI Agent response (synchronous)
 * Uses the LangGraph agent backend
 * @param conversationId Conversation ID
 * @param content Message content
 * @param options Model and source options
 */
export async function sendAgentMessage(
  conversationId: string,
  content: string,
  options?: AgentRequestOptions
): Promise<AgentMessageResponse> {
  return apiRequest<AgentMessageResponse>(
    `/conversations/${conversationId}/send`,
    {
      method: "POST",
      body: JSON.stringify({
        content,
        model: options?.model || undefined,
        sources: options?.sources || undefined,
      }),
    }
  );
}

/**
 * Send a message and stream AI Agent response (SSE)
 * Returns the raw Response for SSE processing
 * @param conversationId Conversation ID
 * @param content Message content
 * @param options Model and source options
 */
export async function streamAgentMessage(
  conversationId: string,
  content: string,
  options?: AgentRequestOptions,
  signal?: AbortSignal
): Promise<Response> {
  const response = await fetch(
    `${API_PREFIX}/conversations/${conversationId}/stream`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content,
        model: options?.model || undefined,
        sources: options?.sources || undefined,
      }),
      signal,
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Stream request failed: ${response.status}`);
  }

  return response;
}

/**
 * Consume an SSE response without assuming network chunks align to lines or
 * events. Browsers may split a JSON payload anywhere in the byte stream.
 */
export async function readAgentStream(
  response: Response,
  onEvent: (event: AgentStreamEvent) => void | Promise<void>
): Promise<void> {
  if (!response.body) {
    throw new Error("The chat stream returned no response body.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const processEventBlock = async (block: string) => {
    const data = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");

    if (!data || data === "[DONE]") return;
    await onEvent(JSON.parse(data) as AgentStreamEvent);
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });

    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() || "";
    for (const block of blocks) {
      if (block.trim()) await processEventBlock(block);
    }

    if (done) break;
  }

  if (buffer.trim()) {
    await processEventBlock(buffer);
  }
}
