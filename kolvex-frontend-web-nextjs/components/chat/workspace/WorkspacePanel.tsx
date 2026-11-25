"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  Loader2,
  MessageSquare,
  MessageSquarePlus,
  MoreHorizontal,
  Pencil,
  Play,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChipButton } from "@/components/ui/chip-button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InfoTip } from "@/components/ui/info-tip";
import { Input } from "@/components/ui/input";
import { ListCard, ListRow, ListRows } from "@/components/ui/list-card";
import StockBadge from "@/components/ui/stock-badge";
import { Textarea } from "@/components/ui/textarea";
import { useCopy } from "@/components/decision/shared";
import { useAiAssistantSettings } from "@/lib/aiAssistantSettings";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  DEFAULT_RESEARCH_AGENTS,
  MAX_RESEARCH_AGENTS,
  RESEARCH_AGENTS,
  SPECIALIST_RESEARCH_AGENTS,
  parseTickers,
  type AgentResult,
  type ResearchAgent,
  type ResearchRun,
} from "@/lib/researchWorkspaceApi";
import { AnswerCheckNote } from "../AnswerCheckNote";
import { AgentDesk } from "./AgentDesk";
import type { ChatWorkspace } from "./useChatWorkspace";
import { workspaceErrorCode } from "./useChatWorkspace";
import {
  AGENT_META,
  AgentStatusText,
  RelayBar,
  ResearchMarkdown,
  StanceText,
  agentName,
  formatRunTime,
  workspaceErrorText,
} from "./parts";

type Copy = (en: string, zh: string) => string;

/** Research-only tools that the chat locale files do not label. */
const TOOL_COPY: Record<string, [string, string]> = {
  get_options_chain_summary: ["Options chain", "期权链"],
  get_technical_indicators: ["Technical indicators", "技术指标"],
  get_creator_opinions: ["Creator opinions", "博主观点库"],
  get_creator_record: ["Price moves after a creator's opinions", "博主观点后股价"],
  web_search: ["Web search", "网页搜索"],
  get_user_portfolio: ["Portfolio", "投资组合"],
};

