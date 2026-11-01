import { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "../../state/Auth";
import { conversations, createConversation } from "../../lib/contentApi";
import { useResource } from "../../lib/useResource";
import { AuthGate, Pager, ResourceState } from "../../components/Content";
import { Button, Copy, Failure, Glass, Page } from "../../components/UI";
import { isSymbol } from "../../lib/models";
export default function Chats() {
  return (
    <AuthGate title="Ask Kolvex">
      <Library />
    </AuthGate>
  );
}
function Library() {
  const user = useAuth().session!.user.id;
  const { ticker } = useLocalSearchParams<{ ticker?: string }>();
  const symbol =
    typeof ticker === "string" && isSymbol(ticker) ? ticker : undefined;
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const action = useRef<AbortController | null>(null);
  const resource = useResource(`${user}:${page}`, (signal) =>
    conversations(user, signal, page),
  );
  const rows = resource.data?.conversations ?? [];
  useEffect(() => () => action.current?.abort(), []);
  async function create() {
    if (action.current) return;
    const controller = new AbortController();
    action.current = controller;
    setBusy(true);
    setError(undefined);
    try {
      const item = await createConversation(user, controller.signal);
      if (!controller.signal.aborted) {
        resource.refresh();
        router.push({
          pathname: "/chat/[id]",
          params: { id: item.id, ...(symbol ? { ticker: symbol } : {}) },
        });
      }
    } catch (e) {
      if (!controller.signal.aborted)
        setError(
          e instanceof Error ? e.message : "创建未确认，请刷新列表检查。",
        );
    } finally {
      action.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <Page
      title="Ask Kolvex"
      subtitle="用一个问题，开始你的研究。"
      onRefresh={resource.refresh}
      refreshing={resource.loading && !!resource.data}
    >
      {symbol && <Copy>新对话可附加 {symbol} 的真实报价作为本轮资料。</Copy>}
      <Button disabled={busy} onPress={() => void create()}>
        {busy ? "正在创建…" : "新建对话"}
      </Button>
      {error && <Failure message={error} retry={resource.refresh} />}
      <ResourceState
        resource={resource}
        empty={!rows.length}
        message="还没有对话。新建对话后，可以查询市场、研究公司或理解已有持仓。"
      />
      {rows.map((item) => (
        <Glass key={item.id} style={{ padding: 20, gap: 12 }}>
          <Copy bold>{item.title}</Copy>
          <Copy size={12} muted>
            {new Date(item.updated_at).toLocaleString("zh-CN")}
          </Copy>
          <Button
            onPress={() => router.push(`/chat/${encodeURIComponent(item.id)}`)}
          >
            继续对话
          </Button>
        </Glass>
      ))}
      <Pager
        page={page}
        hasMore={page * 20 < (resource.data?.total ?? 0)}
        loading={resource.loading}
        onChange={setPage}
      />
    </Page>
  );
}
