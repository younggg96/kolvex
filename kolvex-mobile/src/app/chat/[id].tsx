import { useEffect, useRef, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { ModelPicker } from "../../components/ModelPicker";
import { View } from "react-native";
import { useAuth } from "../../state/Auth";
import { ConfirmAction } from "../../components/ConfirmAction";
import { conversation } from "../../lib/contentApi";
import { quote } from "../../lib/api";
import { demoMode } from "../../lib/config";
import { isSymbol } from "../../lib/models";
import { useResource } from "../../lib/useResource";
import { sendChat } from "../../lib/stream";
import type { Conversation } from "../../lib/contentTypes";
import {
  AuthGate,
  Field,
  ResourceState,
  TextBody,
} from "../../components/Content";
import { Button, Copy, Failure, Glass, Page } from "../../components/UI";
export default function ChatRoom() {
  return (
    <AuthGate title="Ask Kolvex">
      <Room />
    </AuthGate>
  );
}
function Room() {
  const params = useLocalSearchParams<{ id: string; ticker?: string }>();
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
  const [model, setModel] = useState("");
  const [attach, setAttach] = useState(true);
  const [sources, setSources] = useState(["web"]);
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
        model || undefined,
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
  return (
    <Page
      followContent
      title="Ask Kolvex"
      subtitle={data?.title}
      subtitleLocalize={false}
      onRefresh={() => {
        if (!busy) void recover();
      }}
      refreshing={recovering}
    >
      <ResourceState resource={resource} empty={false} message="" />
      {(data?.messages ?? [])
        .filter((message) => message.role !== "system")
        .map((message) => (
          <Glass key={message.id} style={{ padding: 20, gap: 12 }}>
            <Copy size={12} muted>
              {message.role === "user" ? "你" : "Kolvex"}
            </Copy>
            <TextBody text={message.content} />
          </Glass>
        ))}
      {!!sent && (
        <Glass style={{ padding: 20, gap: 12 }}>
          <Copy size={12} muted>
            你 · {busy ? "本轮问题" : "待核对保存状态"}
          </Copy>
          <Copy localize={false}>{sent}</Copy>
        </Glass>
      )}
      {(busy || !!partial) && (
        <Glass style={{ padding: 20, gap: 12 }}>
          <Copy size={12} muted>
            Kolvex · {busy ? status : "未完成的回复，保存状态未确认"}
          </Copy>
          {!!partial && <TextBody text={partial} />}
        </Glass>
      )}
      {error && <Failure message={error} />}
      {uncertain && (
        <>
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
        </>
      )}
      {!uncertain && (
        <>
          {attach && market.data && (
            <Glass material style={{ padding: 16, gap: 8 }}>
              <Copy size={12}>已附加 {ticker} 报价资料，仅用于本轮提问。</Copy>
              <Button disabled={busy} onPress={() => setAttach(false)}>
                移除报价资料
              </Button>
            </Glass>
          )}
          <Copy size={12} muted>
            可用资料来源 · 模型沿用服务端默认配置
          </Copy>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {[
              ["web", "网页"],
              ["portfolio", "持仓"],
              ["plaid", "账户交易"],
            ].map(([key, label]) => (
              <Button
                key={key}
                disabled={busy}
                selected={sources.includes(key)}
                onPress={() =>
                  setSources((old) =>
                    old.includes(key)
                      ? old.filter((s) => s !== key)
                      : [...old, key],
                  )
                }
              >
                {label}
              </Button>
            ))}
          </View>
          <ModelPicker
            user={user}
            value={model}
            onChange={setModel}
            disabled={busy}
          />
          <Field
            label="你的问题"
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={100000}
            editable={!busy}
            style={{ minHeight: 120, textAlignVertical: "top" }}
          />
          {busy ? (
            <Button onPress={() => action.current?.abort()}>停止回复</Button>
          ) : (
            <Button
              disabled={!data || !input.trim() || recovering}
              onPress={() => void send()}
            >
              发送问题
            </Button>
          )}
        </>
      )}
      <Copy size={12} muted>
        AI 回复可能有误，请核实来源。对话仅保存在你的账户中。
      </Copy>
    </Page>
  );
}
