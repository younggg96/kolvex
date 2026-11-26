"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useCopy } from "@/components/decision/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FEAR_GREED_HISTORY_PATH } from "@/lib/fearGreed";
import { invalidateClientCache } from "@/lib/clientCache";

type ImportSummary = { count: number; first_date: string; last_date: string };
type Result = { kind: "preview" | "saved"; summary: ImportSummary };
type SyncStatus = {
  worker_configured: boolean;
  latest: { date: string; score: number; updated_at: string; source: "worker" | "admin" } | null;
};
const MAX_BYTES = 512 * 1024;
const STALE_MS = 24 * 60 * 60 * 1000;

/** Latest stored day and whether the local Playwright worker or an admin wrote it. */
function SyncStatusLine({ reloadKey }: { reloadKey: number }) {
  const c = useCopy();
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async (signal: AbortSignal) => {
    try {
      const response = await fetch("/api/admin/fear-greed", { cache: "no-store", signal });
      if (!response.ok) throw new Error(String(response.status));
      setStatus(await response.json());
      setFailed(false);
    } catch {
      if (!signal.aborted) setFailed(true);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, reloadKey]);

  if (failed) {
    return (
      <p role="alert" className="text-sm text-negative">
        {c("Could not load sync status.", "无法读取同步状态。")}
      </p>
    );
  }
  if (!status) {
    return (
      <p className="text-sm text-muted-foreground">
        {c("Loading sync status…", "正在读取同步状态…")}
      </p>
    );
  }
  const { latest } = status;
  const updated = latest ? new Date(latest.updated_at) : null;
  const stale = status.worker_configured && updated && Date.now() - updated.getTime() > STALE_MS;
  return (
    <div className="space-y-1 text-sm">
      <p className="text-muted-foreground">
        {status.worker_configured
          ? c(
              "Automatic sync is on: the local Playwright script (side-projects/fear-greed) posts CNN data on a schedule.",
              "自动同步已开启：本机 Playwright 脚本（side-projects/fear-greed）定时抓取 CNN 数据。",
            )
          : c(
              "Automatic sync is off: set FEAR_GREED_WORKER_TOKEN on the backend.",
              "自动同步未开启：后端需设置 FEAR_GREED_WORKER_TOKEN。",
            )}
      </p>
      <p>
        {latest && updated
          ? c(
              `Latest day ${latest.date} · score ${latest.score.toFixed(1)} · ${latest.source === "worker" ? "automatic sync" : "admin import"} · updated ${updated.toLocaleString("en-US")}`,
              `最新数据 ${latest.date} · 分数 ${latest.score.toFixed(1)} · ${latest.source === "worker" ? "自动同步" : "管理员导入"} · 更新于 ${updated.toLocaleString("zh-CN")}`,
            )
          : c("No data stored yet.", "还没有数据。")}
      </p>
      {stale && (
        <p className="text-sm text-warning">
          {c(
            "No update in over 24 hours. Check that the Mac is awake and see side-projects/fear-greed/logs/collect.log.",
            "超过 24 小时没有更新。请确认 Mac 未休眠，并查看 side-projects/fear-greed/logs/collect.log。",
          )}
        </p>
      )}
    </div>
  );
}

