/**
 * Research workspaces: chats grouped by topic and researched by several sub-agents.
 * Calls go through the authenticated Next.js proxy at /api/research-workspaces.
 */

const API_PREFIX = "/api/research-workspaces";

export const RESEARCH_AGENTS = ["market", "fundamentals", "news", "creators", "portfolio"] as const;
export type ResearchAgent = (typeof RESEARCH_AGENTS)[number];
export const DEFAULT_RESEARCH_AGENTS: ResearchAgent[] = ["market", "fundamentals", "news", "creators"];

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
  agent: ResearchAgent;
  status: AgentStatus;
  summary: string;
  content: string;
  stance: Stance | null;
  confidence: number | null;
  tools_used: string[];
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface ResearchRun {
  id: string;
  workspace_id: string;
  status: RunStatus;
  question: string;
  agents: ResearchAgent[];
  model_id: string | null;
  synthesis: string | null;
  stance: Stance | null;
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
}

export interface WorkspaceDetail extends Workspace {
  chats: WorkspaceChat[];
  runs: Omit<ResearchRun, "workspace_id" | "model_id" | "synthesis" | "error">[];
  latest_run: ResearchRun | null;
}

export class WorkspaceApiError extends Error {
  constructor(public code: string, public status: number) {
    super(code);
  }
}

async function request<T>(endpoint: string, init: RequestInit = {}, signal?: AbortSignal): Promise<T> {
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

export function updateWorkspace(id: string, body: Partial<Pick<Workspace, "title" | "brief" | "tickers">>) {
  return request<Workspace>(`/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export function deleteWorkspace(id: string) {
  return request<{ success: boolean }>(`/${id}`, { method: "DELETE" });
}

export function attachChat(workspaceId: string, conversationId: string) {
  return request(`/${workspaceId}/chats`, { method: "POST", body: JSON.stringify({ conversation_id: conversationId }) });
}

export function detachChat(conversationId: string) {
  return request(`/chats/${conversationId}`, { method: "DELETE" });
}

export async function workspaceForChat(conversationId: string, signal?: AbortSignal) {
  return (await request<{ workspace: Workspace | null }>(`/by-chat/${conversationId}`, {}, signal)).workspace;
}

export function startRun(workspaceId: string, body: { question?: string; agents?: ResearchAgent[]; model?: string }) {
  return request<ResearchRun>(`/${workspaceId}/runs`, { method: "POST", body: JSON.stringify(body) });
}

export function getRun(runId: string, signal?: AbortSignal) {
  return request<ResearchRun>(`/runs/${runId}`, {}, signal);
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
