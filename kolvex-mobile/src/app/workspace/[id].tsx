import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ConfirmAction } from "../../components/ConfirmAction";
import { AuthGate, Field, TextBody } from "../../components/Content";
import { CardsSkeleton } from "../../components/Skeletons";
import {
  Button,
  Chip,
  Copy,
  Failure,
  Glass,
  LoadingStatus,
  Page,
  Section,
  styles,
} from "../../components/UI";
import {
  AGENT_NAMES,
  AgentStatusText,
  RelayBar,
  StanceText,
  TOOL_NAMES,
  formatRunTime,
  workspaceErrorText,
} from "../../components/Workspace";
import { createConversation } from "../../lib/contentApi";
import {
  DEFAULT_RESEARCH_AGENTS,
  RESEARCH_AGENTS,
  attachChat,
  deleteWorkspace,
  getRun,
  getWorkspace,
  parseTickers,
  startRun,
  updateWorkspace,
  workspaceErrorCode,
  type AgentResult,
  type ResearchAgent,
  type ResearchRun,
  type WorkspaceDetail,
} from "../../lib/researchWorkspaceApi";
import { useTheme } from "../../lib/theme";
import { useResource } from "../../lib/useResource";
import { useAuth } from "../../state/Auth";
import { usePreferences } from "../../state/Preferences";

const POLL_MS = 3000;
const skeleton = (
  <CardsSkeleton
    count={3}
    lines={[
      { size: 18, width: "50%" },
      { size: 14, lines: 3 },
    ]}
  />
);

export default function WorkspaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <AuthGate title="工作区" skeleton={skeleton}>
      <Detail key={id} id={String(id)} />
    </AuthGate>
  );
}

