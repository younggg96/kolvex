// The Web's admin OptionsActivityManager: data-source state, manual runs, AI analysis
// of the newest run and recent runs. Admin rights are checked by the backend.
import { useEffect, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { ApiError, apiRequest } from "../lib/http";
import {
  ACTIVITY_SESSIONS,
  type ActivityCandidates,
  type ActivitySession,
} from "../lib/optionsActivity";
import { useTheme } from "../lib/theme";
import { useResource } from "../lib/useResource";
import { ResearchCandidates, SESSION_LABELS } from "./OptionsActivity";
import { CardsSkeleton } from "./Skeletons";
import {
  Button,
  Copy,
  Failure,
  Glass,
  LoadingStatus,
  Section,
  styles,
} from "./UI";

interface AdminRun {
  id: string;
  trade_date: string;
  session: ActivitySession;
  status: "ok" | "skipped";
  run_at: string;
  data_date: string | null;
  universe_size: number;
  failed_symbols: string[];
  model_id: string | null;
  summary_source: "ai" | "template" | null;
}
interface AdminStatus {
  configured: boolean;
  worker_enabled: boolean;
  manual: {
    session: ActivitySession | null;
    status: "idle" | "running" | "done" | "failed";
    started_at: string | null;
    finished_at: string | null;
    error: string | null;
    result: { status: string; failed_symbols?: string[] } | null;
  };
  analysis: {
    status: "idle" | "running" | "done" | "failed";
    finished_at: string | null;
    result: {
      status: "ok" | "unavailable";
      reason: string | null;
      count: number;
    } | null;
  };
  latest: {
    id: string;
    trade_date: string;
    session: ActivitySession;
    candidates: ActivityCandidates | null;
  } | null;
  runs: AdminRun[];
}
const SESSION_TIME: Record<ActivitySession, string> = {
  pre: "09:00",
  intraday: "12:30",
  post: "16:20",
};
const ERRORS: Record<string, string> = {
  options_data_not_configured: "后端还没有配置 Alpaca API Key。",
  run_in_progress: "已有一次运行正在进行，请等它结束。",
  no_runs: "还没有可分析的报告。",
};
const ANALYSIS_REASON: Record<string, string> = {
  no_eligible_contracts: "这一轮没有到期日在 7 天以上的合约。",
  no_valid_candidates: "模型没有给出可用的候选。",
};
const POLL_MS = 5000;
const etTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("zh-CN", {
        timeZone: "America/New_York",
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }) + " ET"
    : "—";
const failure = (error: unknown) =>
  error instanceof ApiError
    ? (ERRORS[error.detail ?? ""] ??
      (error.status === 403
        ? "需要管理员权限。"
        : error.status === 404
          ? "后端还没有这个接口，请重启后端。"
          : "期权异动服务暂不可用，请重试。"))
    : "期权异动服务暂不可用，请重试。";

function Pill({ ok, children }: { ok: boolean; children: string }) {
  const t = useTheme();
  return (
    <View
      style={{
        alignSelf: "flex-start",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: ok ? "rgba(0,200,5,0.12)" : t.wash,
      }}
    >
      <Copy size={12} bold color={ok ? t.accent : t.secondary}>
        {children}
      </Copy>
    </View>
  );
}

export function OptionsActivityAdmin({ user }: { user: string }) {
  const t = useTheme();
  const [revision, setRevision] = useState(0);
  const resource = useResource(`admin-options:${user}:${revision}`, (signal) =>
    apiRequest<AdminStatus>("/admin/options-activity/status", {
      signal,
      authenticated: true,
      expectedUser: user,
    }),
  );
  const status = resource.data;
  const analyzing = status?.analysis.status === "running";
  const running = status?.manual.status === "running" || analyzing;
  // Poll while a manual run or analysis is in flight; both take a few minutes at most.
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setRevision((v) => v + 1), POLL_MS);
    return () => clearInterval(timer);
  }, [running]);
  const [starting, setStarting] = useState<ActivitySession | "analysis" | null>(
    null,
  );
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function post(path: string, key: ActivitySession | "analysis") {
    setStarting(key);
    setError("");
    setMessage("");
    try {
      await apiRequest(`/admin/options-activity/${path}`, {
        method: "POST",
        authenticated: true,
        expectedUser: user,
      });
      if (key !== "analysis")
        setMessage(`已开始${SESSION_LABELS[key]}运行，通常需要 1–2 分钟。`);
      setRevision((v) => v + 1);
    } catch (e) {
      setError(failure(e));
    } finally {
      setStarting(null);
    }
  }
  const manual = status?.manual;
  const analysis = status?.analysis;
  const latest = status?.latest;
  return (
    <View style={{ gap: 16 }}>
      <Copy size={14} muted>
        定时任务在交易日美东
        09:00（盘前）、12:30（盘中）、16:20（盘后）各运行一次，休市日自动跳过。手动运行会忽略休市判断，并覆盖同一天同一时点已有的结果。
      </Copy>
      <Button onPress={() => router.push("/options-activity")}>
        查看报告页面
      </Button>
      {!!status && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Pill ok={status.configured}>
            {status.configured ? "Alpaca 已配置" : "Alpaca 未配置"}
          </Pill>
          <Pill ok={status.worker_enabled}>
            {status.worker_enabled
              ? "定时任务已开启"
              : "定时任务未开启（OPTIONS_ACTIVITY_WORKER_ENABLED）"}
          </Pill>
        </View>
      )}

      <Section title="手动运行" />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {ACTIVITY_SESSIONS.map((session) => (
          <Button
            key={session}
            disabled={!status?.configured || running || starting !== null}
            onPress={() => void post(`run?session=${session}`, session)}
          >
            {starting === session
              ? "正在启动…"
              : `运行${SESSION_LABELS[session]} ${SESSION_TIME[session]}`}
          </Button>
        ))}
        <Button
          onPress={() => setRevision((v) => v + 1)}
          disabled={resource.loading}
        >
          刷新状态
        </Button>
      </View>
      {!!manual && manual.status !== "idle" && !!manual.session && (
        <Copy
          size={14}
          color={manual.status === "failed" ? t.negative : t.secondary}
        >
          {manual.status === "running"
            ? `${SESSION_LABELS[manual.session]}运行中，开始于 ${etTime(manual.started_at)}`
            : manual.status === "done"
              ? `上次手动运行（${SESSION_LABELS[manual.session]}）完成于 ${etTime(manual.finished_at)}：${
                  manual.result?.status === "skipped"
                    ? "判定为休市，已跳过"
                    : "已保存"
                }${manual.result?.failed_symbols?.length ? `，未取到 ${manual.result.failed_symbols.join(", ")}` : ""}`
              : `上次手动运行（${SESSION_LABELS[manual.session]}）失败：${manual.error ?? "未知错误"}`}
        </Copy>
      )}
      {!!message && (
        <Copy size={14} muted>
          {message}
        </Copy>
      )}
      {!!error && <Failure message={error} />}

      <Section title="AI 分析" />
      <Button
        disabled={!latest || running || starting !== null}
        onPress={() => void post("analyze", "analysis")}
      >
        {starting === "analysis" || analyzing
          ? "正在分析…"
          : latest
            ? `分析 ${latest.trade_date} ${SESSION_LABELS[latest.session]}报告`
            : "暂无可分析的报告"}
      </Button>
      {!!analysis && analysis.status !== "idle" && (
        <Copy
          size={14}
          color={analysis.status === "failed" ? t.negative : t.secondary}
        >
          {analysis.status === "running"
            ? "正在分析，通常需要 1–3 分钟。"
            : analysis.status === "failed"
              ? "分析失败，请重试。"
              : analysis.result?.status === "ok"
                ? `完成于 ${etTime(analysis.finished_at)}，得到 ${analysis.result.count} 个候选，已同步到报告页面。`
                : `没有新结果，报告未改动：${ANALYSIS_REASON[analysis.result?.reason ?? ""] ?? "模型暂不可用，请重试。"}`}
        </Copy>
      )}
      <ResearchCandidates candidates={latest?.candidates} />

      <Section title="最近运行" />
      {resource.loading && !status ? (
        <LoadingStatus label="正在读取运行记录">
          <CardsSkeleton count={3} lines={[{ size: 14 }, { size: 12 }]} />
        </LoadingStatus>
      ) : resource.error && !status ? (
        <Failure message={resource.error} retry={resource.refresh} />
      ) : !status?.runs.length ? (
        <Copy size={14} muted>
          还没有运行记录。
        </Copy>
      ) : (
        <Glass style={{ paddingHorizontal: 16 }}>
          {status.runs.map((run, index) => (
            <View
              key={run.id}
              style={{
                gap: 6,
                paddingVertical: 12,
                borderTopWidth: index ? 1 : 0,
                borderColor: t.border,
              }}
            >
              <View style={styles.row}>
                <Copy size={14} bold localize={false}>
                  {run.trade_date}
                </Copy>
                <Copy size={14}>{SESSION_LABELS[run.session]}</Copy>
                <Pill ok={run.status === "ok"}>
                  {run.status === "ok" ? "已保存" : "休市跳过"}
                </Pill>
              </View>
              <Copy size={12} muted localize={false}>
                {`${etTime(run.run_at)} · ${run.data_date ?? "—"} · ${run.universe_size}`}
              </Copy>
              {run.failed_symbols.length > 0 && (
                <Copy size={12} muted localize={false}>
                  {run.failed_symbols.join(", ")}
                </Copy>
              )}
              <Copy size={12} muted>
                {run.summary_source === "ai"
                  ? `AI${run.model_id ? ` · ${run.model_id}` : ""}`
                  : run.summary_source === "template"
                    ? "模板（AI 不可用）"
                    : "—"}
              </Copy>
            </View>
          ))}
        </Glass>
      )}
    </View>
  );
}
