import { useEffect, useRef, useState } from "react";
import * as Crypto from "expo-crypto";
import { apiRequest } from "../lib/http";
import { useAuth } from "../state/Auth";
import { useResource } from "../lib/useResource";
import { useMutation } from "../lib/useMutation";
import type { AiTechnicalAnalysis, ChartVersion } from "../lib/technicalTypes";
import {
  TECHNICAL_CATEGORIES,
  type TechnicalCategory,
} from "../lib/technicalFocus";
import { Button, Copy, Glass, Section } from "./UI";
import { Field, Filters, Pager, ResourceState, TextBody } from "./Content";
import { ModelPicker } from "./ModelPicker";
import { MutationStatus } from "./MutationStatus";
import { number } from "../lib/models";
type Job = {
  id: string;
  status: string;
  operation: string;
  result?: AiTechnicalAnalysis;
};
export function TechnicalAI({
  symbol,
  period,
  interval,
  onResult,
}: {
  symbol: string;
  period: string;
  interval: string;
  onResult: (result: AiTechnicalAnalysis) => void;
}) {
  const user = useAuth().session!.user.id;
  const [operation, setOperation] = useState("analysis");
  const [model, setModel] = useState("");
  const [categories, setCategories] = useState<TechnicalCategory[]>([
    "trend",
    "levels",
    "invalidation",
  ]);
  const [custom, setCustom] = useState("");
  const [page, setPage] = useState(1);
  const [scope, setScope] = useState("all");
  const [result, setResult] = useState<AiTechnicalAnalysis>();
  const m = useMutation();
  const request = useRef<{ id: string; signature: string } | undefined>(
    undefined,
  );
  const jobs = useResource(`jobs:${user}:${symbol}`, (signal) =>
    apiRequest<{ items: Job[] }>(`/market/chart-jobs/${symbol}`, {
      signal,
      authenticated: true,
      expectedUser: user,
    }),
  );
  const kind = operation === "analysis" ? "technical" : "drawings";
  const history = useResource(
    `versions:${user}:${symbol}:${kind}:${scope}:${page}`,
    (signal) =>
      apiRequest<{
        items: ChartVersion[];
        total: number;
        current: ChartVersion | null;
      }>(
        `/market/analysis-history/${symbol}?kind=${kind}&scope=${scope}&limit=10&offset=${(page - 1) * 10}`,
        { signal, authenticated: true, expectedUser: user },
      ),
  );
  const running = jobs.data?.items.some((j) =>
    ["queued", "running"].includes(j.status),
  );
  const refreshJobs = jobs.refresh;
  const refreshHistory = history.refresh;
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      refreshJobs();
      refreshHistory();
    }, 5000);
    return () => clearInterval(timer);
  }, [running, refreshJobs, refreshHistory]);
  function show(value: AiTechnicalAnalysis) {
    setResult(value);
    onResult(value);
  }
  return (
    <Glass style={{ padding: 20, gap: 16 }}>
      <Section title="AI 技术研究与画线" />
      <Filters
        values={[
          ["analysis", "技术分析"],
          ["drawings", "AI 画线"],
        ]}
        value={operation}
        onChange={(v) => {
          setOperation(v);
          setPage(1);
        }}
      />
      <ModelPicker
        user={user}
        value={model}
        onChange={setModel}
        disabled={m.busy}
      />
      <Copy muted>选择分析范围</Copy>
      {TECHNICAL_CATEGORIES.map((c) => (
        <Button
          key={c}
          selected={categories.includes(c)}
          disabled={m.busy}
          onPress={() =>
            setCategories((v) =>
              v.includes(c) ? v.filter((x) => x !== c) : [...v, c],
            )
          }
        >
          {categoryName[c] || c}
        </Button>
      ))}
      <Field
        editable={!m.busy}
        label="自定义研究情景（每行一项）"
        value={custom}
        onChangeText={setCustom}
        multiline
        maxLength={2000}
      />
      <Button
        disabled={m.busy || !!running || !model || !categories.length}
        onPress={() =>
          void m.run(async (signal) => {
            const body = {
              period,
              interval,
              model,
              operation,
              categories,
              custom_scenarios: custom
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean),
              locale: "zh",
            };
            const signature = JSON.stringify(body);
            if (request.current?.signature !== signature)
              request.current = { id: Crypto.randomUUID(), signature };
            await apiRequest(`/market/chart-jobs/${symbol}`, {
              method: "POST",
              body: { ...body, request_id: request.current.id },
              signal,
              authenticated: true,
              expectedUser: user,
            });
            jobs.refresh();
          })
        }
      >
        {running ? "服务器任务运行中" : "开始生成（将调用模型）"}
      </Button>
      <Copy muted size={12}>
        仅点击后发起，可能产生模型费用。同一请求重试保留请求
        ID；遇到连接中断请先刷新任务，不会自动重新生成。
      </Copy>
      <MutationStatus {...m} />
      <ResourceState resource={jobs} empty={false} message="暂无任务" />
      {jobs.data?.items.map((j) => (
        <Glass key={j.id} style={{ padding: 12, gap: 8 }}>
          <Copy>
            {j.operation} · {j.status}
          </Copy>
          {j.result && (
            <Button onPress={() => show(j.result!)}>查看任务结果</Button>
          )}
        </Glass>
      ))}
      <Button
        onPress={() => {
          jobs.refresh();
          history.refresh();
        }}
      >
        刷新任务与历史
      </Button>
      <Section title="分析版本" />
      <Filters
        values={[
          ["all", "全部共享结果"],
          ["mine", "我的结果"],
        ]}
        value={scope}
        onChange={(v) => {
          setScope(v);
          setPage(1);
        }}
      />
      <ResourceState
        resource={history}
        empty={!history.data?.items.length}
        message="尚无分析版本"
      />
      {history.data?.current && (
        <Button onPress={() => show(history.data!.current!.payload)}>
          查看当前版本
        </Button>
      )}
      {history.data?.items.map((v) => (
        <Glass key={v.id} style={{ padding: 12, gap: 8 }}>
          <Copy size={12} muted>
            {v.created_at} · {v.payload?.model}
          </Copy>
          <Button onPress={() => show(v.payload)}>阅读并叠加图表</Button>
          {v.user_id === user && (
            <Button
              disabled={m.busy}
              onPress={() =>
                void m.run(async (signal) => {
                  await apiRequest(
                    `/market/analysis-history/${symbol}/${v.id}/current`,
                    {
                      method: "PATCH",
                      body: {
                        expected_current_id:
                          history.data?.current?.user_id === user
                            ? history.data.current.id
                            : null,
                      },
                      signal,
                      authenticated: true,
                      expectedUser: user,
                    },
                  );
                  history.refresh();
                  show(v.payload);
                })
              }
            >
              设为当前版本
            </Button>
          )}
        </Glass>
      ))}
      <Pager
        page={page}
        hasMore={page * 10 < (history.data?.total ?? 0)}
        loading={history.loading}
        onChange={setPage}
      />
      {result && <TechnicalResult result={result} />}
    </Glass>
  );
}
export function TechnicalResult({
  result: r,
}: {
  result: AiTechnicalAnalysis;
}) {
  return (
    <Glass style={{ padding: 16, gap: 12 }}>
      <Copy bold>
        {r.bias} · {r.trend}
      </Copy>
      <Copy muted>
        {r.view.start} — {r.view.end} · {r.model}
      </Copy>
      <TextBody text={r.summary} />
      {r.levels.map((l, i) => (
        <Copy key={i}>
          {l.kind === "support" ? "支撑" : "阻力"} {number(l.price)} ·{" "}
          {l.strength} · {l.reason}
        </Copy>
      ))}
      {r.findings?.map((f) => (
        <Copy key={f.id}>
          {f.status} · {f.explanation}
        </Copy>
      ))}
      {r.signals.map((s, i) => (
        <Copy key={i}>• {s}</Copy>
      ))}
      {r.invalidation && <Copy>失效条件：{r.invalidation}</Copy>}
      {r.setup && (
        <>
          <Copy bold>
            {r.setup.name} · {r.setup.direction}
          </Copy>
          <Copy>
            研究入场区间 {number(r.setup.entry_low)} —{" "}
            {number(r.setup.entry_high)} · 失效 {number(r.setup.invalidation)}
          </Copy>
          <Copy>
            目标 {r.setup.targets.map((v) => number(v)).join(" / ")} · 风险回报{" "}
            {number(r.setup.risk_reward)}
          </Copy>
          <Copy>{r.setup.reason}</Copy>
        </>
      )}
      <Copy size={12} muted>
        生成结果可能错误，画线不是预测或下单指令。所选模型与区间可能不同于当前显示的图表。
      </Copy>
    </Glass>
  );
}
const categoryName: Record<string, string> = {
  trend: "趋势",
  momentum: "动量",
  levels: "支撑与阻力",
  structure: "结构",
  volume: "成交量",
  volatility: "波动率",
  waves: "波浪",
  moving_averages: "均线",
  trendlines: "趋势线",
  candlesticks: "蜡烛形态",
  fibonacci: "斐波那契",
  patterns: "形态",
  timeframes: "多周期",
  score: "评分",
  historical: "历史",
  scenarios: "情景",
  invalidation: "失效条件",
  trade_plan: "研究计划",
  breakouts: "突破",
  retests: "回测",
  false_breakouts: "假突破",
};