export default function FearGreedImporter() {
  const c = useCopy();
  const inputId = useId();
  const helpId = useId();
  const errorId = useId();
  const [csv, setCsv] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"file" | "preview" | "save" | null>(null);
  const [statusKey, setStatusKey] = useState(0);
  const pending = useRef(false);

  const tooLarge = c("Choose a CSV file up to 512 KB.", "CSV 文件不能超过 512 KB。");
  const messages: Record<string, string> = {
    too_large: tooLarge,
    encoding: c("Save the file with UTF-8 encoding.", "请将文件另存为 UTF-8 编码。"),
    header: c(
      "Use DATE,SCORE or DATE,SCORE,RATING as the header.",
      "表头请使用 DATE,SCORE 或 DATE,SCORE,RATING。",
    ),
    columns: c("Match the number of fields in the header.", "每行字段数须和表头一致。"),
    date: c(
      "Enter a valid YYYY-MM-DD date through today (New York time).",
      "请输入 YYYY-MM-DD 格式的有效日期，不能晚于美东今天。",
    ),
    duplicate: c("Keep one row per date in each import.", "同一次导入中每个日期只能有一行。"),
    score: c("Enter a score from 0 to 100.", "分数须在 0 到 100 之间。"),
    rating: c(
      "Use the English rating shown by CNN, or leave it blank.",
      "请填写 CNN 显示的英文评级，或留空。",
    ),
    too_many_rows: c(
      "Split the data into batches of up to 10,000 rows.",
      "请拆分数据，每批最多 10,000 行。",
    ),
    empty: c("Add at least one daily row below the header.", "请在表头下至少添加一行日线数据。"),
    csv: c("Correct the CSV formatting.", "请修正 CSV 格式。"),
  };

  function edit(value: string) {
    setCsv(value);
    setResult(null);
    setError("");
  }

  async function pickFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || pending.current) return;
    setResult(null);
    setError("");
    if (file.size > MAX_BYTES) {
      setError(tooLarge);
      return;
    }
    pending.current = true;
    setBusy("file");
    try {
      edit(new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer()));
    } catch {
      setError(messages.encoding);
    } finally {
      pending.current = false;
      setBusy(null);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || !csv.trim() || result?.kind === "saved") return;
    if (new TextEncoder().encode(csv).byteLength > MAX_BYTES) {
      setError(tooLarge);
      return;
    }
    const preview = result?.kind !== "preview";
    pending.current = true;
    setBusy(preview ? "preview" : "save");
    setError("");
    try {
      const response = await fetch(`/api/admin/fear-greed${preview ? "?validate=true" : ""}`, {
        method: "POST",
        body: csv,
        headers: { "Content-Type": "text/csv; charset=utf-8" },
      });
      const data = await response.json();
      if (!response.ok) {
        const { code, line } = data.detail ?? {};
        const message =
          response.status === 401
            ? c("Sign in again to import data.", "请重新登录后导入。")
            : response.status === 403
              ? c("Administrator access is required.", "需要管理员权限。")
              : messages[code] ||
                c("Import service unavailable. Try again.", "导入服务暂不可用，请重试。");
        setError(line ? c(`Line ${line}. ${message}`, `第 ${line} 行。${message}`) : message);
        return;
      }
      setResult({ kind: preview ? "preview" : "saved", summary: data });
      if (!preview) {
        invalidateClientCache(FEAR_GREED_HISTORY_PATH);
        setStatusKey((key) => key + 1);
      }
    } catch {
      setError(c("Could not complete the request. Try again.", "请求未完成，请重试。"));
    } finally {
      pending.current = false;
      setBusy(null);
    }
  }

  return (
    <section className="max-w-3xl space-y-3" aria-labelledby={`${inputId}-title`}>
      <h2 id={`${inputId}-title`} className="text-xl font-semibold">
        {c("Import CNN Fear & Greed data", "导入 CNN 恐慌与贪婪数据")}
      </h2>
      <Card className="p-4 sm:p-5">
        <SyncStatusLine reloadKey={statusKey} />
      </Card>
      <Card className="p-4 sm:p-5">
        <form noValidate className="space-y-4" onSubmit={submit} aria-busy={busy !== null}>
          <div className="space-y-2">
            <Label htmlFor={`${inputId}-file`}>{c("Upload CSV", "上传 CSV")}</Label>
            <Input
              id={`${inputId}-file`}
              type="file"
              accept=".csv,text/csv"
              disabled={busy !== null}
              onChange={pickFile}
              className="h-auto rounded-2xl py-2"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={inputId}>{c("CSV data", "CSV 数据")}</Label>
            <Textarea
              id={inputId}
              value={csv}
              onChange={(event) => edit(event.target.value)}
              readOnly={busy !== null}
              rows={7}
              spellCheck={false}
              placeholder="DATE,SCORE"
              aria-describedby={error ? `${helpId} ${errorId}` : helpId}
              aria-invalid={error ? true : undefined}
              className="font-mono"
            />
            <p id={helpId} className="text-xs text-muted-foreground">
              {c(
                "Use YYYY-MM-DD dates and a score from 0 to 100. To include CNN’s English rating, add a RATING column. Reimporting a date replaces that row.",
                "日期用 YYYY-MM-DD，分数为 0 至 100。可添加 RATING 列填写 CNN 英文评级。同一日期重新导入会覆盖该行。",
              )}
            </p>
          </div>
          {error && (
            <p id={errorId} role="alert" className="text-sm text-negative">
              {error}
            </p>
          )}
          <div role="status" className="text-sm text-muted-foreground empty:hidden">
            {result &&
              c(
                `${result.kind === "preview" ? "Ready to import" : "Imported"} ${result.summary.count.toLocaleString()} rows · ${result.summary.first_date} to ${result.summary.last_date}`,
                `${result.kind === "preview" ? "校验通过，共" : "已导入"} ${result.summary.count.toLocaleString()} 条 · ${result.summary.first_date} 至 ${result.summary.last_date}`,
              )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              disabled={busy !== null || !csv.trim() || result?.kind === "saved"}
            >
              {busy === "preview"
                ? c("Validating…", "正在校验…")
                : busy === "save"
                  ? c("Importing…", "正在导入…")
                  : result?.kind === "preview"
                    ? c("Confirm import", "确认导入")
                    : c("Validate CSV", "校验 CSV")}
            </Button>
            {result?.kind === "saved" && (
              <Button type="button" variant="outline" onClick={() => edit("")}>
                {c("Import another CSV", "继续导入")}
              </Button>
            )}
          </div>
        </form>
      </Card>
    </section>
  );
}
