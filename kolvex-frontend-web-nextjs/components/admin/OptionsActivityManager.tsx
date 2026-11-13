"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, RefreshCw } from "lucide-react";
import { AdminRowsSkeleton } from "@/components/admin/AdminSkeletons";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/info-tip";
import { Input } from "@/components/ui/input";
import { ResearchCandidates } from "@/components/options-activity/sections";
import { ACTIVITY_SESSIONS, type ActivityCandidates, type ActivitySession, type SymbolSource } from "@/lib/optionsActivity";
import { marketStockHref } from "@/lib/stockLinks";
import { cn } from "@/lib/utils";

interface AdminRun {
  id: string; trade_date: string; session: ActivitySession; status: "ok" | "skipped"; run_at: string;
  data_date: string | null; universe_size: number; failed_symbols: string[]; model_id: string | null;
  summary_source: "ai" | "template" | null;
}
interface ManualState {
  session: ActivitySession | null; status: "idle" | "running" | "done" | "failed"; symbols?: string[];
  started_at: string | null; finished_at: string | null; error: string | null;
  result: { status: string; data_date?: string | null; failed_symbols?: string[] } | null;
}
interface AnalysisState {
  status: "idle" | "running" | "done" | "failed";
  finished_at: string | null; error: string | null;
  result: { status: "ok" | "unavailable"; reason: string | null; count: number } | null;
}
export interface LatestRun {
  id: string; trade_date: string; session: ActivitySession; run_at: string; candidates: ActivityCandidates | null;
  /** Absent on runs saved before the scan list was recorded. */
  universe: Record<string, SymbolSource[]> | null; skipped_symbols: string[] | null; failed_symbols: string[];
}
interface AdminStatus { configured: boolean; worker_enabled: boolean; manual: ManualState; analysis: AnalysisState; latest: LatestRun | null; runs: AdminRun[] }

const SESSION_LABEL: Record<ActivitySession, string> = { pre: "盘前", intraday: "盘中", post: "盘后" };
const SESSION_TIME: Record<ActivitySession, string> = { pre: "09:00", intraday: "12:30", post: "16:20" };
const POLL_MS = 5000;
const SOURCE_GROUPS: [SymbolSource, string, string][] = [
  ["core", "核心", "固定观察列表，市场总额只统计这一组"],
  ["mover", "异动", "今日涨跌幅居前，且股票成交额不低于 2 亿美元"],
  ["active", "放量", "成交量明显高于 3 个月均量，且股票成交额不低于 2 亿美元"],
  ["kol", "热议", "Reddit、X、YouTube 中至少两个平台提到，或被至少两位博主提到"],
  ["manual", "手动", "管理员手动运行时添加"],
];

