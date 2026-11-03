import { useEffect, useState } from "react";
import { router } from "expo-router";
import { apiRequest } from "../lib/http";
import { profile } from "../lib/contentApi";
import { useAuth } from "../state/Auth";
import { useResource } from "../lib/useResource";
import { useMutation } from "../lib/useMutation";
import { calendarDate } from "../lib/technicalData";
import { isSymbol } from "../lib/models";
import type { TradingAnalysis } from "../lib/contentTypes";
import { Page, Copy, Button, Glass, Section } from "../components/UI";
import {
  AuthGate,
  Field,
  Filters,
  Pager,
  ResourceState,
} from "../components/Content";
import { ModelPicker } from "../components/ModelPicker";
import { MODEL_CONFIGS, providerId } from "../lib/aiModels";
import { MutationStatus } from "../components/MutationStatus";
export default function Tasks() {
  return (
    <AuthGate title="我的研究任务">
      <AdminOnly />
    </AuthGate>
  );
}
// The Web only offers research authoring to administrators.
function AdminOnly() {
  const user = useAuth().session!.user.id;
  const account = useResource(`tasks-profile:${user}`, (signal) =>
    profile(user, signal),
  );
  if (account.data?.is_admin) return <Library />;
  return (
    <Page title="我的研究任务" onRefresh={account.refresh}>
      <ResourceState
        resource={account}
        empty={!!account.data}
        message="当前账户没有访问此内容的权限。"
      />
    </Page>
  );
}
function Library() {
  const user = useAuth().session!.user.id;
  const [ticker, setTicker] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [model, setModel] = useState("");
  const [analysts, setAnalysts] = useState([
    "market",
    "social",
    "news",
    "fundamentals",
  ]);
  const [rounds, setRounds] = useState("1");
  const [page, setPage] = useState(1);
  const r = useResource(`tasks:${user}:${page}`, (signal) =>
    apiRequest<{ items: TradingAnalysis[]; total: number }>(
      `/trading-analysis/history?limit=20&offset=${(page - 1) * 20}`,
      { signal, authenticated: true, expectedUser: user },
    ),
  );
  const m = useMutation();
  const running = r.data?.items.some((i) =>
    ["running", "pending"].includes(i.status),
  );
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(r.refresh, 5000);
    return () => clearInterval(timer);
  }, [running, r.refresh]);
  return (
    <Page title="我的研究任务" onRefresh={r.refresh} refreshing={r.loading}>
      <Section title="创建研究" />
      <Field
        editable={!m.busy}
        label="股票代码"
        value={ticker}
        onChangeText={(v) => setTicker(v.toUpperCase())}
        autoCapitalize="characters"
      />
      <Field
        editable={!m.busy}
        label="研究日期 YYYY-MM-DD"
        value={date}
        onChangeText={setDate}
      />
      <ModelPicker
        user={user}
        value={model}
        onChange={setModel}
        disabled={m.busy}
      />
      <Copy muted>选择模型后创建自定义任务。快速研究使用服务器默认配置。</Copy>
      <Copy bold>分析范围</Copy>
      {["market", "social", "news", "fundamentals"].map((a) => (
        <Button
          key={a}
          disabled={m.busy}
          selected={analysts.includes(a)}
          onPress={() =>
            setAnalysts((v) =>
              v.includes(a) ? v.filter((x) => x !== a) : [...v, a],
            )
          }
        >
          {
            (
              {
                market: "市场",
                social: "社交",
                news: "新闻",
                fundamentals: "基本面",
              } as Record<string, string>
            )[a]
          }
        </Button>
      ))}
      <Filters
        values={[
          ["1", "1 轮讨论"],
          ["2", "2 轮讨论"],
          ["3", "3 轮讨论"],
        ]}
        value={rounds}
        onChange={setRounds}
      />
      <Button
        disabled={
          m.busy ||
          !model ||
          !isSymbol(ticker) ||
          !calendarDate(date) ||
          !analysts.length
        }
        onPress={() =>
          void m.run(async (signal) => {
            const selected = MODEL_CONFIGS.find((c) => c.id === model);
            const result = await apiRequest<{ id: string }>(
              model
                ? "/trading-analysis/start"
                : "/trading-analysis/start-stock",
              {
                method: "POST",
                signal,
                authenticated: true,
                expectedUser: user,
                body: model
                  ? {
                      ticker,
                      trade_date: date,
                      provider: providerId[selected!.provider],
                      deep_think_model: model,
                      quick_think_model: model,
                      selected_analysts: analysts,
                      max_debate_rounds: Number(rounds),
                      max_risk_discuss_rounds: Number(rounds),
                    }
                  : { ticker, trade_date: date },
              },
            );
            r.refresh();
            router.push(`/research-task/${encodeURIComponent(result.id)}`);
          })
        }
      >
        {m.busy ? "正在提交…" : "开始研究（将调用模型）"}
      </Button>
      <Copy size={12} muted>
        仅点击后创建任务，可能产生模型服务费用。请求中断时先刷新任务列表，避免重复生成。
      </Copy>
      <Button
        disabled={m.busy || !isSymbol(ticker) || !calendarDate(date)}
        onPress={() =>
          void m.run(async (signal) => {
            const value = await apiRequest<{ id: string }>(
              "/trading-analysis/start-stock",
              {
                method: "POST",
                signal,
                authenticated: true,
                expectedUser: user,
                body: { ticker, trade_date: date },
              },
            );
            r.refresh();
            router.push(`/research-task/${value.id}`);
          })
        }
      >
        按服务器默认配置快速研究
      </Button>
      <MutationStatus {...m} />
      <Section title="历史任务" />
      <ResourceState
        resource={r}
        empty={!r.data?.items.length}
        message="尚无研究任务"
      />
      {r.data?.items.map((i) => (
        <Glass key={i.id} style={{ padding: 20, gap: 12 }}>
          <Copy bold>
            {i.ticker} · {i.trade_date}
          </Copy>
          <Copy>{i.status}</Copy>
          <Button onPress={() => router.push(`/research-task/${i.id}`)}>
            进度与完整报告
          </Button>
        </Glass>
      ))}
      <Pager
        page={page}
        hasMore={page * 20 < (r.data?.total ?? 0)}
        loading={r.loading}
        onChange={setPage}
      />
    </Page>
  );
}