function Detail({ id }: { id: string }) {
  const user = useAuth().session!.user.id;
  const { locale } = usePreferences();
  const [revision, setRevision] = useState(0);
  const resource = useResource(
    `workspace:${user}:${id}:${revision}`,
    (signal) => getWorkspace(id, user, signal),
  );
  const detail = resource.data;
  const reload = () => setRevision((v) => v + 1);
  // The run on screen: the one the reader chose, else the newest. Fetched runs are cached.
  const [viewedId, setViewedId] = useState<string | null>(null);
  const [runs, setRuns] = useState<Record<string, ResearchRun>>({});
  const runId = viewedId ?? detail?.latest_run?.id ?? null;
  const run =
    (runId && runs[runId]) ||
    (detail?.latest_run?.id === runId ? detail?.latest_run : null) ||
    null;
  const running = run?.status === "running";
  // Poll the run on screen while it is running.
  useEffect(() => {
    if (!run || run.status !== "running") return;
    const controller = new AbortController();
    const timer = setInterval(() => {
      getRun(run.id, user, controller.signal)
        .then((next) => {
          setRuns((previous) => ({ ...previous, [next.id]: next }));
          if (next.status !== "running") setRevision((v) => v + 1);
        })
        .catch(() => {
          /* keep the last state; the next tick retries */
        });
    }, POLL_MS);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [run, user]);
  const viewRun = (next: string) => {
    setViewedId(next);
    getRun(next, user)
      .then((data) => setRuns((previous) => ({ ...previous, [data.id]: data })))
      .catch(() => {});
  };

  if (!detail)
    return (
      <Page title="工作区">
        {resource.loading ? (
          <LoadingStatus label="正在加载工作区">{skeleton}</LoadingStatus>
        ) : (
          <>
            <Copy>这个工作区不存在或暂时不可用。</Copy>
            <Button onPress={resource.refresh}>重试</Button>
            <Button onPress={() => router.replace("/workspaces")}>
              全部工作区
            </Button>
          </>
        )}
      </Page>
    );
  return (
    <Page
      title={detail.title}
      titleLocalize={false}
      onRefresh={reload}
      refreshing={resource.loading}
    >
      <Header
        detail={detail}
        user={user}
        onSaved={reload}
        onDeleted={() => router.replace("/workspaces")}
      />
      <Launcher
        workspaceId={detail.id}
        user={user}
        running={running}
        onStarted={(created, agents) => {
          // Show queued researchers immediately; polling fills them in.
          setRuns((previous) => ({
            ...previous,
            [created.id]: {
              ...created,
              results: agents.map((agent) => ({
                id: agent,
                agent,
                status: "queued",
                summary: "",
                content: "",
                stance: null,
                confidence: null,
                tools_used: [],
                error: null,
                started_at: null,
                completed_at: null,
              })),
            },
          }));
          setViewedId(created.id);
          reload();
        }}
      />
      {run && <RunView run={run} symbols={detail.tickers} />}
      {detail.runs.length > 1 && (
        <View style={{ gap: 8 }}>
          <Section title="历史研究" />
          <Glass style={{ paddingHorizontal: 16 }}>
            {detail.runs.map((item, index) => (
              <EarlierRun
                key={item.id}
                first={index === 0}
                viewing={item.id === run?.id}
                time={formatRunTime(item.started_at, locale)}
                question={item.question}
                running={item.status === "running"}
                stance={item.stance}
                onPress={() => viewRun(item.id)}
              />
            ))}
          </Glass>
        </View>
      )}
      <Chats detail={detail} user={user} />
    </Page>
  );
}

function Header({
  detail,
  user,
  onSaved,
  onDeleted,
}: {
  detail: WorkspaceDetail;
  user: string;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const t = useTheme();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(detail.title);
  const [tickers, setTickers] = useState(detail.tickers.join(" "));
  const [brief, setBrief] = useState(detail.brief);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateWorkspace(detail.id, user, {
        title: title.trim(),
        brief: brief.trim(),
        tickers: parseTickers(tickers),
      });
      setEditing(false);
      onSaved();
    } catch (e) {
      setError(workspaceErrorCode(e));
    } finally {
      setSaving(false);
    }
  };
  if (editing)
    return (
      <Glass style={{ padding: 16, gap: 12 }}>
        <Field
          label="名称"
          value={title}
          maxLength={120}
          onChangeText={setTitle}
        />
        <Field
          label="股票"
          value={tickers}
          placeholder="NVDA AMD TSM"
          autoCapitalize="characters"
          autoCorrect={false}
          onChangeText={setTickers}
        />
        <Field
          label="研究背景"
          value={brief}
          placeholder="这个工作区要跟踪什么"
          maxLength={4000}
          multiline
          onChangeText={setBrief}
        />
        {!!error && <Failure message={workspaceErrorText(error)} />}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button onPress={() => setEditing(false)}>取消</Button>
          <View style={{ flex: 1 }}>
            <Button
              variant="primary"
              disabled={!title.trim() || saving}
              onPress={() => void save()}
            >
              {saving ? "正在保存…" : "保存"}
            </Button>
          </View>
        </View>
      </Glass>
    );
  return (
    <View style={{ gap: 12 }}>
      {detail.tickers.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {detail.tickers.map((ticker) => (
            <Chip
              key={ticker}
              onPress={() =>
                router.push(`/stock/${encodeURIComponent(ticker)}`)
              }
            >
              {ticker}
            </Chip>
          ))}
        </View>
      )}
      {!!detail.brief && (
        <Copy size={14} muted localize={false}>
          {detail.brief}
        </Copy>
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Button
          onPress={() => {
            setTitle(detail.title);
            setTickers(detail.tickers.join(" "));
            setBrief(detail.brief);
            setEditing(true);
          }}
        >
          编辑工作区
        </Button>
        <ConfirmAction
          label="删除工作区"
          description="删除工作区及全部研究记录？对话会保留。"
          onConfirm={() => {
            setError(null);
            deleteWorkspace(detail.id, user)
              .then(onDeleted)
              .catch((e) => setError(workspaceErrorCode(e)));
          }}
        />
      </View>
      {!!error && (
        <Copy size={14} color={t.negative}>
          {workspaceErrorText(error)}
        </Copy>
      )}
    </View>
  );
}

function Launcher({
  workspaceId,
  user,
  running,
  onStarted,
}: {
  workspaceId: string;
  user: string;
  running: boolean;
  onStarted: (run: ResearchRun, agents: ResearchAgent[]) => void;
}) {
  const [agents, setAgents] = useState<ResearchAgent[]>(
    DEFAULT_RESEARCH_AGENTS,
  );
  const [question, setQuestion] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toggle = (agent: ResearchAgent) =>
    setAgents((previous) =>
      previous.includes(agent)
        ? previous.length === 1
          ? previous
          : previous.filter((a) => a !== agent)
        : RESEARCH_AGENTS.filter((a) => a === agent || previous.includes(a)),
    );
  const start = async () => {
    setStarting(true);
    setError(null);
    try {
      const created = await startRun(workspaceId, user, {
        question: question.trim(),
        agents,
      });
      setQuestion("");
      onStarted(created, agents);
    } catch (e) {
      setError(workspaceErrorCode(e));
    } finally {
      setStarting(false);
    }
  };
  return (
    <Glass style={{ padding: 16, gap: 12 }}>
      <View style={styles.row}>
        <Copy bold>研究团队</Copy>
        <Copy size={12} muted>
          {`已选 ${agents.length}/${RESEARCH_AGENTS.length} 位`}
        </Copy>
      </View>
      <Copy size={12} muted>
        每位研究员各用自己的工具，基于本工作区的股票、背景、问题和对话并行研究，最后由主研究员汇总成结论。结果会保存在这个工作区。
      </Copy>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {RESEARCH_AGENTS.map((agent) => (
          <Chip
            key={agent}
            selected={agents.includes(agent)}
            disabled={running || starting}
            onPress={() => toggle(agent)}
          >
            {AGENT_NAMES[agent]}
          </Chip>
        ))}
      </View>
      <Field
        label="研究问题"
        placeholder="本轮要研究的问题（可选）"
        value={question}
        maxLength={2000}
        multiline
        onChangeText={setQuestion}
      />
      {!!error && <Failure message={workspaceErrorText(error)} />}
      <Button
        variant="primary"
        disabled={running || starting}
        onPress={() => void start()}
      >
        {running || starting ? "研究进行中" : "开始研究"}
      </Button>
    </Glass>
  );
}

function RunView({ run, symbols }: { run: ResearchRun; symbols: string[] }) {
  const t = useTheme();
  const { locale } = usePreferences();
  const results = run.results ?? [];
  const done = results.filter(
    (r) => r.status === "completed" || r.status === "failed",
  ).length;
  return (
    <View style={{ gap: 12 }}>
      <Glass style={{ padding: 16, gap: 12 }}>
        <View style={[styles.row, { justifyContent: "flex-start" }]}>
          <Copy bold>综合结论</Copy>
          <StanceText stance={run.stance} />
          <View style={{ flex: 1 }} />
          <Copy size={12} muted localize={false}>
            {formatRunTime(run.started_at, locale)}
          </Copy>
        </View>
        {!!run.question && (
          <Copy size={14} muted localize={false}>
            {run.question}
          </Copy>
        )}
        {run.status === "running" && (
          <View style={{ gap: 8 }}>
            <RelayBar statuses={results.map((r) => r.status)} />
            <Copy size={12} muted>
              {`${done}/${results.length} 位研究员已完成`}
            </Copy>
          </View>
        )}
        {run.synthesis ? (
          <TextBody text={run.synthesis} symbols={symbols} />
        ) : run.status === "failed" ? (
          <Copy size={14} color={t.negative}>
            这轮研究失败了。
          </Copy>
        ) : run.status !== "running" ? (
          <Copy size={14} muted>
            这轮没有生成综合结论。
          </Copy>
        ) : null}
        {run.status === "partial" && !!run.synthesis && (
          <Copy size={12} color="#C98A00">
            部分研究员失败，结论不完整。
          </Copy>
        )}
      </Glass>
      <Glass style={{ paddingHorizontal: 16 }}>
        {results.map((result, index) => (
          <ResultRow
            key={result.agent}
            result={result}
            symbols={symbols}
            first={index === 0}
          />
        ))}
      </Glass>
    </View>
  );
}

function ResultRow({
  result,
  symbols,
  first,
}: {
  result: AgentResult;
  symbols: string[];
  first: boolean;
}) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const expandable =
    result.status === "completed" || result.status === "failed";
  return (
    <View
      style={{
        paddingVertical: 12,
        gap: 12,
        borderTopWidth: first ? 0 : 1,
        borderColor: t.border,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open, disabled: !expandable }}
        disabled={!expandable}
        onPress={() => setOpen((v) => !v)}
        style={{ flexDirection: "row", gap: 12, minHeight: 44 }}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Copy size={14} bold>
              {AGENT_NAMES[result.agent]}
            </Copy>
            {result.status === "completed" ? (
              <StanceText stance={result.stance} size={12} />
            ) : (
              <AgentStatusText status={result.status} />
            )}
            {result.confidence != null && (
              <Copy size={12} muted localize={false}>
                {`${Math.round(result.confidence * 100)}%`}
              </Copy>
            )}
          </View>
          {result.status === "completed" && !!result.summary && !open && (
            <Copy size={14} muted lines={2} localize={false}>
              {result.summary}
            </Copy>
          )}
          {result.status === "failed" && (
            <Copy size={14} muted>
              这位研究员没能完成。
            </Copy>
          )}
        </View>
        {expandable && (
          <Copy muted localize={false}>
            {open ? "⌃" : "⌄"}
          </Copy>
        )}
      </Pressable>
      {open &&
        (result.status === "completed" ? (
          <View style={{ gap: 8 }}>
            <TextBody text={result.content} symbols={symbols} />
            {result.tools_used.length > 0 && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                <Copy size={12} muted>
                  使用的数据
                </Copy>
                {[...new Set(result.tools_used)].map((name) => (
                  <Copy
                    key={name}
                    size={12}
                    muted
                    localize={!!TOOL_NAMES[name]}
                  >
                    {TOOL_NAMES[name] ?? name}
                  </Copy>
                ))}
              </View>
            )}
          </View>
        ) : (
          <Copy size={12} muted localize={false}>
            {result.error ?? ""}
          </Copy>
        ))}
    </View>
  );
}

