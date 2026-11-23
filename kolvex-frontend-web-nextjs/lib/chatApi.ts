import type { TokenUsage } from "@/lib/tokenUsage";
import { invalidateClientCache, loadClientCache } from "./clientCache";

/**
 * Chat History API Module
 * Client-side API calls for chat history functionality
 */

const API_PREFIX = "/api/chat-history";

// ===== Types =====

export interface QuoteEvidence {
  symbol: string;
  price: number;
  currency: string | null;
  source: string;
  quoted_at: string | null;
}

export interface RevenueEvidence {
  symbol: string;
  value: number;
  currency: string;
  period_kind: "quarterly" | "annual";
  /** Absent for Yahoo Finance evidence, which reports only the period end. */
  period_start?: string | null;
  period_end: string;
  /** SEC filing date; absent for Yahoo Finance evidence. */
  filed_on?: string | null;
  source_url: string;
  source?: "sec" | "yahoo";
  /** The company's name for the period, e.g. "FY2027 Q2". */
  fiscal_label?: string | null;
  /** Non-USD revenue converted at the period-end exchange rate. */
  usd_value?: number | null;
  fx_rate?: number | null;
  fx_date?: string | null;
  /** Server-calculated, on the latest period of a year-over-year comparison only. */
  year_over_year_pct?: number | null;
  compared_period_end?: string | null;
  unavailable_reason?: string | null;
  /** A newer period exists, but its revenue is only derivable (e.g. Q4 after a 10-K). */
  newer_derived_period_end?: string | null;
}

export interface AnswerCheckClaim {
  text: string;
  kind: "money" | "percent" | "multiple";
  status: "matched" | "mismatch" | "unverified";
  expected?: { value: number; label: string };
}

/** Server check of the numbers in an answer against that turn's evidence. */
export interface AnswerCheck {
  version: number;
  matched: number;
  mismatch: number;
  unverified: number;
  claims: AnswerCheckClaim[];
  /** Tools that returned nothing this turn: failed ("unavailable") or empty source ("no_data"). */
  data_gaps?: { tool: string; kind: "unavailable" | "no_data" }[];
}

