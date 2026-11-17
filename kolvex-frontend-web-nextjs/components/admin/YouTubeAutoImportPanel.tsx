"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Play, RefreshCw } from "lucide-react";
import { AdminRowsSkeleton } from "@/components/admin/AdminSkeletons";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/info-tip";
import { cn } from "@/lib/utils";

type RunStatus = "queued" | "running" | "succeeded" | "partial" | "failed";
type VideoStatus = "imported" | "failed" | "transcript_failed";

interface RunVideo {
  video_id: string;
  title?: string | null;
  channel_title?: string | null;
  status: VideoStatus;
  tickers?: string[];
  error?: string | null;
}
interface Run {
  id: string;
  trigger: "manual" | "schedule";
  status: RunStatus;
  model: string | null;
  progress: {
    stage?: "discover" | "transcribe" | "analyze";
    done?: number;
    total?: number;
    current?: string | null;
  };
  videos: RunVideo[];
  error: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}
interface Status {
  configured: boolean;
  worker_token_configured: boolean;
  model_configured: boolean;
  model: string;
  schedule: { time: string; timezone: string; next_run_at: string };
  worker: { last_seen_at: string | null; online: boolean; hostname: string | null };
  runs: Run[];
}

const POLL_MS = 10000;
const RUN_LABEL: Record<RunStatus, string> = {
  queued: "排队中",
  running: "运行中",
  succeeded: "完成",
  partial: "部分失败",
  failed: "失败",
};
const STAGE_LABEL = {
  discover: "读取未追踪视频",
  transcribe: "获取字幕",
  analyze: "DeepSeek 分析并导入",
};
const VIDEO_LABEL: Record<VideoStatus, string> = {
  imported: "已导入",
  failed: "分析或导入失败",
  transcript_failed: "字幕失败",
};

