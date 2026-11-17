"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, LayoutGrid, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCopy } from "@/components/decision/shared";
import { findSymbols } from "@/lib/markdown/stockMentions";
import { isChatAgent, type ChatAgent } from "@/lib/researchWorkspaceApi";
import { readAiAssistantSettings } from "@/lib/aiAssistantSettings";
import { ensureAgentPanels, startAgentTurn } from "./AgentDesk";
import { CHAT_AGENT_META, chatAgentName } from "./chatAgents";
import type { ChatWorkspace } from "./useChatWorkspace";

export type AgentLaunch =
  | { status: "ask"; agents: ChatAgent[]; question: string }
  | { status: "launching"; agents: ChatAgent[] }
  | { status: "running"; agents: ChatAgent[]; workspaceId: string; failed: ChatAgent[] }
  | { status: "failed"; agents: ChatAgent[] };

/**
 * When a question spans several specialist agents, hand it to each of them at once in a
 * workspace: this chat's workspace, or a new one named after the question that this chat joins.
 * Each agent gets (or reuses) its panel and starts on the question on the server, so the work
 * goes on while the user stays in this chat; the panels hold the answers to continue from.
 */
export function useAgentLaunch(workspace: ChatWorkspace, model?: string) {
  const c = useCopy();
  const [launch, setLaunch] = useState<AgentLaunch | null>(null);
  // The stream callback outlives renders; read the latest workspace and model through refs.
  const latest = useRef({ workspace, model, c });
  latest.current = { workspace, model, c };
  const started = useRef(new Set<string>());

  /** Starts the agents now, whatever the setting (the "ask" card's button). */
  const run = useCallback(async (agents: ChatAgent[], question: string) => {
    const { workspace, model, c } = latest.current;
    setLaunch({ status: "launching", agents });
    try {
      const workspaceId =
        workspace.detail?.id ??
        (
          await workspace.createAndJoin(
            question.replace(/\s+/g, " ").trim().slice(0, 60),
            findSymbols(question).slice(0, 10),
          )
        ).id;
      const ids = await ensureAgentPanels(workspaceId, workspace.detail?.chats ?? [], agents, c);
      const results = await Promise.allSettled(
        agents.map((agent) => startAgentTurn(ids[agent], agent, question, model)),
      );
      const failed = agents.filter((_, i) => results[i].status === "rejected");
      setLaunch({ status: "running", agents, workspaceId, failed });
      void latest.current.workspace.reload();
    } catch {
      setLaunch({ status: "failed", agents });
    }
  }, []);

  /** A question needs these agents: start them, offer them, or ignore, per the AI settings. */
  const start = useCallback(
    async (raw: string[], question: string) => {
      const settings = readAiAssistantSettings();
      const agents = (raw.filter(isChatAgent) as ChatAgent[])
        .filter((agent) => !settings.disabledAgents.includes(agent))
        .slice(0, settings.maxAgents);
      const key = `${question}\u0000${agents.join(",")}`;
      if (settings.multiAgent === "off" || agents.length < 2 || !question.trim()) return;
      if (started.current.has(key)) return;
      started.current.add(key);
      if (settings.multiAgent === "ask") setLaunch({ status: "ask", agents, question });
      else await run(agents, question);
    },
    [run],
  );

  const confirm = useCallback(() => {
    if (launch?.status === "ask") void run(launch.agents, launch.question);
  }, [launch, run]);

  const dismiss = useCallback(() => setLaunch(null), []);
  return { launch, start, confirm, dismiss };
}

/** The status line for a multi-agent launch, above the composer. */
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
  const names = launch.agents.map((agent) => chatAgentName(agent, c)).join(c(", ", "、"));
  const failedNames =
    launch.status === "running"
      ? launch.failed.map((agent) => chatAgentName(agent, c)).join(c(", ", "、"))
      : "";

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-auto mb-2 flex items-center gap-3 rounded-2xl border border-foreground/10 bg-card px-3 py-2.5 shadow-sm"
    >
      <span className="flex shrink-0 -space-x-1.5" aria-hidden="true">
        {launch.agents.map((agent) => {
          const Icon = CHAT_AGENT_META[agent].icon;
          return (
            <span
              key={agent}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-background bg-muted"
            >
              <Icon className="h-3.5 w-3.5 text-foreground" />
            </span>
          );
        })}
      </span>
      <p className="min-w-0 flex-1 text-sm text-foreground">
        {launch.status === "ask" &&
          c(
            `This needs ${launch.agents.length} agents: ${names}. Run them side by side in a workspace?`,
            `这个问题需要 ${names} ${launch.agents.length} 个 Agent，要在工作区里同时进行吗？`,
          )}
        {launch.status === "launching" &&
          c(
            `Handing this to ${launch.agents.length} agents in a workspace: ${names}`,
            `正在把这个问题交给工作区里的 ${launch.agents.length} 个 Agent：${names}`,
          )}
        {launch.status === "running" &&
          (launch.failed.length === launch.agents.length
            ? c("The agents could not start. Try again.", "Agent 没能开始，请重试。")
            : c(
                `${names} are working on this in the workspace.`,
                `${names}正在工作区里同时研究这个问题。`,
              ))}
        {launch.status === "running" &&
          launch.failed.length > 0 &&
          launch.failed.length < launch.agents.length && (
            <span className="block text-xs text-negative">
              {c(`Could not start: ${failedNames}`, `未能开始：${failedNames}`)}
            </span>
          )}
        {launch.status === "failed" &&
          c("Could not open the agents in a workspace.", "没能在工作区打开这些 Agent。")}
      </p>
      {launch.status === "ask" && (
        <Button size="xs" className="shrink-0 gap-1.5" onClick={onConfirm}>
          <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
          {c("Start in workspace", "在工作区开始")}
        </Button>
      )}
      {launch.status === "launching" && (
        <Loader2
          className="h-4 w-4 shrink-0 animate-spin text-muted-foreground motion-reduce:animate-none"
          aria-hidden="true"
        />
      )}
      {launch.status === "running" && launch.failed.length < launch.agents.length && (
        <Button size="xs" className="shrink-0 gap-1.5" asChild>
          <Link href={`/dashboard/workspaces/${launch.workspaceId}`}>
            {c("Open workspace", "打开工作区")}
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="-mr-1 h-8 w-8 shrink-0"
        onClick={onDismiss}
        aria-label={c("Dismiss", "关闭")}
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </Button>
    </div>
  );
}