/** A page the answer's web search returned. */
export interface WebSource {
  url: string;
  domain: string;
  title: string;
  snippet: string;
  query: string;
  /** Tool that returned the link, e.g. web_search, search_news_flashes. */
  tool?: string;
  published_date?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
  quote_evidence?: QuoteEvidence[] | null;
  revenue_evidence?: RevenueEvidence[] | null;
  answer_check?: AnswerCheck | null;
  token_usage?: TokenUsage | null;
  web_sources?: WebSource[] | null;
  /** Suggested next questions the answer ended with. */
  follow_ups?: string[] | null;
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

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const read = (options.method ?? "GET").toUpperCase() === "GET";
  const request = async (signal?: AbortSignal): Promise<T> => {
    const response = await fetch(`${API_PREFIX}${endpoint}`, {
      ...options,
      signal,
      headers: { "Content-Type": "application/json", ...options.headers },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw Object.assign(new Error(error.error || `Request failed: ${response.status}`), {
        status: response.status,
      });
    }
    const data = await response.json();
    if (!read) invalidateClientCache(API_PREFIX);
    return data;
  };
  // Chat contents remain tab-local and are cleared by the shared account boundary.
  if (read && options.cache !== "no-store")
    return loadClientCache(`${API_PREFIX}${endpoint}`, request, {
      ttl: 30_000,
      maxAge: 60_000,
      signal: options.signal ?? undefined,
    });
  return request(options.signal ?? undefined);
}

// ===== Conversation Operations =====

/**
 * Get all conversations
 * @param page Page number
 * @param pageSize Number of items per page
 */
export async function getConversations(
  page: number = 1,
  pageSize: number = 50,
): Promise<ConversationsListResponse> {
  return apiRequest<ConversationsListResponse>(`/conversations?page=${page}&page_size=${pageSize}`);
}

/**
 * Get a single conversation with messages
 * @param conversationId Conversation ID
 */
export async function getConversation(
  conversationId: string,
  fresh = false,
): Promise<ChatConversation> {
  return apiRequest<ChatConversation>(
    `/conversations/${conversationId}`,
    fresh ? { cache: "no-store" } : {},
  );
}

/**
 * Create a new conversation
 * @param title Optional title for the conversation
 */
export async function createConversation(title: string = "New Chat"): Promise<ChatConversation> {
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
  title: string,
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
export async function deleteConversation(conversationId: string): Promise<SuccessResponse> {
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
  conversationId: string,
  options: { fresh?: boolean } = {},
): Promise<{ messages: ChatMessage[] }> {
  // fresh: skip the tab cache, e.g. after a turn finished on the server while nobody was reading.
  return apiRequest<{ messages: ChatMessage[] }>(
    `/conversations/${conversationId}/messages`,
    options.fresh ? { cache: "no-store" } : {},
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
  content: string,
): Promise<ChatMessage> {
  return apiRequest<ChatMessage>(`/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ role, content }),
  });
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
  type:
    | "accepted"
    | "status"
    | "token"
    | "token_reset"
    | "tool_start"
    | "tool_end"
    | "agent"
    | "agent_suggestion"
    | "done"
    | "error";
  content?: string;
  tool?: string;
  /** "agent": the sub-agent answering this turn. */
  agent?: string;
  /** "agent_suggestion": specialists waiting for confirmation in Ask me mode. */
  agents?: string[];
  question?: string;
  workspace_id?: string;
  run_id?: string;
  workspace_error?: string;
  /** "error": a machine-readable reason, e.g. "free_quota_exceeded". */
  code?: string;
  stage?: "routing" | "planning" | "writing" | string;
  message_id?: string;
  user_message?: ChatMessage;
  quote_evidence?: QuoteEvidence[];
  revenue_evidence?: RevenueEvidence[];
  answer_check?: AnswerCheck | null;
  token_usage?: TokenUsage | null;
  web_sources?: WebSource[];
  follow_ups?: string[];
  created_at?: string;
}

/**
 * Options for agent requests
 */
export interface AgentRequestOptions {
  /** Model ID (e.g. "gpt-4o-mini", "deepseek-chat") */
  model?: string;
  /** Active data sources: "web", "portfolio", "plaid" */
  sources?: string[];
  skills?: string[];
  /** Page evidence for this turn. The backend does not store it as the user message. */
  context?: string;
  /** Pin a chat sub-agent (a workspace agent panel) instead of routing. */
  agent?: string;
  /** Agents automatic routing may pick (AI assistant settings and this chat's skills). */
  agents?: string[];
  teamResearch?: "auto" | "ask" | "off";
  maxTeamAgents?: number;
  tickers?: string[];
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
  options?: AgentRequestOptions,
): Promise<AgentMessageResponse> {
  return apiRequest<AgentMessageResponse>(`/conversations/${conversationId}/send`, {
    method: "POST",
    body: JSON.stringify({
      content,
      model: options?.model || undefined,
      sources: options?.sources || undefined,
      skills: options?.skills,
      context: options?.context || undefined,
      agent: options?.agent || undefined,
      agents: options?.agents?.length ? options.agents : undefined,
    }),
  });
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
  signal?: AbortSignal,
): Promise<Response> {
  // A stream can commit messages even if the client disconnects before "done".
  invalidateClientCache(API_PREFIX);
  const response = await fetch(`${API_PREFIX}/conversations/${conversationId}/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content,
      model: options?.model || undefined,
      sources: options?.sources || undefined,
      skills: options?.skills,
      context: options?.context || undefined,
      agent: options?.agent || undefined,
      agents: options?.agents?.length ? options.agents : undefined,
      team_research: options?.teamResearch,
      max_team_agents: options?.maxTeamAgents,
      tickers: options?.tickers,
    }),
    signal,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Stream request failed: ${response.status}`);
  }

  return response;
}

export function getAgentStreamStatus(conversationId: string, signal?: AbortSignal) {
  return apiRequest<{ active: boolean }>(`/conversations/${conversationId}/stream`, {
    cache: "no-store",
    signal,
  });
}

export function stopAgentStream(conversationId: string) {
  return apiRequest<{ active: boolean }>(`/conversations/${conversationId}/stream`, {
    method: "DELETE",
  });
}

/**
 * Consume an SSE response without assuming network chunks align to lines or
 * events. Browsers may split a JSON payload anywhere in the byte stream.
 */
async function consumeAgentStream(
  response: Response,
  onEvent: (event: AgentStreamEvent) => void | Promise<void>,
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
    const event = JSON.parse(data) as AgentStreamEvent;
    await onEvent(event);
    return event.type === "done";
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });

      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() || "";
      for (const block of blocks) {
        if (block.trim() && (await processEventBlock(block))) return;
      }

      if (done) break;
    }

    if (buffer.trim()) await processEventBlock(buffer);
  } finally {
    // Closing the subscription is best effort once the terminal event has arrived.
    void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

/** Discard any history read while a stream was writing, including partial writes. */
export async function readAgentStream(
  response: Response,
  onEvent: (event: AgentStreamEvent) => void | Promise<void>,
): Promise<void> {
  try {
    await consumeAgentStream(response, onEvent);
  } finally {
    invalidateClientCache(API_PREFIX);
  }
}