async function request<T>(method: "GET" | "POST" = "GET", signal?: AbortSignal): Promise<T> {
  const response = await fetch("/api/admin/youtube-auto-import", {
    method,
    signal,
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "请求失败，请重试。");
  return data;
}

const localTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("zh-CN", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

function Pill({ tone, children }: { tone: "ok" | "bad" | "muted"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-medium",
        tone === "ok" && "bg-positive/10 text-positive",
        tone === "bad" && "bg-negative/10 text-negative",
        tone === "muted" && "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

function runTone(status: RunStatus): "ok" | "bad" | "muted" {
  return status === "succeeded"
    ? "ok"
    : status === "failed" || status === "partial"
      ? "bad"
      : "muted";
}

function RunDetails({ run }: { run: Run }) {
  const imported = run.videos.filter((video) => video.status === "imported");
  const failed = run.videos.filter((video) => video.status !== "imported");
  return (
    <div className="space-y-2 px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={runTone(run.status)}>{RUN_LABEL[run.status]}</Pill>
        <span className="text-muted-foreground">
          {run.trigger === "manual" ? "手动" : "定时"} ·{" "}
          {localTime(run.started_at ?? run.created_at)}
          {run.finished_at && ` → ${localTime(run.finished_at)}`}
          {run.model && ` · ${run.model}`}
        </span>
      </div>
      {run.status === "running" && run.progress.stage && (
        <p role="status" className="text-muted-foreground">
          <Loader2 className="mr-1.5 inline h-3.5 w-3.5 animate-spin" />
          {STAGE_LABEL[run.progress.stage]}
          {run.progress.total ? ` ${run.progress.done ?? 0}/${run.progress.total}` : ""}
          {run.progress.current && `：${run.progress.current}`}
        </p>
      )}
      {run.status !== "queued" && run.status !== "running" && (
        <p className="text-muted-foreground">
          导入 <span className="figure">{imported.length}</span> 个视频
          {failed.length > 0 && (
            <>
              ，失败 <span className="figure">{failed.length}</span> 个
            </>
          )}
          {run.videos.length === 0 && !run.error && "（没有新的未追踪视频）"}
        </p>
      )}
      {run.error && <p className="text-negative">{run.error}</p>}
      {run.videos.length > 0 && (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {run.videos.map((video) => (
            <li
              key={video.video_id}
              className="grid gap-1 px-3 py-2 sm:grid-cols-[1fr_auto] sm:items-start sm:gap-3"
            >
              <div className="min-w-0">
                <a
                  href={`https://www.youtube.com/watch?v=${video.video_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="line-clamp-1 break-all font-medium hover:underline"
                >
                  {video.title || video.video_id}
                </a>
                <p className="text-xs text-muted-foreground">
                  {video.channel_title ?? ""}
                  {video.status === "imported" &&
                    (video.tickers?.length
                      ? ` · ${video.tickers.join(", ")}`
                      : " · 无明确个股观点")}
                  {video.status !== "imported" && video.error && ` · ${video.error}`}
                </p>
              </div>
              <Pill tone={video.status === "imported" ? "ok" : "bad"}>
                {VIDEO_LABEL[video.status]}
              </Pill>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Daily / on-demand pipeline: local worker fetches transcripts, backend analyzes with DeepSeek and imports. */
export default function YouTubeAutoImportPanel({ onImported }: { onImported?: () => void }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const data = await request<Status>("GET", signal);
        if (signal?.aborted) return;
        setStatus((previous) => {
          const wasActive =
            previous?.runs[0] && ["queued", "running"].includes(previous.runs[0].status);
          const nowDone = data.runs[0] && !["queued", "running"].includes(data.runs[0].status);
          if (wasActive && nowDone) onImported?.();
          return data;
        });
        setError("");
      } catch (e) {
        if (!signal?.aborted) setError(e instanceof Error ? e.message : "无法读取自动导入状态。");
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [onImported],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const latest = status?.runs[0];
  const active = latest && (latest.status === "queued" || latest.status === "running");
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [active, load]);

  async function runNow() {
    setStarting(true);
    setError("");
    try {
      await request("POST");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "启动失败，请重试。");
    } finally {
      setStarting(false);
    }
  }

  return (
    <section className="space-y-4" aria-labelledby="youtube-auto-import">
      <h2 id="youtube-auto-import" className="flex items-center gap-1.5 text-xl font-semibold">
        自动导入
        <InfoTip label="自动导入说明">
          本地 Mac worker 获取网站「未追踪」视频的字幕，后端用 {status?.model ?? "DeepSeek"}{" "}
          分析后直接导入。电脑休眠或 worker 未运行时不会执行，worker 恢复后会补跑当天的任务。
        </InfoTip>
      </h2>

      {status && (
        <div className="flex flex-wrap gap-2">
          <Pill tone="muted">
            每天 {status.schedule.time} · 下次 {localTime(status.schedule.next_run_at)}
          </Pill>
          <Pill tone={status.worker.online ? "ok" : "bad"}>
            {status.worker.online
              ? `worker 在线${status.worker.hostname ? ` · ${status.worker.hostname}` : ""}`
              : `worker 离线${status.worker.last_seen_at ? ` · 最后在线 ${localTime(status.worker.last_seen_at)}` : ""}`}
          </Pill>
          {!status.worker_token_configured && (
            <Pill tone="bad">未配置 YOUTUBE_IMPORT_WORKER_TOKEN</Pill>
          )}
          {!status.model_configured && <Pill tone="bad">未配置 DEEPSEEK_API_KEY</Pill>}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={!status?.configured || Boolean(active) || starting}
          onClick={() => void runNow()}
        >
          {starting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Play className="mr-2 h-4 w-4" />
          )}
          立即运行
        </Button>
        <Button variant="ghost" size="icon" aria-label="刷新状态" onClick={() => void load()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
        {active && status && !status.worker.online && (
          <span className="text-sm text-muted-foreground">已排队，worker 上线后开始。</span>
        )}
      </div>
      {error && (
        <p role="alert" className="rounded-3xl bg-negative/10 px-4 py-3 text-sm text-foreground">
          {error}
        </p>
      )}

      {loading ? (
        <AdminRowsSkeleton label="正在读取运行记录" rows={2} actions={0} lines={2} />
      ) : !status?.runs.length ? (
        <p className="rounded-lg border border-border px-4 py-6 text-center text-sm text-muted-foreground">
          还没有运行记录。
        </p>
      ) : (
        <div className="divide-y divide-border rounded-2xl border border-border bg-card">
          {status.runs.slice(0, 5).map((run) => (
            <RunDetails key={run.id} run={run} />
          ))}
        </div>
      )}
    </section>
  );
}
