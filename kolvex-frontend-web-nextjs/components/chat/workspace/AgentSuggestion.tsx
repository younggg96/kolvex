"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, LayoutGrid, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCopy } from "@/components/decision/shared";
import { startChatResearch, type ChatResearchRequest } from "@/lib/researchWorkspaceApi";
import { chatAgentName } from "./chatAgents";
import { workspaceErrorText } from "./parts";
import { workspaceErrorCode } from "./useChatWorkspace";

export type AgentLaunch = {
  request: ChatResearchRequest;
  status: "ask" | "launching" | "running" | "failed";
  workspaceId?: string;
  error?: string;
};

export function useAgentLaunch(conversationId: string, refresh: () => Promise<void>) {
  const [launch, setLaunch] = useState<AgentLaunch | null>(null);
  const pending = useRef(false);

  const offer = useCallback((request: ChatResearchRequest) => {
    setLaunch({ status: "ask", request });
  }, []);

  const confirm = useCallback(async () => {
    if (!launch || pending.current || !["ask", "failed"].includes(launch.status)) return;
    const { request } = launch;
    pending.current = true;
    setLaunch({ status: "launching", request });
    try {
      const run = await startChatResearch(conversationId, request);
      setLaunch((current) =>
        current?.request === request
          ? { status: "running", request, workspaceId: run.workspace_id }
          : current,
      );
      void refresh();
    } catch (error) {
      setLaunch((current) =>
        current?.request === request
          ? { status: "failed", request, error: workspaceErrorCode(error) }
          : current,
      );
    } finally {
      pending.current = false;
    }
  }, [conversationId, launch, refresh]);

  const dismiss = useCallback(() => setLaunch(null), []);
  return { launch, offer, confirm, dismiss };
}

export function AgentLaunchCard({
  launch,
  onConfirm,
  onDismiss,
}: {
  launch: AgentLaunch;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  const c = useCopy();
  const names = launch.request.agents.map((agent) => chatAgentName(agent, c)).join(c(", ", "、"));

  return (
    <div className="pointer-events-auto mb-2 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2">
      <LayoutGrid className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <p role="status" className="min-w-0 flex-1 basis-32 text-sm text-foreground">
        {launch.status === "ask" &&
          c(`Start team research with ${names}?`, `交给研究团队分析？参与研究员为${names}。`)}
        {launch.status === "launching" && c("Starting team research…", "正在启动团队研究…")}
        {launch.status === "running" && c("Sent to the research team.", "已交给研究团队。")}
        {launch.status === "failed" && workspaceErrorText(launch.error, c)}
      </p>
      {(launch.status === "ask" || launch.status === "failed") && (
        <Button className="min-h-11 shrink-0" size="sm" onClick={onConfirm}>
          {launch.status === "ask" ? c("Start research", "开始研究") : c("Retry", "重试")}
        </Button>
      )}
      {launch.status === "launching" && (
        <Loader2
          className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
      )}
      {launch.workspaceId && (
        <Button size="sm" className="min-h-11 shrink-0 gap-1.5" asChild>
          <Link href={`/dashboard/workspaces/${launch.workspaceId}`}>
            {c("View research", "查看研究")}
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-11 w-11 shrink-0"
        onClick={onDismiss}
        aria-label={c("Dismiss", "关闭")}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