function EarlierRun({
  first,
  viewing,
  time,
  question,
  running,
  stance,
  onPress,
}: {
  first: boolean;
  viewing: boolean;
  time: string;
  question: string;
  running: boolean;
  stance: ResearchRun["stance"];
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: viewing }}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minHeight: 48,
        paddingVertical: 8,
        borderTopWidth: first ? 0 : 1,
        borderColor: t.border,
      }}
    >
      <Copy size={12} muted localize={false}>
        {time}
      </Copy>
      <View style={{ flex: 1 }}>
        {question ? (
          <Copy size={14} lines={1} bold={viewing} localize={false}>
            {question}
          </Copy>
        ) : (
          <Copy size={14} lines={1} bold={viewing}>
            工作区研究
          </Copy>
        )}
      </View>
      {running ? (
        <AgentStatusText status="running" />
      ) : (
        <StanceText stance={stance} size={12} />
      )}
    </Pressable>
  );
}

function Chats({ detail, user }: { detail: WorkspaceDetail; user: string }) {
  const t = useTheme();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(false);
  const newChat = async () => {
    setCreating(true);
    setError(false);
    try {
      const conversation = await createConversation(
        user,
        new AbortController().signal,
      );
      await attachChat(detail.id, conversation.id, user);
      router.push(`/chat/${encodeURIComponent(conversation.id)}`);
    } catch {
      setError(true);
    } finally {
      setCreating(false);
    }
  };
  return (
    <View style={{ gap: 8 }}>
      <View style={styles.row}>
        <Section title="对话" />
        <Button disabled={creating} onPress={() => void newChat()}>
          {creating ? "正在创建…" : "新对话"}
        </Button>
      </View>
      {error ? <Failure message="出了点问题，请重试。" /> : null}
      {!detail.chats.length ? (
        <Copy size={14} muted>
          这个工作区还没有对话。
        </Copy>
      ) : (
        <Glass style={{ paddingHorizontal: 16 }}>
          {detail.chats.map((chat, index) => (
            <Pressable
              key={chat.id}
              accessibilityRole="button"
              onPress={() =>
                router.push(`/chat/${encodeURIComponent(chat.id)}`)
              }
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                minHeight: 48,
                paddingVertical: 8,
                borderTopWidth: index ? 1 : 0,
                borderColor: t.border,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <View style={{ flex: 1 }}>
                {chat.title ? (
                  <Copy size={14} lines={1} localize={false}>
                    {chat.title}
                  </Copy>
                ) : (
                  <Copy size={14} lines={1}>
                    未命名对话
                  </Copy>
                )}
              </View>
              <Copy muted localize={false}>
                ›
              </Copy>
            </Pressable>
          ))}
        </Glass>
      )}
    </View>
  );
}
