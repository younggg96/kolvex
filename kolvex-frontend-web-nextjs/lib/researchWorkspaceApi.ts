/**
 * Research workspaces: chats grouped by topic and researched by several sub-agents.
 * Calls go through the authenticated Next.js proxy at /api/research-workspaces.
 */

import type { AnswerCheck } from "@/lib/chatApi";

const API_PREFIX = "/api/research-workspaces";

/** Workspace researchers, each with its own small tool set (backend AGENT_KEYS). */
export const RESEARCH_AGENTS = ["market", "fundamentals", "news", "creators", "portfolio"] as const;
/** Chat specialists a manual run can add; they keep their chat prompt and tools (backend SPECIALIST_AGENTS). */
export const SPECIALIST_RESEARCH_AGENTS = [
  "valuation",
  "earnings",
  "smart_money",
  "macro",
  "buzz",
] as const;
/** Researchers in one manual run (backend MAX_RUN_AGENTS). */
export const MAX_RESEARCH_AGENTS = 5;
export type ResearchAgent =
  (typeof RESEARCH_AGENTS)[number] | (typeof SPECIALIST_RESEARCH_AGENTS)[number];
export const DEFAULT_RESEARCH_AGENTS: ResearchAgent[] = [
  "market",
  "fundamentals",
  "news",
  "creators",
];

/** Chat sub-agents (backend app/agent/agents.py). A workspace chat bound to one is its panel. */
export const CHAT_AGENTS = [
  "financial",
  "valuation",
  "earnings",
  "smart_money",
  "creators",
  "buzz",
  "macro",
  "portfolio",
  "paper_review",
  "research",
] as const;
export type ChatAgent = (typeof CHAT_AGENTS)[number];
export type RunAgent = ResearchAgent | Exclude<ChatAgent, "research">;

export function isChatAgent(value: unknown): value is ChatAgent {
  return typeof value === "string" && (CHAT_AGENTS as readonly string[]).includes(value);
}

export type Stance = "bullish" | "bearish" | "neutral" | "mixed";
export type RunStatus = "running" | "completed" | "partial" | "failed";
export type AgentStatus = "queued" | "running" | "completed" | "failed";

export interface Workspace {
  id: string;
  title: string;
  brief: string;
  tickers: string[];
  created_at: string;
  updated_at: string;
}

export interface WorkspaceListItem extends Workspace {
  chat_count: number;
  latest_run: Pick<ResearchRun, "id" | "status" | "stance" | "started_at" | "completed_at"> | null;
}

export interface AgentResult {
  id: string;
  agent: RunAgent;
  status: AgentStatus;
  summary: string;
  content: string;
  stance: Stance | null;
  confidence: number | null;
  tools_used: string[];
  /** Numbers in the note checked against this researcher's tool results; absent before the migration. */
  answer_check?: AnswerCheck | null;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface ResearchRun {
  id: string;
  workspace_id: string;
  status: RunStatus;
  question: string;
  agents: RunAgent[];
  model_id: string | null;
  synthesis: string | null;
  stance: Stance | null;
  /** Numbers in the conclusion checked against every researcher's tool results. */
  answer_check?: AnswerCheck | null;
  error: string | null;
  started_at: string;
  completed_at: string | null;
  results?: AgentResult[];
}

export interface WorkspaceChat {
  id: string;
  title: string;
  updated_at: string | null;
  added_at: string;
  /** Set when the chat is an agent panel; null for an ordinary chat. */
  agent?: ChatAgent | null;
}

export interface WorkspaceDetail extends Workspace {
  chats: WorkspaceChat[];
  runs: Omit<ResearchRun, "workspace_id" | "model_id" | "synthesis" | "error">[];
  latest_run: ResearchRun | null;
}

export class WorkspaceApiError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
  }
}

async function request<T>(
  endpoint: string,
  init: RequestInit = {},
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`${API_PREFIX}${endpoint}`, {
    ...init,
    signal,
    headers: { "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new WorkspaceApiError(data?.error || "request_failed", response.status);
  }
  return data as T;
}

export async function listWorkspaces(signal?: AbortSignal) {
  return (await request<{ workspaces: WorkspaceListItem[] }>("", {}, signal)).workspaces;
}

export function createWorkspace(body: { title: string; brief?: string; tickers?: string[] }) {
  return request<Workspace>("", { method: "POST", body: JSON.stringify(body) });
}

export function getWorkspace(id: string, signal?: AbortSignal) {
  return request<WorkspaceDetail>(`/${id}`, {}, signal);
}

export function updateWorkspace(
  id: string,
  body: Partial<Pick<Workspace, "title" | "brief" | "tickers">>,
) {
  return request<Workspace>(`/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export function deleteWorkspace(id: string) {
  return request<{ success: boolean }>(`/${id}`, { method: "DELETE" });
}

export function attachChat(workspaceId: string, conversationId: string, agent?: ChatAgent) {
  return request(`/${workspaceId}/chats`, {
    method: "POST",
    body: JSON.stringify({ conversation_id: conversationId, agent }),
  });
}

export function detachChat(conversationId: string) {
  return request(`/chats/${conversationId}`, { method: "DELETE" });
}

export async function workspaceForChat(conversationId: string, signal?: AbortSignal) {
  return (await request<{ workspace: Workspace | null }>(`/by-chat/${conversationId}`, {}, signal))
    .workspace;
}

export function startRun(
  workspaceId: string,
  body: { question?: string; agents?: ResearchAgent[]; model?: string },
) {
  return request<ResearchRun>(`/${workspaceId}/runs`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getRun(runId: string, signal?: AbortSignal) {
  return request<ResearchRun>(`/runs/${runId}`, {}, signal);
}

export interface ChatResearchRequest {
  message_id: string;
  question: string;
  agents: ChatAgent[];
  model?: string;
  sources?: string[];
  skills?: string[];
  context?: string;
  tickers: string[];
}

export function startChatResearch(conversationId: string, body: ChatResearchRequest) {
  return request<ResearchRun>(`/by-chat/${conversationId}/runs`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Parse "nvda, $amd tsla" into unique upper-case tickers. Validation stays on the backend. */
export function parseTickers(input: string): string[] {
  const out: string[] = [];
  for (const part of input.split(/[\s,，]+/)) {
    const symbol = part.trim().replace(/^\$/, "").toUpperCase();
    if (symbol && !out.includes(symbol)) out.push(symbol);
  }
  return out;
}
