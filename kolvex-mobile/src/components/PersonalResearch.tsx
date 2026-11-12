// The Web's personal AI research on the stock page (useStockResearch + the research tab):
// one click starts the research agents for this stock; a running job is followed until done.
import { useEffect, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import type { TradingAnalysis } from "../lib/contentTypes";
import { apiRequest } from "../lib/http";
import { useTheme } from "../lib/theme";
import { useResource } from "../lib/useResource";
import { useAuth } from "../state/Auth";
import { usePreferences } from "../state/Preferences";
import { ResearchProgress } from "./ResearchProgress";
import { Button, Copy, Glass, Section } from "./UI";

const active = (item?: TradingAnalysis | null) =>
  !!item && (item.status === "pending" || item.status === "running");

export function PersonalResearch({ symbol }: { symbol: string }) {
  const t = useTheme();
  const { locale } = usePreferences();
  const user = useAuth().session!.user.id;
  const [revision, setRevision] = useState(0);
  const history = useResource(
    `my-research:${user}:${symbol}:${revision}`,
    (signal) =>
      apiRequest<{ items: TradingAnalysis[] }>(
        `/trading-analysis/history?ticker=${encodeURIComponent(symbol)}&limit=100`,
        { signal, authenticated: true, expectedUser: user },
      ),
  );
  const items = history.data?.items ?? [];
  const running = items.find(active) ?? null;
  const latest = items.find((item) => item.status === "completed") ?? null;
  const [job, setJob] = useState<TradingAnalysis | null>(null);
  const [starting, setStarting] = useState(false);
  const [failed, setFailed] = useState(false);
  const current = job && job.id === running?.id ? job : (job ?? running);
  const busy = starting || active(current);
  // Follow the running job; when it finishes, reload the history to pick up the result.
  useEffect(() => {
    if (!current || !active(current)) return;
    const controller = new AbortController();
    const timer = setInterval(() => {
      apiRequest<TradingAnalysis>(
        `/trading-analysis/${encodeURIComponent(current.id)}`,
        { signal: controller.signal, authenticated: true, expectedUser: user },
      )
        .then((record) => {
          setJob(record);
          setFailed(false);
          if (!active(record)) setRevision((v) => v + 1);
        })
        .catch(() => {
          if (!controller.signal.aborted) setFailed(true);
        });
    }, 3000);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [current, user]);
  const generate = async () => {
    if (busy) return;
    setStarting(true);
    setFailed(false);
    try {
      const today = new Date();
      const date = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, "0"),
        String(today.getDate()).padStart(2, "0"),
      ].join("-");
      const created = await apiRequest<TradingAnalysis>(
        "/trading-analysis/start-stock",
        {
          method: "POST",
          authenticated: true,
          expectedUser: user,
          body: { ticker: symbol, trade_date: date },
        },
      );
      setJob(created);
    } catch {
      setFailed(true);
    } finally {
      setStarting(false);
    }
  };
  const completedAt = latest?.completed_at || latest?.created_at;
  return (
    <Glass style={{ padding: 16, gap: 12 }}>
      <Section title="AI 研究" />
      <Button
        variant="primary"
        disabled={busy || history.loading}
        onPress={() => void generate()}
      >
        {busy ? "正在生成研究…" : latest ? "更新 AI 研究" : "生成 AI 研究"}
      </Button>
      {!!latest && !!completedAt && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Copy size={12} muted>
            最近完成
          </Copy>
          <Copy size={12} muted localize={false}>
            {new Date(completedAt).toLocaleString(
              locale === "en" ? "en-US" : "zh-CN",
            )}
          </Copy>
        </View>
      )}
      {busy && (
        <>
          {current?.status === "running" ? (
            <ResearchProgress
              events={current.progress_events ?? []}
              stage={current.progress_stage}
            />
          ) : (
            <Copy size={14} muted>
              {current
                ? "等待后台处理，轮到后会自动开始。"
                : "正在把这只股票交给研究团队。"}
            </Copy>
          )}
          <Copy size={12} muted>
            研究通常需要几分钟。可以离开页面，完成后结果会自动保存。
          </Copy>
        </>
      )}
      {(failed || current?.status === "failed") && (
        <Copy size={14} color={t.negative}>
          研究生成或状态加载失败，请重试。之前的分析已保留。
        </Copy>
      )}
      {!!latest && !busy && (
        <Button
          size="sm"
          onPress={() =>
            router.push(`/research-task/${encodeURIComponent(latest.id)}`)
          }
        >
          阅读我的研究
        </Button>
      )}
    </Glass>
  );
}
