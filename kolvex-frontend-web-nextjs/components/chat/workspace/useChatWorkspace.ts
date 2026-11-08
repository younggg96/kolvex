"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createConversation } from "@/lib/chatApi";
import {
  attachChat,
  createWorkspace,
  deleteWorkspace,
  detachChat,
  getRun,
  getWorkspace,
  listWorkspaces,
  startRun,
  updateWorkspace,
  workspaceForChat,
  WorkspaceApiError,
  type ResearchAgent,
  type ResearchRun,
  type WorkspaceDetail,
  type WorkspaceListItem,
} from "@/lib/researchWorkspaceApi";

const POLL_MS = 3000;

function errorCode(error: unknown) {
  return error instanceof WorkspaceApiError ? error.code : "request_failed";
}

/**
 * Workspace state: detail, the viewed run and polling. Pass a conversationId to follow
 * the workspace that chat belongs to, or a workspaceId to open one directly.
 */
export function useResearchWorkspace({ conversationId, workspaceId }: { conversationId?: string; workspaceId?: string }) {
  const [detail, setDetail] = useState<WorkspaceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [run, setRun] = useState<ResearchRun | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceListItem[] | null>(null);
  const viewedRunId = useRef<string | null>(null);

  const loadDetail = useCallback(async (workspaceId: string, keepRun = false) => {
    const next = await getWorkspace(workspaceId);
    setDetail(next);
    if (!keepRun || !viewedRunId.current) {
      viewedRunId.current = next.latest_run?.id ?? null;
      setRun(next.latest_run);
    }
    return next;
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const id = workspaceId ?? (conversationId ? (await workspaceForChat(conversationId))?.id : undefined);
      setUnavailable(false);
      if (id) await loadDetail(id);
      else {
        setDetail(null);
        setRun(null);
        viewedRunId.current = null;
      }
    } catch (error) {
      // Before the migration runs the backend answers 503; the chat itself keeps working.
      setUnavailable(errorCode(error) === "workspace_unavailable" || (error as WorkspaceApiError)?.status === 503);
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [conversationId, workspaceId, loadDetail]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Poll the viewed run while it is running; pause while the tab is hidden.
  useEffect(() => {
    if (!run || run.status !== "running") return;
    let cancelled = false;
    const tick = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const next = await getRun(run.id);
        if (cancelled || viewedRunId.current !== run.id) return;
        setRun(next);
        if (next.status !== "running" && detail) await loadDetail(detail.id, true);
      } catch {
        /* keep the last state; the next tick retries */
      }
    };
    const timer = window.setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [run, detail, loadDetail]);

  const [listFailed, setListFailed] = useState(false);
  const loadWorkspaces = useCallback(async () => {
    try {
      setWorkspaces(await listWorkspaces());
      setListFailed(false);
    } catch {
      setWorkspaces([]);
      setListFailed(true);
    }
  }, []);

  const join = useCallback(async (targetId: string) => {
    if (!conversationId) return;
    await attachChat(targetId, conversationId);
    await loadDetail(targetId);
    void loadWorkspaces();
  }, [conversationId, loadDetail, loadWorkspaces]);

  const createAndJoin = useCallback(async (title: string, tickers: string[]) => {
    const workspace = await createWorkspace({ title, tickers });
    await join(workspace.id);
    return workspace;
  }, [join]);

  const leave = useCallback(async () => {
    if (!conversationId) return;
    await detachChat(conversationId);
    setDetail(null);
    setRun(null);
    viewedRunId.current = null;
    void loadWorkspaces();
  }, [conversationId, loadWorkspaces]);

  const save = useCallback(async (values: { title?: string; brief?: string; tickers?: string[] }) => {
    if (!detail) return;
    await updateWorkspace(detail.id, values);
    await loadDetail(detail.id, true);
  }, [detail, loadDetail]);

  const remove = useCallback(async () => {
    if (!detail) return;
    await deleteWorkspace(detail.id);
    setDetail(null);
    setRun(null);
    viewedRunId.current = null;
    void loadWorkspaces();
  }, [detail, loadWorkspaces]);

  const start = useCallback(async (question: string, agents: ResearchAgent[], model?: string) => {
    if (!detail) return;
    const created = await startRun(detail.id, { question, agents, model });
    viewedRunId.current = created.id;
    // Show queued researchers immediately; polling fills them in.
    setRun({
      ...created,
      results: agents.map((agent) => ({
        id: agent, agent, status: "queued", summary: "", content: "", stance: null,
        confidence: null, tools_used: [], error: null, started_at: null, completed_at: null,
      })),
    });
    void loadDetail(detail.id, true);
  }, [detail, loadDetail]);

  /** Starts a chat that already belongs to this workspace; returns its id for navigation. */
  const newChat = useCallback(async () => {
    if (!detail) return null;
    const conversation = await createConversation();
    await attachChat(detail.id, conversation.id);
    return conversation.id;
  }, [detail]);

  const viewRun = useCallback(async (runId: string) => {
    viewedRunId.current = runId;
    const next = await getRun(runId);
    if (viewedRunId.current === runId) setRun(next);
  }, []);

  return {
    detail, run, loading, unavailable, workspaces, listFailed,
    refresh, loadWorkspaces, join, createAndJoin, leave, save, remove, start, viewRun, newChat,
    conversationId,
  };
}

export function useChatWorkspace(conversationId: string) {
  return useResearchWorkspace({ conversationId });
}

export type ChatWorkspace = ReturnType<typeof useResearchWorkspace>;
export { errorCode as workspaceErrorCode };
