"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, ExternalLink, Loader2, Plus, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InfoTip } from "@/components/ui/info-tip";
import { Textarea } from "@/components/ui/textarea";
import { useCopy } from "@/components/decision/shared";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  createConversation,
  getAgentStreamStatus,
  getMessages,
  readAgentStream,
  stopAgentStream,
  streamAgentMessage,
  type AgentStreamEvent,
  type ChatMessage,
} from "@/lib/chatApi";
import {
  CHAT_AGENTS,
  attachChat,
  detachChat,
  type ChatAgent,
  type WorkspaceChat,
} from "@/lib/researchWorkspaceApi";
import { ChatBubble } from "../ChatBubble";
import {
  panelSkills,
  readAiAssistantSettings,
  useAiAssistantSettings,
} from "@/lib/aiAssistantSettings";
import { CHAT_AGENT_META, chatAgentAbout, chatAgentName } from "./chatAgents";
import type { ChatWorkspace } from "./useChatWorkspace";

type Copy = (en: string, zh: string) => string;
type AgentPanelChat = WorkspaceChat & { agent: ChatAgent };

const ACCEPTED = Symbol("accepted");
const POLL_MS = 3000;

/**
 * Starts a turn with the agent pinned and returns once the server has accepted it. The proxy asks
 * the backend to continue on disconnect, so the turn finishes and is saved without this page.
 */
export async function startAgentTurn(
  conversationId: string,
  agent: ChatAgent,
  question: string,
  model?: string,
) {
  const abort = new AbortController();
  try {
    const response = await streamAgentMessage(
      conversationId,
      question,
      { agent, model, skills: panelSkills(readAiAssistantSettings(), agent) },
      abort.signal,
    );
    await readAgentStream(response, (event) => {
      if (event.type === "accepted") throw ACCEPTED;
      if (event.type === "error") throw new Error(event.content || "error");
    });
  } catch (error) {
    if (error !== ACCEPTED) throw error;
  } finally {
    abort.abort();
  }
}

/**
 * The workspace's agent panels for these agents: existing panels are reused, missing ones are
 * created as chats bound to their agent. Returns the chat id per agent.
 */
export async function ensureAgentPanels(
  workspaceId: string,
  existing: WorkspaceChat[],
  agents: ChatAgent[],
  c: Copy,
) {
  const ids = {} as Record<ChatAgent, string>;
  for (const agent of agents) {
    const panel = existing.find((chat) => chat.agent === agent);
    if (panel) {
      ids[agent] = panel.id;
      continue;
    }
    const conversation = await createConversation(chatAgentName(agent, c));
    await attachChat(workspaceId, conversation.id, agent);
    ids[agent] = conversation.id;
  }
  return ids;
}

/**
 * The workspace's agent panels: one chat per chat sub-agent, side by side. Each panel streams on
 * its own, so several agents work at once, and each keeps its own thread to continue.
 */
