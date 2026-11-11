import { findSymbols } from "../../lib/stockMentions";
import { useChatWorkspace } from "../../components/ChatWorkspace";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { CardsSkeleton } from "../../components/Skeletons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import ChatGlassButton from "../../components/native/ChatGlassButton";
import {
  Keyboard,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChatComposer } from "../../components/ChatComposer";
import { useText } from "../../lib/i18n";
import { useTheme } from "../../lib/theme";
import { usePreferences } from "../../state/Preferences";
import { useAuth } from "../../state/Auth";
import { ConfirmAction } from "../../components/ConfirmAction";
import { conversation } from "../../lib/contentApi";
import { quote } from "../../lib/api";
import { demoMode } from "../../lib/config";
import { isSymbol } from "../../lib/models";
import { useResource } from "../../lib/useResource";
import { parseSkills } from "../../lib/chatSkills";
import { sendChat } from "../../lib/stream";
import type { Conversation } from "../../lib/contentTypes";
import { AuthGate, ResourceState, TextBody } from "../../components/Content";
import {
  Backdrop,
  Button,
  Copy,
  Failure,
  Glass,
  phone,
  styles,
} from "../../components/UI";

// Copy applies the app's 0.875 scale, yielding roughly 17pt type on device.
const MESSAGE_SIZE = 19.5;