export function ScannedSymbols({ run }: { run: LatestRun }) {
  if (!run.universe) {
    return <p className="text-sm text-muted-foreground">这一轮运行早于扫描列表记录功能，没有保存标的清单。</p>;
  }
  const missing = new Set([...(run.skipped_symbols ?? []), ...run.failed_symbols]);
  const symbols = Object.keys(run.universe);
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {run.trade_date} {SESSION_LABEL[run.session]} · 共 {symbols.length} 个
        {missing.size > 0 && `，其中 ${missing.size} 个没有取到数据（划线）`}
      </p>
      <dl className="divide-y divide-border rounded-2xl border border-border bg-card">
        {SOURCE_GROUPS.map(([source, label, hint]) => {
          const group = symbols.filter((symbol) => run.universe![symbol].includes(source));
          return (
            <div key={source} className="grid gap-2 px-4 py-3 sm:grid-cols-[6rem_1fr]">
              <dt className="text-sm font-medium" title={hint}>
                {label} <span className="figure text-muted-foreground">{group.length}</span>
              </dt>
              <dd className="flex flex-wrap gap-1.5">
                {group.length ? (
                  group.map((symbol) => (
                    <Link
                      key={symbol}
                      href={`${marketStockHref(symbol)}?tab=options`}
                      title={missing.has(symbol) ? "没有取到数据" : undefined}
                      className={cn(
                        "figure rounded-md bg-muted px-2 py-0.5 text-xs hover:bg-foreground/10",
                        missing.has(symbol) && "text-muted-foreground line-through",
                      )}
                    >
                      {symbol}
                    </Link>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">本轮没有</span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
const ANALYSIS_REASON: Record<string, string> = {
  no_eligible_contracts: "这一轮没有到期日在 7 天以上的合约。",
  no_valid_candidates: "模型没有给出可用的候选。",
};

async function request<T>(query = "", method: "GET" | "POST" = "GET", signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/admin/options-activity${query}`, { method, signal, cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "请求失败，请重试。");
  return data;
}

const etTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("zh-CN", { timeZone: "America/New_York", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " ET"
    : "—";

function Pill({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", ok ? "bg-positive/10 text-positive" : "bg-muted text-muted-foreground")}>
      {children}
    </span>
  );
}

export default function OptionsActivityManager() {
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [starting, setStarting] = useState<ActivitySession | "analysis" | null>(null);
  const [symbols, setSymbols] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await request<AdminStatus>("", "GET", signal);
      if (!signal?.aborted) {
        setStatus(data);
        setError("");
      }
    } catch (e) {
      if (!signal?.aborted) setError(e instanceof Error ? e.message : "无法读取运行状态。");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const analysis = status?.analysis;
  const analyzing = analysis?.status === "running";
  const running = status?.manual.status === "running" || analyzing;
  // Poll while a manual run or analysis is in flight; both take a few minutes at most.
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [running, load]);

  async function start(session: ActivitySession) {
    setStarting(session);
    setError("");
    setMessage("");
    try {
      const extra = symbols.trim();
      await request(`?${new URLSearchParams({ session, ...(extra ? { symbols: extra } : {}) })}`, "POST");
      setMessage(`已开始${SESSION_LABEL[session]}运行${extra ? "（含自定义标的）" : ""}，通常需要几分钟。`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "启动失败，请重试。");
    } finally {
      setStarting(null);
    }
  }

  async function analyze() {
    setStarting("analysis");
    setError("");
    setMessage("");
    try {
      await request("?action=analyze", "POST");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "启动失败，请重试。");
    } finally {
      setStarting(null);
    }
  }

  const manual = status?.manual;
  const latest = status?.latest;
  return (
    <div className="min-w-0 space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">期权异动</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          定时任务在交易日美东 09:00（盘前）、12:30（盘中）、16:20（盘后）各运行一次，休市日自动跳过。
          手动运行会忽略休市判断，并覆盖同一天同一时点已有的结果。
        </p>
        <Link href="/dashboard/options-activity" className="inline-block text-sm font-semibold underline underline-offset-4">
          查看报告页面
        </Link>
      </div>

      {status && (
        <div className="flex flex-wrap gap-2">
          <Pill ok={status.configured}>{status.configured ? "Alpaca 已配置" : "Alpaca 未配置"}</Pill>
          <Pill ok={status.worker_enabled}>{status.worker_enabled ? "定时任务已开启" : "定时任务未开启（OPTIONS_ACTIVITY_WORKER_ENABLED）"}</Pill>
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-sm font-medium">手动运行</h3>
        <div className="max-w-xl space-y-1.5">
          <label htmlFor="activity-symbols" className="flex items-center gap-1.5 text-xs text-muted-foreground">
            自定义标的（可选）
            <InfoTip label="自定义标的">
              这些股票只加入这一次手动运行，最多 20 个，用逗号或空格分隔。和自动选出的标的一样，会出现在排行和 AI 候选里，但不计入核心市场总额。
            </InfoTip>
          </label>
          <Input
            id="activity-symbols"
            value={symbols}
            onChange={(event) => setSymbols(event.target.value.toUpperCase())}
            placeholder="LLY, XOM, COST"
            autoComplete="off"
            spellCheck={false}
            maxLength={300}
            disabled={running || starting !== null}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {ACTIVITY_SESSIONS.map((session) => (
            <Button
              key={session}
              variant="outline"
              disabled={!status?.configured || running || starting !== null}
              onClick={() => void start(session)}
            >
              {starting === session && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              运行{SESSION_LABEL[session]}
              <span className="ml-1.5 text-xs text-muted-foreground">{SESSION_TIME[session]}</span>
            </Button>
          ))}
          <Button variant="ghost" size="icon" aria-label="刷新状态" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        {manual && manual.status !== "idle" && manual.session && (
          <p role="status" className={cn("text-sm", manual.status === "failed" ? "text-negative" : "text-muted-foreground")}>
            {manual.status === "running" && (
              <>
                <Loader2 className="mr-1.5 inline h-3.5 w-3.5 animate-spin" />
                {SESSION_LABEL[manual.session]}运行中，开始于 {etTime(manual.started_at)}
                {manual.symbols?.length ? `，自定义标的 ${manual.symbols.join(", ")}` : ""}
              </>
            )}
            {manual.status === "done" &&
              `上次手动运行（${SESSION_LABEL[manual.session]}）完成于 ${etTime(manual.finished_at)}：${
                manual.result?.status === "skipped" ? "判定为休市，已跳过" : "已保存"
              }${manual.result?.failed_symbols?.length ? `，未取到 ${manual.result.failed_symbols.join(", ")}` : ""}`}
            {manual.status === "failed" && `上次手动运行（${SESSION_LABEL[manual.session]}）失败：${manual.error ?? "未知错误"}`}
          </p>
        )}
        {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
        {error && <p role="alert" className="rounded-3xl bg-negative/10 px-4 py-3 text-sm text-foreground">{error}</p>}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium">AI 分析</h3>
        <Button variant="outline" disabled={!latest || running || starting !== null} onClick={() => void analyze()}>
          {(starting === "analysis" || analyzing) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {latest ? `分析 ${latest.trade_date} ${SESSION_LABEL[latest.session]}报告` : "暂无可分析的报告"}
        </Button>
        {analysis && analysis.status !== "idle" && (
          <p role="status" className={cn("text-sm", analysis.status === "failed" ? "text-negative" : "text-muted-foreground")}>
            {analysis.status === "running" && "正在分析，通常需要 1–3 分钟。"}
            {analysis.status === "failed" && "分析失败，请重试。"}
            {analysis.status === "done" &&
              (analysis.result?.status === "ok"
                ? `完成于 ${etTime(analysis.finished_at)}，得到 ${analysis.result.count} 个候选，已同步到报告页面。`
                : `没有新结果，报告未改动：${ANALYSIS_REASON[analysis.result?.reason ?? ""] ?? "模型暂不可用，请重试。"}`)}
          </p>
        )}
        <ResearchCandidates candidates={latest?.candidates} />
      </div>

      {latest && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium">本轮扫描标的</h3>
          <ScannedSymbols run={latest} />
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-sm font-medium">最近运行</h3>
        {loading ? (
          <AdminRowsSkeleton label="正在读取运行记录" rows={3} actions={0} lines={2} />
        ) : !status?.runs.length ? (
          <p className="rounded-lg border border-border px-4 py-6 text-center text-sm text-muted-foreground">还没有运行记录。</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  {["交易日", "时点", "状态", "运行时间", "数据日期", "标的数", "未取到", "摘要"].map((label) => (
                    <th key={label} scope="col" className="px-3 py-2 text-left font-medium">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {status.runs.map((run) => (
                  <tr key={run.id} className="border-t border-border">
                    <td className="figure px-3 py-2">{run.trade_date}</td>
                    <td className="px-3 py-2">{SESSION_LABEL[run.session]}</td>
                    <td className="px-3 py-2">
                      <Pill ok={run.status === "ok"}>{run.status === "ok" ? "已保存" : "休市跳过"}</Pill>
                    </td>
                    <td className="figure px-3 py-2">{etTime(run.run_at)}</td>
                    <td className="figure px-3 py-2">{run.data_date ?? "—"}</td>
                    <td className="figure px-3 py-2">{run.universe_size}</td>
                    <td className="px-3 py-2 text-xs">{run.failed_symbols.length ? run.failed_symbols.join(", ") : "—"}</td>
                    <td className="px-3 py-2 text-xs">
                      {run.summary_source === "ai" ? `AI${run.model_id ? ` · ${run.model_id}` : ""}` : run.summary_source === "template" ? "模板（AI 不可用）" : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