export function AgentDesk({ workspace, model }: { workspace: ChatWorkspace; model?: string }) {
  const c = useCopy();
  const detail = workspace.detail;
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState(false);
  const panels = (detail?.chats ?? []).filter((chat): chat is AgentPanelChat => !!chat.agent);
  // Oldest first, so a new panel lands at the end of the grid.
  const ordered = [...panels].sort((a, b) => a.added_at.localeCompare(b.added_at));

  if (!detail) return null;

  const add = async (agent: ChatAgent) => {
    setAdding(true);
    setError(false);
    try {
      await ensureAgentPanels(detail.id, [], [agent], c);
      await workspace.reload();
    } catch {
      setError(true);
    } finally {
      setAdding(false);
    }
  };

  const remove = async (chat: AgentPanelChat) => {
    try {
      await detachChat(chat.id);
      await workspace.reload();
    } catch {
      setError(true);
    }
  };

  return (
    <section className="space-y-3" aria-label={c("Agents", "Agent 面板")}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <h3 className="text-sm font-semibold text-foreground">{c("Agents", "Agent 面板")}</h3>
          <InfoTip label={c("How agent panels work", "Agent 面板是什么")}>
            {c(
              "Each panel is a chat with one specialist agent. Panels run at the same time, and each keeps its own thread. They all see this workspace's tickers and brief. The panel chats also appear under Chats.",
              "每个面板是和一个专项 Agent 的对话。多个面板可以同时运行，各自保留对话记录，都能看到本工作区的股票和研究背景。面板对话也会出现在「对话」列表里。",
            )}
          </InfoTip>
        </div>
        {ordered.length > 0 && <AddAgentMenu disabled={adding} adding={adding} onAdd={add} c={c} />}
      </div>
      {error && (
        <p role="alert" className="text-xs text-negative">
          {c("Could not update the agent panels. Try again.", "Agent 面板更新失败，请重试。")}
        </p>
      )}

      {ordered.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-foreground/15 px-4 py-5">
          <p className="text-sm text-muted-foreground">
            {c(
              "Add agents to work on this workspace side by side.",
              "添加 Agent，在这个工作区里同时开工。",
            )}
          </p>
          <AddAgentMenu disabled={adding} adding={adding} onAdd={add} c={c} variant="primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {ordered.map((chat) => (
            <AgentPanel
              key={chat.id}
              chat={chat}
              symbols={detail.tickers}
              model={model}
              onRemove={() => void remove(chat)}
              c={c}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function AddAgentMenu({
  onAdd,
  disabled,
  adding,
  c,
  variant = "ghost",
}: {
  onAdd: (agent: ChatAgent) => void;
  disabled: boolean;
  adding: boolean;
  c: Copy;
  variant?: "ghost" | "primary";
}) {
  const settings = useAiAssistantSettings();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant === "primary" ? "default" : "ghost"}
          size="xs"
          className={cn(
            "gap-1.5",
            variant === "ghost" && "-mr-2 text-muted-foreground hover:text-foreground",
          )}
          disabled={disabled}
        >
          {adding ? (
            <Loader2
              className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : (
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {c("Add agent", "添加 Agent")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {CHAT_AGENTS.filter((agent) => !settings.disabledAgents.includes(agent)).map((agent) => {
          const Icon = CHAT_AGENT_META[agent].icon;
          return (
            <DropdownMenuItem
              key={agent}
              onSelect={() => onAdd(agent)}
              className="items-start gap-2.5 py-2"
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-sm text-foreground">{chatAgentName(agent, c)}</span>
                <span className="block text-xs text-muted-foreground">
                  {chatAgentAbout(agent, c)}
                </span>
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AgentPanel({
  chat,
  symbols,
  model,
  onRemove,
  c,
}: {
  chat: AgentPanelChat;
  symbols: string[];
  model?: string;
  onRemove: () => void;
  c: Copy;
}) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState<string | null>(null);
  const [activity, setActivity] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [background, setBackground] = useState(false);
  const Icon = CHAT_AGENT_META[chat.agent].icon;
  const busy = streaming !== null || background;

  const toolLabel = useCallback(
    (name: string) => {
      const key = `chat.tools.${name}`;
      const label = t(key);
      return label === key ? t("chat.tools.generic") : label;
    },
    [t],
  );

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || controller.current) return;
      const abort = new AbortController();
      controller.current = abort;
      setError(null);
      setStreaming("");
      setActivity(null);
      setMessages((prev) => [
        ...(prev ?? []),
        {
          id: `pending-${Date.now()}`,
          role: "user",
          content,
          created_at: new Date().toISOString(),
        },
      ]);
      let text_ = "";
      let done: AgentStreamEvent | undefined;
      try {
        const response = await streamAgentMessage(
          chat.id,
          content,
          {
            agent: chat.agent,
            model,
            skills: panelSkills(readAiAssistantSettings(), chat.agent),
          },
          abort.signal,
        );
        await readAgentStream(response, (event) => {
          if (abort.signal.aborted) return;
          if (event.type === "token" && event.content) {
            text_ += event.content;
            setStreaming(text_);
            setActivity(null);
          } else if (event.type === "token_reset") {
            text_ = "";
            setStreaming("");
          } else if (event.type === "tool_start" && event.tool) {
            setActivity(toolLabel(event.tool));
          } else if (event.type === "done") {
            done = event;
          } else if (event.type === "error") {
            throw new Error(event.content || "error");
          }
        });
        if (!done) throw new Error("incomplete");
        const finished = done;
        if (finished.message_id && finished.content) {
          setMessages((prev) => [
            ...(prev ?? []),
            {
              id: finished.message_id!,
              role: "assistant",
              content: finished.content!,
              created_at: finished.created_at || new Date().toISOString(),
              quote_evidence: finished.quote_evidence,
              revenue_evidence: finished.revenue_evidence,
              answer_check: finished.answer_check,
            },
          ]);
        } else {
          setError(c("The agent returned no answer.", "这个 Agent 没有给出回答。"));
        }
      } catch {
        if (!abort.signal.aborted) {
          setError(c("This agent could not finish. Try again.", "这个 Agent 没能完成，请重试。"));
        }
      } finally {
        controller.current = null;
        setStreaming(null);
        setActivity(null);
      }
    },
    [chat.id, chat.agent, model, toolLabel, c],
  );

  // A turn started elsewhere (a chat's multi-agent launch, or a panel left mid-answer) keeps
  // running on the server: show it as working and pick the answer up when it is saved.
  useEffect(() => {
    let active = true;
    let timer: number | undefined;
    const load = async (fresh: boolean) => {
      try {
        const [data, status] = await Promise.all([
          getMessages(chat.id, { fresh }),
          getAgentStreamStatus(chat.id).catch(() => ({ active: false })),
        ]);
        if (!active) return;
        setMessages(data.messages.filter((m) => m.role !== "system"));
        setBackground(status.active);
        if (status.active) timer = window.setTimeout(() => void load(true), POLL_MS);
      } catch {
        if (active) setLoadFailed(true);
      }
    };
    void load(false);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [chat.id]);

  useEffect(() => () => controller.current?.abort(), []);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streaming]);

  const stop = () => {
    setBackground(false);
    controller.current?.abort();
    void stopAgentStream(chat.id).catch(() => undefined);
  };

  const submit = () => {
    if (busy || !draft.trim()) return;
    const text = draft;
    setDraft("");
    void send(text);
  };

  return (
    <article
      className="flex h-[32rem] min-w-0 flex-col overflow-hidden rounded-2xl border border-foreground/10 bg-card"
      aria-label={chatAgentName(chat.agent, c)}
    >
      <header className="flex items-center gap-2 border-b border-foreground/10 px-3 py-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground/[0.06]">
          <Icon className="h-3.5 w-3.5 text-foreground" aria-hidden="true" />
        </span>
        <h4 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
          {chatAgentName(chat.agent, c)}
        </h4>
        {busy && (
          <span
            className="inline-flex items-center gap-1 text-xs text-muted-foreground"
            aria-live="polite"
          >
            <Loader2
              className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
            <span className="max-w-[9rem] truncate">{activity || c("Working", "进行中")}</span>
          </span>
        )}
        <InfoTip label={c("About this agent", "这个 Agent 做什么")}>
          {chatAgentAbout(chat.agent, c)}
        </InfoTip>
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
          <Link
            href={`/dashboard/chat/${chat.id}`}
            aria-label={c("Open as full chat", "在完整对话中打开")}
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="-mr-1 h-8 w-8"
          disabled={busy}
          onClick={onRemove}
          aria-label={c("Remove panel (the chat stays)", "移除面板（对话保留）")}
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </header>

      <div ref={scroller} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3">
        {loadFailed ? (
          <p role="alert" className="text-sm text-negative">
            {c("Could not load this chat.", "这个对话加载失败。")}
          </p>
        ) : messages === null ? (
          <p className="text-sm text-muted-foreground">{c("Loading…", "加载中…")}</p>
        ) : messages.length === 0 && !busy ? (
          <p className="text-sm text-muted-foreground">{chatAgentAbout(chat.agent, c)}</p>
        ) : (
          messages.map((message) => (
            <ChatBubble
              key={message.id}
              role={message.role === "user" ? "user" : "assistant"}
              content={message.content}
              symbols={symbols}
              quoteEvidence={message.quote_evidence}
              revenueEvidence={message.revenue_evidence}
              answerCheck={message.answer_check}
            />
          ))
        )}
        {busy && streaming && (
          <ChatBubble role="assistant" content={streaming} isStreaming symbols={symbols} />
        )}
        {error && (
          <p role="alert" className="text-sm text-negative">
            {error}
          </p>
        )}
      </div>

      <form
        className="border-t border-foreground/10 p-2"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="flex items-end gap-2 rounded-xl bg-foreground/[0.04] p-1.5 focus-within:ring-1 focus-within:ring-foreground/20">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            maxLength={4000}
            placeholder={c("Ask this agent", "问这个 Agent")}
            aria-label={c(
              `Message ${CHAT_AGENT_META[chat.agent].en}`,
              `发给${CHAT_AGENT_META[chat.agent].zh}`,
            )}
            className="max-h-32 min-h-[2.25rem] flex-1 resize-none border-transparent bg-transparent px-2 py-1.5 hover:bg-transparent focus-visible:border-transparent focus-visible:bg-transparent"
          />
          {busy ? (
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-8 w-8 shrink-0"
              onClick={stop}
              aria-label={c("Stop", "停止")}
            >
              <Square className="h-3 w-3" aria-hidden="true" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              className="h-8 w-8 shrink-0"
              disabled={!draft.trim()}
              aria-label={c("Send", "发送")}
            >
              <ArrowUp className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </form>
    </article>
  );
}