export function WorkspacePanel({
  workspace,
  conversationId,
  model,
  onDeleted,
  className,
}: {
  workspace: ChatWorkspace;
  /** The chat this panel sits beside; omitted on the workspace page. */
  conversationId?: string;
  model?: string;
  onDeleted?: () => void;
  className?: string;
}) {
  const c = useCopy();
  const router = useRouter();
  const [creatingChat, setCreatingChat] = useState(false);
  const { locale } = useTranslation();
  const detail = workspace.detail;
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setEditing(false);
    setConfirmDelete(false);
  }, [detail?.id]);

  if (!detail) return null;
  const run = workspace.run;
  const running = run?.status === "running";
  const chats = detail.chats.filter((chat) => !chat.agent);
  // Without a chat beside it, the panel is the whole workspace page and gets a two-column
  // layout. Decided by where it is mounted, not by viewport width: the chat side panel is
  // narrow even on wide screens.
  const isPage = !conversationId;

  const header = (
    <header className="space-y-3">
      <div className="flex items-start gap-2">
        <h2 className="min-w-0 flex-1 text-lg font-semibold leading-7 text-foreground [overflow-wrap:anywhere]">
          {detail.title}
        </h2>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="-mr-2 shrink-0"
              aria-label={c("Workspace actions", "工作区操作")}
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setEditing(true)}>
              <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
              {c("Edit workspace", "编辑工作区")}
            </DropdownMenuItem>
            {conversationId && (
              <DropdownMenuItem onSelect={() => void workspace.leave()}>
                <MessageSquare className="mr-2 h-4 w-4" aria-hidden="true" />
                {c("Remove this chat", "移出此对话")}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-negative focus:text-negative"
              onSelect={() => setConfirmDelete(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
              {c("Delete workspace", "删除工作区")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {confirmDelete && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-foreground/[0.04] px-3 py-2.5"
        >
          <p className="text-sm text-foreground">
            {c(
              "Delete it and all its research? Chats stay.",
              "删除工作区及全部研究记录？对话会保留。",
            )}
          </p>
          <div className="flex gap-1">
            <Button variant="ghost" size="xs" onClick={() => setConfirmDelete(false)}>
              {c("Cancel", "取消")}
            </Button>
            <Button
              variant="destructive"
              size="xs"
              onClick={async () => {
                await workspace.remove();
                onDeleted?.();
              }}
            >
              {c("Delete", "删除")}
            </Button>
          </div>
        </div>
      )}

      {editing ? (
        <EditWorkspace workspace={workspace} onDone={() => setEditing(false)} c={c} />
      ) : (
        <>
          {detail.tickers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {detail.tickers.map((ticker) => (
                <StockBadge key={ticker} symbol={ticker} />
              ))}
            </div>
          )}
          {detail.brief && (
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{detail.brief}</p>
          )}
        </>
      )}
    </header>
  );

  // The question for the next round comes first; the round being viewed reads below it.
  const research = (
    <>
      <ResearchLauncher workspace={workspace} model={model} running={running} c={c} />
      {run && <RunView run={run} c={c} locale={locale} symbols={detail.tickers} />}
    </>
  );

  const chatList = (
    <section>
      <Card className="space-y-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">{c("Chats", "对话")}</h3>
          <Button
            variant="ghost"
            size="xs"
            className="-mr-2 gap-1.5 text-muted-foreground hover:text-foreground"
            disabled={creatingChat}
            onClick={async () => {
              setCreatingChat(true);
              try {
                const id = await workspace.newChat();
                if (id) router.push(`/dashboard/chat/${id}`);
              } finally {
                setCreatingChat(false);
              }
            }}
          >
            {creatingChat ? (
              <Loader2
                className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : (
              <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {c("New chat", "新对话")}
          </Button>
        </div>
        {chats.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {c("No chats in this workspace yet.", "这个工作区还没有对话。")}
          </p>
        ) : (
          <ListRows className="-mx-2 max-md:mx-0">
            {chats.map((chat) => (
              <ListRow
                key={chat.id}
                className={cn(chat.id === conversationId && "bg-foreground/[0.06]")}
              >
                <Link
                  href={`/dashboard/chat/${chat.id}`}
                  aria-current={chat.id === conversationId ? "page" : undefined}
                  className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-2xl px-2 py-2 focus-visible:outline-none"
                >
                  <MessageSquare
                    className="h-4 w-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {chat.title || c("Untitled chat", "未命名对话")}
                  </span>
                </Link>
              </ListRow>
            ))}
          </ListRows>
        )}
      </Card>
    </section>
  );

  // Every round, newest first; the one on screen is marked. Two lines per row so the
  // question keeps its width in the narrow rail.
  const history = detail.runs.length > 1 && (
    <section>
      <Card className="space-y-2 p-4">
        <h3 className="text-sm font-semibold text-foreground">
          {c("Research rounds", "历史研究")}
        </h3>
        <ListRows className="-mx-2 max-md:mx-0">
          {detail.runs.map((item) => {
            const viewing = item.id === run?.id;
            return (
              <ListRow key={item.id} className={cn(viewing && "bg-foreground/[0.06]")}>
                <button
                  type="button"
                  onClick={() => void workspace.viewRun(item.id)}
                  aria-current={viewing ? "true" : undefined}
                  className="flex min-h-11 min-w-0 flex-1 flex-col gap-0.5 rounded-2xl px-2 py-2 text-left focus-visible:outline-none"
                >
                  <span className="line-clamp-2 text-sm text-foreground">
                    {item.question || c("Workspace research", "工作区研究")}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="figure text-xs text-muted-foreground">
                      {formatRunTime(item.started_at, locale)}
                    </span>
                    {item.status === "running" ? (
                      <AgentStatusText status="running" c={c} />
                    ) : (
                      <StanceText stance={item.stance} c={c} className="text-xs" />
                    )}
                  </span>
                </button>
              </ListRow>
            );
          })}
        </ListRows>
      </Card>
    </section>
  );

  if (!isPage) {
    return (
      <div className={cn("w-full min-w-0 space-y-8 px-4 pb-10 pt-5 md:px-5", className)}>
        {header}
        {research}
        {chatList}
        {history}
      </div>
    );
  }

  // Page: the work (next round, current round, agent panels) on the left; what to switch
  // to (chats, earlier rounds) in a sticky rail on the right. Stacks below lg.
  return (
    <div className={cn("mx-auto w-full min-w-0 max-w-[100rem] px-4 pb-10 pt-5 md:px-5", className)}>
      {header}
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-8">
          {research}
          <AgentDesk workspace={workspace} model={model} />
        </div>
        <aside
          aria-label={c("Chats and research rounds", "对话和历史研究")}
          className="min-w-0 space-y-4 lg:sticky lg:top-4 lg:self-start"
        >
          {chatList}
          {history}
        </aside>
      </div>
    </div>
  );
}

function EditWorkspace({
  workspace,
  onDone,
  c,
}: {
  workspace: ChatWorkspace;
  onDone: () => void;
  c: Copy;
}) {
  const detail = workspace.detail!;
  const [title, setTitle] = useState(detail.title);
  const [tickers, setTickers] = useState(detail.tickers.join(" "));
  const [brief, setBrief] = useState(detail.brief);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        setError(null);
        try {
          await workspace.save({
            title: title.trim(),
            brief,
            tickers: parseTickers(tickers),
          });
          onDone();
        } catch (err) {
          setError(workspaceErrorCode(err));
        } finally {
          setSaving(false);
        }
      }}
    >
      <Input
        aria-label={c("Name", "名称")}
        value={title}
        maxLength={120}
        onChange={(e) => setTitle(e.target.value)}
      />
      <Input
        aria-label={c("Tickers", "股票")}
        value={tickers}
        placeholder="NVDA AMD TSM"
        spellCheck={false}
        autoCapitalize="characters"
        onChange={(e) => setTickers(e.target.value)}
      />
      <Textarea
        aria-label={c("Research brief", "研究背景")}
        value={brief}
        maxLength={4000}
        rows={3}
        placeholder={c("What this workspace is tracking", "这个工作区要跟踪什么")}
        onChange={(e) => setBrief(e.target.value)}
      />
      {error && (
        <p role="alert" className="text-xs text-negative">
          {workspaceErrorText(error, c)}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="xs" onClick={onDone}>
          {c("Cancel", "取消")}
        </Button>
        <Button type="submit" size="xs" disabled={!title.trim() || saving}>
          {c("Save", "保存")}
        </Button>
      </div>
    </form>
  );
}

function ResearchLauncher({
  workspace,
  model,
  running,
  c,
}: {
  workspace: ChatWorkspace;
  model?: string;
  running: boolean;
  c: Copy;
}) {
  const settings = useAiAssistantSettings();
  const [agents, setAgents] = useState<ResearchAgent[]>(DEFAULT_RESEARCH_AGENTS);
  // Specialists the user switched off in AI settings stay off here too.
  const specialists = SPECIALIST_RESEARCH_AGENTS.filter(
    (agent) => !settings.disabledAgents.includes(agent),
  );
  const order: ResearchAgent[] = [...RESEARCH_AGENTS, ...specialists];
  const full = agents.length >= MAX_RESEARCH_AGENTS;
  const [question, setQuestion] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** A textarea in a narrow side panel takes every Enter for a new line; ⌘/Ctrl+Enter starts. */
  const startOnModEnter = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && !running && !starting) {
      event.preventDefault();
      void start();
    }
  };

  const start = async () => {
    setStarting(true);
    setError(null);
    try {
      await workspace.start(question.trim(), agents, model);
      setQuestion("");
    } catch (err) {
      setError(workspaceErrorCode(err));
    } finally {
      setStarting(false);
    }
  };

  const toggle = (agent: ResearchAgent) =>
    setAgents((prev) =>
      prev.includes(agent)
        ? prev.length === 1
          ? prev
          : prev.filter((a) => a !== agent)
        : prev.length >= MAX_RESEARCH_AGENTS
          ? prev
          : order.filter((a) => a === agent || prev.includes(a)),
    );

  const chip = (agent: ResearchAgent) => {
    const on = agents.includes(agent);
    const Icon = AGENT_META[agent].icon;
    return (
      <ChipButton
        key={agent}
        type="button"
        variant={on ? "primary" : "outline"}
        size="sm"
        aria-pressed={on}
        disabled={running || starting || (!on && full)}
        onClick={() => toggle(agent)}
        className={cn(!on && "opacity-70 hover:opacity-100")}
        icon={
          on ? (
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          )
        }
      >
        {agentName(agent, c)}
      </ChipButton>
    );
  };

  // One hairline card groups the question and the action, so the launcher reads as a
  // single form instead of three full-bleed bands.
  return (
    <section className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <h3 className="text-sm font-semibold text-foreground">
            {c("Research team", "研究团队")}
          </h3>
          <InfoTip label={c("How research works", "研究是怎么进行的")}>
            {c(
              `Pick up to ${MAX_RESEARCH_AGENTS}. The first group covers the basics; the second adds specialists such as earnings or valuation. Each works in parallel with its own tools on this workspace's tickers, brief, question and chats, then a lead researcher combines their notes. Results are saved to this workspace.`,
              `最多选 ${MAX_RESEARCH_AGENTS} 位。第一组是基础研究员，第二组是财报、估值等专项研究员。每位各用自己的工具，基于本工作区的股票、背景、问题和对话并行研究，最后由主研究员汇总成结论。结果会保存在这个工作区。`,
            )}
          </InfoTip>
        </div>
        <span className="figure text-xs text-muted-foreground">
          {c(
            `${agents.length} of ${MAX_RESEARCH_AGENTS} selected`,
            `已选 ${agents.length}/${MAX_RESEARCH_AGENTS} 位`,
          )}
        </span>
      </div>

      <div className="space-y-1.5" role="group" aria-label={c("Researchers", "研究员")}>
        <div className="flex flex-wrap gap-1.5">{RESEARCH_AGENTS.map(chip)}</div>
        {specialists.length > 0 && (
          <div className="flex flex-wrap gap-1.5">{specialists.map(chip)}</div>
        )}
      </div>

      <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.04] p-2 focus-within:border-foreground/25">
        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={startOnModEnter}
          maxLength={2000}
          rows={2}
          className="min-h-[3.5rem] resize-none rounded-xl border-transparent bg-transparent px-2 py-1.5 hover:bg-transparent focus-visible:border-transparent focus-visible:bg-transparent"
          placeholder={c("Question for this round (optional)", "本轮要研究的问题（可选）")}
          aria-label={c("Research question", "研究问题")}
        />
        <div className="mt-1.5 flex items-center justify-between gap-3">
          <span className="hidden text-[0.6875rem] text-muted-foreground sm:block">
            {c("⌘Enter to start", "⌘Enter 开始")}
          </span>
          {error ? (
            <p role="alert" className="text-xs text-negative [overflow-wrap:anywhere]">
              {workspaceErrorText(error, c)}
            </p>
          ) : (
            <span className="sr-only" aria-live="polite">
              {running ? c("Research in progress", "研究进行中") : ""}
            </span>
          )}
          <Button
            size="sm"
            className="ml-auto shrink-0 gap-1.5"
            disabled={running || starting}
            onClick={start}
          >
            {running || starting ? (
              <Loader2
                className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : (
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {running ? c("Researching", "研究进行中") : c("Start research", "开始研究")}
          </Button>
        </div>
      </div>
    </section>
  );
}

function RunView({
  run,
  c,
  locale,
  symbols,
}: {
  run: ResearchRun;
  c: Copy;
  locale: string;
  symbols: string[];
}) {
  const results = run.results ?? [];
  const done = results.filter((r) => r.status === "completed" || r.status === "failed").length;

  return (
    <section className="space-y-3" aria-live="polite">
      <Card className="space-y-3 p-4">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-foreground">
            {run.status === "running"
              ? c("Team research", "团队研究")
              : c("Conclusion", "综合结论")}
          </h3>
          <StanceText stance={run.stance} c={c} />
          <span className="figure ml-auto text-xs text-muted-foreground">
            {formatRunTime(run.started_at, locale)}
          </span>
        </div>
        {run.question && <p className="text-sm text-muted-foreground">{run.question}</p>}
        {run.status === "running" && (
          <div className="space-y-2">
            <RelayBar
              statuses={results.map((r) => r.status)}
              label={c("Researchers finished", "已完成的研究员")}
            />
            <p className="figure text-xs text-muted-foreground">
              {done === results.length
                ? c("Combining the findings…", "正在汇总研究结果…")
                : c(
                    `${done} of ${results.length} researchers finished`,
                    `${done}/${results.length} 位研究员已结束`,
                  )}
            </p>
          </div>
        )}
        {run.synthesis ? (
          <>
            <ResearchMarkdown symbols={symbols}>{run.synthesis}</ResearchMarkdown>
            {run.answer_check && <AnswerCheckNote check={run.answer_check} />}
          </>
        ) : run.status === "failed" ? (
          <p className="text-sm text-negative">
            {c("This research run failed.", "这轮研究失败了。")}
          </p>
        ) : run.status !== "running" ? (
          <p className="text-sm text-muted-foreground">
            {c("No combined conclusion for this run.", "这轮没有生成综合结论。")}
          </p>
        ) : null}
        {run.status === "partial" && run.synthesis && (
          <p className="text-xs text-warning">
            {c(
              "Some researchers failed; the conclusion is incomplete.",
              "部分研究员失败，结论不完整。",
            )}
          </p>
        )}
      </Card>

      <ListCard className="p-1.5 sm:p-2">
        <ListRows>
          {results.map((result) => (
            <ResultRow key={result.agent} result={result} c={c} symbols={symbols} />
          ))}
        </ListRows>
      </ListCard>
    </section>
  );
}

function ResultRow({ result, c, symbols }: { result: AgentResult; c: Copy; symbols: string[] }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const toolLabel = (name: string) => {
    const local = TOOL_COPY[name];
    if (local) return c(local[0], local[1]);
    const key = `chat.tools.${name}`;
    const label = t(key);
    return label === key ? t("chat.tools.generic") : label;
  };
  const Icon = AGENT_META[result.agent].icon;
  const expandable = result.status === "completed" || result.status === "failed";

  return (
    <Collapsible asChild open={open} onOpenChange={setOpen}>
      <li className="rounded-2xl transition-colors">
        <CollapsibleTrigger
          disabled={!expandable}
          className="flex w-full items-start gap-3 rounded-2xl px-2.5 py-3 text-left focus-visible:outline-none disabled:cursor-default"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground/[0.06]">
            <Icon className="h-4 w-4 text-foreground" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1 space-y-1 pt-1">
            <span className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                {agentName(result.agent, c)}
              </span>
              {result.status === "completed" ? (
                <StanceText stance={result.stance} c={c} className="text-xs" />
              ) : (
                <AgentStatusText status={result.status} c={c} />
              )}
              {result.confidence != null && (
                <span className="figure text-xs text-muted-foreground">
                  {Math.round(result.confidence * 100)}%
                </span>
              )}
            </span>
            {result.status === "completed" && result.summary && !open && (
              <span className="block text-sm leading-6 text-muted-foreground line-clamp-2">
                {result.summary}
              </span>
            )}
            {result.status === "failed" && (
              <span className="block text-sm text-muted-foreground">
                {c("This researcher could not finish.", "这位研究员没能完成。")}
              </span>
            )}
          </span>
          {expandable && (
            <ChevronDown
              className={cn(
                "mt-2 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none",
                open && "rotate-180",
              )}
              aria-hidden="true"
            />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent className="mb-3 pl-[3.375rem] pr-2.5">
          {result.status === "completed" ? (
            <div className="space-y-3">
              <ResearchMarkdown symbols={symbols}>{result.content}</ResearchMarkdown>
              {result.answer_check && <AnswerCheckNote check={result.answer_check} />}
              {result.tools_used.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {c("Data used", "使用的数据")}:{" "}
                  <span>{Array.from(new Set(result.tools_used)).map(toolLabel).join(" · ")}</span>
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{result.error}</p>
          )}
        </CollapsibleContent>
      </li>
    </Collapsible>
  );
}