export default function ChatRoom() {
  return (
    <AuthGate
      skeleton={
        <CardsSkeleton
          count={2}
          lines={[
            { size: 12, width: "30%" },
            { size: 16, width: "60%", lines: 4 },
          ]}
        />
      }
      title="Ask Kolvex"
    >
      <Room />
    </AuthGate>
  );
}
function Room() {
  const params = useLocalSearchParams<{
    id: string;
    ticker?: string;
    /** A first question handed over by the new-chat page. */
    q?: string;
    sources?: string;
    model?: string;
    skills?: string;
  }>();
  const id = params.id;
  const user = useAuth().session!.user.id;
  const ticker =
    typeof params.ticker === "string" && isSymbol(params.ticker)
      ? params.ticker
      : "";
  const resource = useResource(`${user}:${id}`, (signal) =>
    conversation(id, user, signal),
  );
  const market = useResource(`context:${ticker}`, (signal) =>
    ticker && !demoMode ? quote(ticker, signal) : Promise.resolve(null),
  );
  const [model, setModel] = useState(
    typeof params.model === "string" ? params.model : "",
  );
  const [attach, setAttach] = useState(true);
  const [sources] = useState(
    typeof params.sources === "string" && params.sources
      ? params.sources.split(",")
      : ["plaid", "portfolio", "web"],
  );
  const [skills, setSkills] = useState(() => parseSkills(params.skills));
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [partial, setPartial] = useState("");
  const [sent, setSent] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string>();
  const [uncertain, setUncertain] = useState(false);
  const [replacement, setReplacement] = useState<Conversation>();
  const action = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const t = useTheme();
  const text = useText();
  const { locale } = usePreferences();
  const insets = useSafeAreaInsets();
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [composerHeight, setComposerHeight] = useState(96);
  const [keyboard, setKeyboard] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardWillShow", (event) =>
      setKeyboard(event.endCoordinates.height),
    );
    const hide = Keyboard.addListener("keyboardWillHide", () => setKeyboard(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      action.current?.abort();
    };
  }, []);
  async function recover() {
    if (action.current) return;
    const controller = new AbortController();
    action.current = controller;
    setRecovering(true);
    try {
      const current = await conversation(id, user, controller.signal);
      if (!alive.current) return;
      setReplacement(current);
      setUncertain(false);
      setPartial("");
      setSent("");
      setError(undefined);
      if (
        sent &&
        current.messages.filter((message) => message.role === "user").at(-1)
          ?.content === sent
      )
        setInput("");
    } catch (e) {
      if (alive.current)
        setError(e instanceof Error ? e.message : "刷新失败，请重试。");
    } finally {
      action.current = null;
      if (alive.current) setRecovering(false);
    }
  }
  // `again` is the reader's explicit retry of the unconfirmed turn; never automatic.
  async function send(again?: string) {
    const content = (again ?? input).trim();
    if (
      action.current ||
      (uncertain && again === undefined) ||
      !content ||
      content.length > 100000
    )
      return;
    if (!model) {
      setInput(content);
      setError("请先选择模型。");
      return;
    }
    const controller = new AbortController();
    action.current = controller;
    setUncertain(false);
    const deadline = setTimeout(() => controller.abort(), 180000);
    setBusy(true);
    setPartial("");
    setError(undefined);
    setSent(content);
    setStatus("正在连接研究助手…");
    const context =
      attach && market.data
        ? JSON.stringify({
            source: "Kolvex 市场报价",
            symbol: ticker,
            quote: market.data,
          })
        : undefined;
    try {
      await sendChat(
        id,
        user,
        content,
        controller.signal,
        (event) => {
          if (!alive.current) return;
          if (event.type === "token") {
            setPartial((old) => old + (event.content ?? ""));
            setStatus("正在撰写回复…");
          }
          if (event.type === "token_reset") setPartial("");
          if (event.type === "status")
            setStatus(
              (
                {
                  routing: "正在理解问题…",
                  planning: "正在准备研究…",
                  writing: "正在撰写回复…",
                } as Record<string, string>
              )[event.stage ?? ""] ?? "正在研究…",
            );
          if (event.type === "tool_start") setStatus("正在查询资料…");
          if (event.type === "done" && event.content) setPartial(event.content);
        },
        context,
        sources,
        model,
        skills,
      );
      // Reconcile the authoritative history before re-enabling Send. A stream's
      // done event may not guarantee that every storage write succeeded.
      const current = await conversation(id, user, controller.signal);
      if (alive.current) {
        setReplacement(current);
        setSent("");
        setPartial("");
        setInput("");
        setStatus("回复已完成");
      }
    } catch {
      if (alive.current) {
        setUncertain(true);
        setError(
          controller.signal.aborted
            ? "回复已停止。消息可能已保存，请读取最新记录后继续。"
            : "回复未完成。消息可能已保存，请读取最新记录后继续。",
        );
      }
    } finally {
      clearTimeout(deadline);
      action.current = null;
      if (alive.current) setBusy(false);
    }
  }
  const data = replacement ?? resource.data;
  const workspace = useChatWorkspace(id, user);
  // Tickers the reader named in their own questions become links in the answers, as on the Web.
  const knownSymbols = [
    ...new Set(
      (data?.messages ?? [])
        .filter((message) => message.role === "user")
        .flatMap((message) => findSymbols(message.content))
        .concat(sent ? findSymbols(sent) : []),
    ),
  ];
  // The new-chat page's question is sent once, after the conversation has loaded.
  const opening = useRef(false);
  const sendOpening = useEffectEvent((question: string) => void send(question));
  useEffect(() => {
    if (opening.current || !resource.data || typeof params.q !== "string")
      return;
    const question = params.q;
    const empty = !resource.data.messages.length;
    // Deferred out of the effect body; marked done only when it actually runs.
    const timer = setTimeout(() => {
      opening.current = true;
      if (empty) sendOpening(question);
    }, 0);
    return () => clearTimeout(timer);
  }, [resource.data, params.q]);
  const timeOf = (iso?: string) =>
    iso
      ? new Date(iso).toLocaleTimeString(locale === "en" ? "en-US" : "zh-CN", {
          hour: "numeric",
          minute: "2-digit",
        })
      : "";
  const bottom = keyboard ? keyboard + 8 : Math.max(12, insets.bottom) + 4;
  const newChat = () =>
    router.dismissTo({
      pathname: "/chat",
      params: { fresh: Date.now().toString() },
    });
  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      {/* As in ChatGPT, no title: new chat and the workspace sit together on the right. */}
      <Stack.Screen
        options={{
          headerTitle: "",
          ...(Platform.OS !== "ios" && {
            headerRight: () => (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <ChatGlassButton
                  icon="new"
                  label={text("新建对话")}
                  onPress={newChat}
                />
                {workspace.available && (
                  <ChatGlassButton
                    icon={workspace.workspace ? "workspaceFilled" : "workspace"}
                    label={text(workspace.label)}
                    onPress={workspace.press}
                  />
                )}
              </View>
            ),
          }),
        }}
      />
      {Platform.OS === "ios" && (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            icon="square.and.pencil"
            accessibilityLabel={text("新建对话")}
            onPress={newChat}
          />
          <Stack.Toolbar.Button
            icon={workspace.workspace ? "folder.fill" : "folder"}
            accessibilityLabel={text(workspace.label)}
            hidden={!workspace.available}
            disabled={workspace.loading}
            onPress={workspace.press}
          />
        </Stack.Toolbar>
      )}
      {workspace.sheet}
      <ScrollView
        ref={scroll}
        style={{ flex: 1, zIndex: 1 }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        onContentSizeChange={() =>
          scroll.current?.scrollToEnd({ animated: false })
        }
        refreshControl={
          <RefreshControl
            refreshing={recovering}
            onRefresh={() => {
              if (!busy) void recover();
            }}
            tintColor={t.accent}
          />
        }
        contentContainerStyle={{
          paddingLeft: Math.max(14, insets.left),
          paddingRight: Math.max(14, insets.right),
          paddingTop: phone(8),
          paddingBottom: bottom + composerHeight + 16,
          gap: phone(24),
        }}
      >
        <ResourceState
          skeleton={
            <CardsSkeleton
              count={2}
              lines={[
                { size: 12, width: "30%" },
                { size: 16, width: "60%", lines: 4 },
              ]}
            />
          }
          resource={resource}
          empty={false}
          message=""
        />
        {(data?.messages ?? [])
          .filter((message) => message.role !== "system")
          .map((message) =>
            message.role === "user" ? (
              <UserBubble
                key={message.id}
                text={message.content}
                time={timeOf(message.created_at)}
              />
            ) : (
              <Answer key={message.id} time={timeOf(message.created_at)}>
                <TextBody
                  text={message.content}
                  symbols={knownSymbols}
                  size={MESSAGE_SIZE}
                />
              </Answer>
            ),
          )}
        {!!sent && (
          <UserBubble text={sent} time={busy ? "" : text("待核对保存状态")} />
        )}
        {(busy || !!partial) && (
          <Answer time={busy ? status : "未完成的回复，保存状态未确认"} live>
            {!!partial && (
              <TextBody
                text={partial}
                symbols={knownSymbols}
                size={MESSAGE_SIZE}
              />
            )}
          </Answer>
        )}
        {!!error && <Failure message={error} />}
        {uncertain && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Button disabled={recovering} onPress={() => void recover()}>
              {recovering ? "正在读取…" : "读取最新记录"}
            </Button>
            {!!sent && (
              <ConfirmAction
                label="重试"
                description="上一轮可能已保存。重试会再次发送这个问题，并可能重复计费或产生重复消息。"
                disabled={recovering}
                onConfirm={() => void send(sent)}
              />
            )}
          </View>
        )}
        <Copy size={12} muted>
          AI 回复可能有误，请核实来源。对话仅保存在你的账户中。
        </Copy>
      </ScrollView>
      <Backdrop />
      {!uncertain && (
        <View
          onLayout={(event) =>
            setComposerHeight(event.nativeEvent.layout.height)
          }
          style={{
            position: "absolute",
            zIndex: 2,
            left: phone(16),
            right: phone(16),
            bottom,
          }}
        >
          <ChatComposer
            value={input}
            onChange={setInput}
            onSend={() => void send()}
            onStop={() => action.current?.abort()}
            busy={busy}
            disabled={!data || recovering}
            skills={skills}
            onSkills={setSkills}
            model={model}
            onModel={setModel}
            user={user}
            note={
              attach && market.data ? (
                <View style={[styles.row, { gap: 8 }]}>
                  <View style={{ flex: 1 }}>
                    <Copy size={13} muted>{`使用资料 · ${ticker} 报价`}</Copy>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={text("移除报价资料")}
                    hitSlop={10}
                    disabled={busy}
                    onPress={() => setAttach(false)}
                  >
                    <Copy muted localize={false}>
                      ×
                    </Copy>
                  </Pressable>
                </View>
              ) : undefined
            }
          />
        </View>
      )}
    </View>
  );
}

/** The reader's question: a right-aligned glass bubble with its time below. */
function UserBubble({ text, time }: { text: string; time: string }) {
  return (
    <View style={{ alignItems: "flex-end", gap: 4 }}>
      <Glass
        style={{
          maxWidth: "88%",
          paddingHorizontal: 16,
          paddingVertical: 10,
        }}
      >
        <Copy size={MESSAGE_SIZE} localize={false} selectable>
          {text}
        </Copy>
      </Glass>
      {!!time && (
        <Copy size={11} muted localize={false}>
          {time}
        </Copy>
      )}
    </View>
  );
}
/** Kolvex's answer: plain prose on the page, under a "Kolvex · time" line. */
function Answer({
  time,
  live = false,
  children,
}: {
  time: string;
  live?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Copy size={12} bold localize={false}>
          Kolvex
        </Copy>
        <Copy size={12} muted localize={live}>
          {time}
        </Copy>
      </View>
      {children}
    </View>
  );
}
