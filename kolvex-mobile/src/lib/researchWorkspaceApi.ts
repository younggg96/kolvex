// Types and ticker parsing follow the Web's lib/researchWorkspaceApi.ts. The app calls
// FastAPI directly with the account's session instead of the Next.js proxy.
import { ApiError, apiRequest } from "./http";

export const RESEARCH_AGENTS = [
  "market",
  "fundamentals",
  "news",
  "creators",
  "portfolio",
] as const;
export type ResearchAgent = (typeof RESEARCH_AGENTS)[number];
export const DEFAULT_RESEARCH_AGENTS: ResearchAgent[] = [
  "market",
  "fundamentals",
  "news",
  "creators",
];

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
  latest_run: Pick<
    ResearchRun,
    "id" | "status" | "stance" | "started_at" | "completed_at"
  > | null;
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
  runs: Omit<
    ResearchRun,
    "workspace_id" | "model_id" | "synthesis" | "error"
  >[];
  latest_run: ResearchRun | null;
}

/** Carries the backend's code (detail) for the screen to word. */
export class WorkspaceApiError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
  }
}

type Init = { method?: string; body?: unknown; signal?: AbortSignal };
async function request<T>(
  endpoint: string,
  user: string,
  init: Init = {},
): Promise<T> {
  try {
    return await apiRequest<T>(`/research-workspaces${endpoint}`, {
      ...init,
      authenticated: true,
      expectedUser: user,
      timeout: 30_000,
    });
  } catch (error) {
    if (error instanceof ApiError)
      throw new WorkspaceApiError(
        error.detail && error.detail !== "Not Found"
          ? error.detail
          : error.status === 503
            ? "workspace_unavailable"
            : "request_failed",
        error.status,
      );
    throw error;
  }
}
export const workspaceErrorCode = (error: unknown) =>
  error instanceof WorkspaceApiError ? error.code : "request_failed";

export const listWorkspaces = async (user: string, signal?: AbortSignal) =>
  (await request<{ workspaces: WorkspaceListItem[] }>("", user, { signal }))
    .workspaces;
export const createWorkspace = (
  user: string,
  body: { title: string; brief?: string; tickers?: string[] },
) => request<Workspace>("", user, { method: "POST", body });
export const getWorkspace = (id: string, user: string, signal?: AbortSignal) =>
  request<WorkspaceDetail>(`/${encodeURIComponent(id)}`, user, { signal });
export const updateWorkspace = (
  id: string,
  user: string,
  body: Partial<Pick<Workspace, "title" | "brief" | "tickers">>,
) =>
  request<Workspace>(`/${encodeURIComponent(id)}`, user, {
    method: "PATCH",
    body,
  });
export const deleteWorkspace = (id: string, user: string) =>
  request<{ success: boolean }>(`/${encodeURIComponent(id)}`, user, {
    method: "DELETE",
  });
export const attachChat = (
  workspaceId: string,
  conversationId: string,
  user: string,
) =>
  request(`/${encodeURIComponent(workspaceId)}/chats`, user, {
    method: "POST",
    body: { conversation_id: conversationId },
  });
export const startRun = (
  workspaceId: string,
  user: string,
  body: { question?: string; agents?: ResearchAgent[]; model?: string },
) =>
  request<ResearchRun>(`/${encodeURIComponent(workspaceId)}/runs`, user, {
    method: "POST",
    body,
  });
export const getRun = (runId: string, user: string, signal?: AbortSignal) =>
  request<ResearchRun>(`/runs/${encodeURIComponent(runId)}`, user, { signal });

/** Parse "nvda, $amd tsla" into unique upper-case tickers. Validation stays on the backend. */
export function parseTickers(input: string): string[] {
  const out: string[] = [];
  for (const part of input.split(/[\s,，]+/)) {
    const symbol = part.trim().replace(/^\$/, "").toUpperCase();
    if (symbol && !out.includes(symbol)) out.push(symbol);
  }
  return out;
}

export const workspaceForChat = async (
  conversationId: string,
  user: string,
  signal?: AbortSignal,
) =>
  (
    await request<{ workspace: Workspace | null }>(
      `/by-chat/${encodeURIComponent(conversationId)}`,
      user,
      { signal },
    )
  ).workspace;
export const detachChat = (conversationId: string, user: string) =>
  request(`/chats/${encodeURIComponent(conversationId)}`, user, {
    method: "DELETE",
  });
