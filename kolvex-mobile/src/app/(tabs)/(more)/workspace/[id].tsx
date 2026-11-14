import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { StockBadge } from "../../../../components/StockBadge";
import { AuthGate, Field, TextBody } from "../../../../components/Content";
import { CardsSkeleton } from "../../../../components/Skeletons";
import {
  Button,
  Copy,
  Failure,
  Glass,
  Page,
  phone,
  styles,
} from "../../../../components/UI";
import {
  AGENT_ICONS,
  AGENT_NAMES,
  AgentStatusText,
  RelayBar,
  StanceText,
  TOOL_NAMES,
  formatRunTime,
  workspaceErrorText,
} from "../../../../components/Workspace";
import { createConversation } from "../../../../lib/contentApi";
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
} from "../../../../lib/researchWorkspaceApi";
import { useText } from "../../../../lib/i18n";
import { useTheme } from "../../../../lib/theme";
import { useResource } from "../../../../lib/useResource";
import { useAuth } from "../../../../state/Auth";
import { usePreferences } from "../../../../state/Preferences";

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
  const t = useTheme();
  const text = useText();
  const resource = useResource(`workspace:${user}:${id}`, (signal) =>
    getWorkspace(id, user, signal),
  );
  const detail = resource.data;
  const reload = resource.refresh;
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
          if (next.status !== "running") reload();
        })
        .catch(() => {
          /* keep the last state; the next tick retries */
        });
    }, POLL_MS);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [run, user, reload]);
  const viewRun = (next: string) => {
    setViewedId(next);
    getRun(next, user)
      .then((data) => setRuns((previous) => ({ ...previous, [data.id]: data })))
      .catch(() => {});
  };

  return (
    <Page
      title={detail?.title ?? "工作区"}
      titleLocalize={false}
      hideTitle
      floatingHeader={
        <View>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={text("返回工作区")}
            onPress={() => router.navigate("/workspaces")}
            hitSlop={4}
            style={({ pressed }) => ({
              alignSelf: "flex-start",
              flexDirection: "row",
              alignItems: "center",
              minHeight: phone(44),
              gap: phone(4),
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <SymbolView
              name={{
                ios: "chevron.left",
                android: "chevron_left",
                web: "chevron_left",
              }}
              size={phone(16)}
              tintColor={t.text}
            />
            <Copy size={15}>工作区</Copy>
          </Pressable>
        </View>
      }
      onRefresh={reload}
      refreshing={resource.loading}
    >
      {!detail ? (
        <View style={{ gap: phone(12), paddingTop: phone(16) }}>
          {resource.loading ? (
            <View
              accessibilityRole="progressbar"
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: phone(8),
              }}
            >
              <ActivityIndicator size="small" color={t.secondary} />
              <Copy size={14} muted>
                正在加载工作区
              </Copy>
            </View>
          ) : (
            <>
              <Copy size={14}>这个工作区不存在或暂时不可用。</Copy>
              <Button size="sm" onPress={() => router.navigate("/workspaces")}>
                全部工作区
              </Button>
            </>
          )}
        </View>
      ) : (
        <View style={{ gap: phone(32), marginTop: -phone(4) }}>
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
          <Chats detail={detail} user={user} />
          {run && <RunView run={run} symbols={detail.tickers} />}
          {detail.runs.length > 1 && (
            <View style={{ gap: phone(8) }}>
              <Copy size={14} bold>
                历史研究
              </Copy>
              <Glass clear style={{ paddingHorizontal: 8 }}>
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
        </View>
      )}
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
  const text = useText();
  const [editing, setEditing] = useState(false);
  const [actions, setActions] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
  return (
    <View style={{ gap: phone(12), zIndex: actions ? 2 : undefined }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          gap: phone(8),
          zIndex: 1,
        }}
      >
        <View style={{ flex: 1, minWidth: 0, paddingTop: phone(4) }}>
          <Copy size={18} lineHeight={28} bold localize={false}>
            {detail.title}
          </Copy>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={text("工作区操作")}
          accessibilityState={{ expanded: actions }}
          onPress={() => setActions(!actions)}
          hitSlop={6}
          style={{
            width: phone(36),
            height: phone(36),
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <SymbolView
            name={{ ios: "ellipsis", android: "more_horiz", web: "more_horiz" }}
            size={phone(16)}
            tintColor={t.text}
          />
        </Pressable>
        {actions && (
          <Glass
            material
            style={{
              position: "absolute",
              top: phone(36),
              right: 0,
              padding: 8,
              gap: 4,
              borderRadius: phone(16),
            }}
          >
            <Button
              size="sm"
              onPress={() => {
                setTitle(detail.title);
                setTickers(detail.tickers.join(" "));
                setBrief(detail.brief);
                setActions(false);
                setEditing(true);
              }}
            >
              编辑工作区
            </Button>
            <Button
              size="sm"
              onPress={() => {
                setActions(false);
                setConfirmDelete(true);
              }}
            >
              删除工作区
            </Button>
          </Glass>
        )}
      </View>
      {confirmDelete && (
        <Glass style={{ padding: 12, gap: 8 }}>
          <Copy size={14}>删除工作区及全部研究记录？对话会保留。</Copy>
          <View style={{ flexDirection: "row", gap: phone(4) }}>
            <Button
              size="sm"
              disabled={deleting}
              onPress={() => setConfirmDelete(false)}
            >
              取消
            </Button>
            <Button
              size="sm"
              disabled={deleting}
              onPress={() => {
                setDeleting(true);
                setError(null);
                void deleteWorkspace(detail.id, user)
                  .then(onDeleted)
                  .catch((error) => {
                    setError(workspaceErrorCode(error));
                    setDeleting(false);
                  });
              }}
            >
              删除
            </Button>
          </View>
        </Glass>
      )}
      {editing ? (
        <View style={{ gap: phone(12) }}>
          <Field
            label="名称"
            hideLabel
            placeholder={text("名称")}
            value={title}
            maxLength={120}
            onChangeText={setTitle}
          />
          <Field
            label="股票"
            hideLabel
            value={tickers}
            placeholder="NVDA AMD TSM"
            autoCapitalize="characters"
            autoCorrect={false}
            onChangeText={setTickers}
          />
          <Field
            label="研究背景"
            hideLabel
            value={brief}
            placeholder={text("这个工作区要跟踪什么")}
            maxLength={4000}
            multiline
            onChangeText={setBrief}
          />
          {!!error && <Failure message={workspaceErrorText(error)} />}
          <View
            style={{
              flexDirection: "row",
              gap: phone(8),
              justifyContent: "flex-end",
            }}
          >
            <Button size="sm" onPress={() => setEditing(false)}>
              取消
            </Button>
            <Button
              size="sm"
              variant="primary"
              block={false}
              disabled={!title.trim() || saving}
              onPress={() => void save()}
            >
              {saving ? "正在保存…" : "保存"}
            </Button>
          </View>
        </View>
      ) : (
        <>
          {detail.tickers.length > 0 && (
            <View
              style={{ flexDirection: "row", flexWrap: "wrap", gap: phone(8) }}
            >
              {detail.tickers.map((ticker) => (
                <StockBadge key={ticker} symbol={ticker} />
              ))}
            </View>
          )}
          {!!detail.brief && (
            <Copy size={14} muted localize={false}>
              {detail.brief}
            </Copy>
          )}
        </>
      )}
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
  const t = useTheme();
  const text = useText();
  const [agents, setAgents] = useState<ResearchAgent[]>(
    DEFAULT_RESEARCH_AGENTS,
  );
  const [question, setQuestion] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
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
    <View style={{ gap: phone(10) }}>
      <View style={styles.row}>
        <View
          style={{ flexDirection: "row", gap: phone(6), alignItems: "center" }}
        >
          <Copy size={14} bold>
            研究团队
          </Copy>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={text("研究是怎么进行的")}
            accessibilityState={{ expanded: showInfo }}
            onPress={() => setShowInfo(!showInfo)}
            hitSlop={10}
          >
            <SymbolView
              name={{ ios: "info.circle", android: "info", web: "info" }}
              size={phone(14)}
              tintColor={t.secondary}
            />
          </Pressable>
        </View>
        <Copy size={12} muted>
          {`已选 ${agents.length}/${RESEARCH_AGENTS.length} 位`}
        </Copy>
      </View>
      {showInfo && (
        <Glass material style={{ padding: 12 }}>
          <Copy size={12} muted>
            每位研究员各用自己的工具，基于本工作区的股票、背景、问题和对话并行研究，最后由主研究员汇总成结论。结果会保存在这个工作区。
          </Copy>
        </Glass>
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: phone(6) }}>
        {RESEARCH_AGENTS.map((agent) => {
          const selected = agents.includes(agent);
          return (
            <Pressable
              key={agent}
              accessibilityRole="button"
              accessibilityLabel={text(AGENT_NAMES[agent])}
              accessibilityState={{ selected, disabled: running || starting }}
              disabled={running || starting}
              onPress={() => toggle(agent)}
              hitSlop={{ top: 4, bottom: 4 }}
              style={({ pressed }) => ({
                opacity: pressed ? 0.6 : selected ? 1 : 0.7,
              })}
            >
              <Glass
                style={{
                  borderRadius: 999,
                  flexDirection: "row",
                  alignItems: "center",
                  minHeight: phone(26),
                  gap: 6,
                  paddingHorizontal: 10,
                }}
              >
                {selected ? (
                  <SymbolView
                    name={{ ios: "checkmark", android: "check", web: "check" }}
                    size={phone(14)}
                    tintColor={t.text}
                  />
                ) : (
                  <SymbolView
                    name={
                      {
                        ios: AGENT_ICONS[agent][0],
                        android: AGENT_ICONS[agent][1],
                        web: AGENT_ICONS[agent][1],
                      } as never
                    }
                    size={phone(14)}
                    tintColor={t.secondary}
                  />
                )}
                <Copy size={13} bold>
                  {AGENT_NAMES[agent]}
                </Copy>
              </Glass>
            </Pressable>
          );
        })}
      </View>
      <Glass clear style={{ padding: 8, gap: 6, borderRadius: phone(16) }}>
        <TextInput
          accessibilityLabel={text("研究问题")}
          placeholder={text("本轮要研究的问题（可选）")}
          placeholderTextColor={t.secondary}
          value={question}
          maxLength={2000}
          multiline
          onChangeText={setQuestion}
          style={{
            minHeight: phone(76),
            borderRadius: phone(12),
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: t.rim,
            fontSize: phone(16),
            color: t.text,
            padding: phone(10),
            textAlignVertical: "top",
          }}
        />
        {!!error && (
          <Copy size={12} color={t.negative}>
            {workspaceErrorText(error)}
          </Copy>
        )}
        <View style={{ alignSelf: "flex-end" }}>
          <Button
            size="sm"
            variant="primary"
            block={false}
            label={running || starting ? "研究进行中" : "开始研究"}
            disabled={running || starting}
            onPress={() => void start()}
            icon={
              running || starting ? (
                <ActivityIndicator size="small" color={t.onBrand} />
              ) : (
                <SymbolView
                  name={{
                    ios: "play",
                    android: "play_arrow",
                    web: "play_arrow",
                  }}
                  size={phone(14)}
                  tintColor={t.onBrand}
                />
              )
            }
          >
            {running || starting ? "研究进行中" : "开始研究"}
          </Button>
        </View>
      </Glass>
    </View>
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
    <View style={{ gap: phone(12) }}>
      <Glass clear style={{ padding: 16, gap: 12 }}>
        <View style={[styles.row, { justifyContent: "flex-start" }]}>
          <Copy size={14} bold>
            综合结论
          </Copy>
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
          <TextBody
            text={run.synthesis}
            symbols={symbols}
            size={14}
            lineHeight={24}
            gap={phone(6)}
          />
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
      <Glass clear style={{ paddingHorizontal: 8 }}>
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
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 12,
          minHeight: 44,
        }}
      >
        <View
          style={{
            width: phone(32),
            height: phone(32),
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: t.wash,
          }}
        >
          <SymbolView
            name={
              {
                ios: AGENT_ICONS[result.agent][0],
                android: AGENT_ICONS[result.agent][1],
                web: AGENT_ICONS[result.agent][1],
              } as never
            }
            size={phone(16)}
            tintColor={t.text}
          />
        </View>
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
          <SymbolView
            name={{
              ios: open ? "chevron.up" : "chevron.down",
              android: open ? "expand_less" : "expand_more",
              web: open ? "expand_less" : "expand_more",
            }}
            size={phone(16)}
            tintColor={t.secondary}
            style={{ marginTop: phone(8) }}
          />
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
  const text = useText();
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
    <Glass clear style={{ padding: 16, gap: 12 }}>
      <View style={styles.row}>
        <Copy size={14} bold>
          对话
        </Copy>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={text("新对话")}
          disabled={creating}
          onPress={() => void newChat()}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: phone(4),
            opacity: creating ? 0.5 : pressed ? 0.6 : 1,
          })}
        >
          <SymbolView
            name={{
              ios: "square.and.pencil",
              android: "edit_note",
              web: "edit_note",
            }}
            size={phone(14)}
            tintColor={t.secondary}
          />
          <Copy size={13} muted>
            {creating ? "正在创建…" : "新对话"}
          </Copy>
        </Pressable>
      </View>
      {error ? <Failure message="出了点问题，请重试。" /> : null}
      {!detail.chats.length ? (
        <Copy size={14} muted>
          这个工作区还没有对话。
        </Copy>
      ) : (
        detail.chats.map((chat, index) => (
          <Pressable
            key={chat.id}
            accessibilityRole="button"
            onPress={() => router.push(`/chat/${encodeURIComponent(chat.id)}`)}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: phone(10),
              minHeight: phone(36),
              paddingTop: index ? phone(12) : 0,
              borderTopWidth: index ? 1 : 0,
              borderColor: t.border,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <SymbolView
              name={{
                ios: "bubble.left",
                android: "chat_bubble_outline",
                web: "chat_bubble_outline",
              }}
              size={phone(14)}
              tintColor={t.secondary}
            />
            <View style={{ flex: 1 }}>
              {chat.title ? (
                <Copy size={14} lines={1} localize={false}>
                  {chat.title}
                </Copy>
              ) : (
                <Copy size={14} lines={1} muted>
                  未命名对话
                </Copy>
              )}
            </View>
          </Pressable>
        ))
      )}
    </Glass>
  );
}
