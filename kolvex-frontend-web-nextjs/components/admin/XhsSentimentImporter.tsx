"use client";

import { useMemo, useRef, useState } from "react";
import { Check, Copy, FileJson } from "lucide-react";
import { useCopy } from "@/components/decision/shared";
import XhsDayView from "@/components/xhs/XhsDayView";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  buildXhsCollectionPrompt,
  combineDigestFiles,
  todayPt,
  type XhsDay,
} from "@/lib/xhsSentiment";

type PreviewDay = { digest: XhsDay; replaces: boolean };

/**
 * Paste or pick one or more days of xhs-daily.v2 JSON, preview each day as readers
 * will see it, then save them together.
 */
export default function XhsSentimentImporter() {
  const c = useCopy();
  const [input, setInput] = useState("");
  const [result, setResult] = useState("");
  const [preview, setPreview] = useState<PreviewDay[] | null>(null);
  const [shown, setShown] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const inFlight = useRef(false);
  const { locale } = useTranslation();
  const prompt = useMemo(() => buildXhsCollectionPrompt(locale, todayPt()), [locale]);
  const [copied, setCopied] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopyFailed(false);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: show the text so it can be selected by hand.
      setCopyFailed(true);
      setShowPrompt(true);
    }
  }

  async function loadFiles(files: FileList | null) {
    if (!files?.length) return;
    const read = await Promise.all(
      [...files].map(async (file) => ({ name: file.name, text: await file.text() })),
    );
    const combined = combineDigestFiles(read);
    if ("error" in combined) {
      setResult(c(`${combined.file} is not valid JSON.`, `${combined.file} 不是有效的 JSON。`));
      return;
    }
    setInput(combined.json);
    setPreview(null);
    setResult(
      c(
        `Loaded ${combined.days} day(s) from ${files.length} file(s). Validate next.`,
        `已从 ${files.length} 个文件读入 ${combined.days} 天，请校验。`,
      ),
    );
  }

  const replaced = preview?.filter((day) => day.replaces) ?? [];
  const current = preview?.find((day) => day.digest.date_pt === shown) ?? preview?.[0];

  async function submit(validate: boolean) {
    if (inFlight.current) return;
    if (!validate && !preview) return;
    inFlight.current = true;
    setBusy(true);
    setResult(validate ? c("Validating…", "正在校验…") : c("Saving…", "正在保存…"));
    try {
      const response = await fetch(`/api/admin/xhs-sentiment${validate ? "?validate=1" : ""}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept-Language": c("en", "zh") },
        body: input,
      });
      if (!response.ok) {
        const raw = await response.text();
        let detail: unknown;
        try {
          detail = JSON.parse(raw).detail;
        } catch {
          detail = undefined;
        }
        setPreview(null);
        setResult(typeof detail === "string" ? detail : raw || `HTTP ${response.status}`);
        return;
      }
      if (validate) {
        const data: { days: { digest: XhsDay; replaces_existing: boolean }[] } =
          await response.json();
        const days = data.days.map((day) => ({
          digest: day.digest,
          replaces: day.replaces_existing,
        }));
        setPreview(days);
        setShown(days[0]?.digest.date_pt ?? null);
        setResult(
          c(
            `Valid: ${days.length} day(s), ${days.at(-1)?.digest.date_pt} to ${days[0]?.digest.date_pt}.`,
            `校验通过：${days.length} 天，${days.at(-1)?.digest.date_pt} 至 ${days[0]?.digest.date_pt}。`,
          ),
        );
      } else {
        const data: { dates: string[]; topics: number } = await response.json();
        setPreview(null);
        setResult(
          c(
            `Saved ${data.dates.length} day(s) (${data.dates.join(", ")}), ${data.topics} topic(s) in total.`,
            `已保存 ${data.dates.length} 天（${data.dates.join("、")}），共 ${data.topics} 个话题。`,
          ),
        );
      }
    } catch (error) {
      setResult(
        c("Import request failed", "导入请求失败") +
          (error instanceof Error ? `\n${error.message}` : ""),
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium">
            {c(
              "1. Have a browsing assistant collect today's data",
              "1. 把提示词交给能用浏览器的 AI 采集当天数据",
            )}
          </p>
          <Button variant="outline" size="xs" className="shrink-0 gap-1.5" onClick={copyPrompt}>
            {copied ? (
              <Check className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <Copy className="h-3.5 w-3.5" aria-hidden />
            )}
            {copied ? c("Copied", "已复制") : c("Copy prompt", "复制提示词")}
          </Button>
        </div>
        <Button
          variant="text"
          className="mt-1.5 text-xs text-muted-foreground"
          onClick={() => setShowPrompt((value) => !value)}
          aria-expanded={showPrompt}
          aria-controls="xhs-collection-prompt"
        >
          {showPrompt ? c("Hide prompt", "收起提示词") : c("Show prompt", "查看提示词")}
        </Button>
        {copyFailed && (
          <p role="status" className="mt-1.5 text-xs text-muted-foreground">
            {c(
              "Could not copy. Select the prompt below and copy it by hand.",
              "无法复制，请在下方选中提示词手动复制。",
            )}
          </p>
        )}
        {showPrompt && (
          <pre
            id="xhs-collection-prompt"
            className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-foreground/[0.05] p-3 text-xs leading-5 text-muted-foreground"
          >
            {prompt}
          </pre>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium">
          {c("2. Paste the JSON or choose files", "2. 粘贴 JSON，或选择文件")}
        </p>
        <Button
          variant="outline"
          size="xs"
          className="shrink-0 gap-1.5"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          <FileJson className="h-3.5 w-3.5" aria-hidden />
          {c("Choose JSON files", "选择 JSON 文件")}
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          multiple
          hidden
          onChange={(event) => {
            void loadFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>
      <Textarea
        ref={textarea}
        aria-label={c("Daily digest JSON", "每日情绪 JSON")}
        placeholder={c(
          "One day as an object, or several days as an array […]",
          "一天为一个对象；多天放进数组 […]",
        )}
        spellCheck={false}
        value={input}
        readOnly={busy}
        rows={12}
        className="font-mono"
        onChange={(event) => {
          setInput(event.target.value);
          setPreview(null);
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={busy || !input.trim()}
          onClick={() => void submit(true)}
        >
          {c("Validate and preview", "校验并预览")}
        </Button>
        <Button type="button" disabled={busy || !preview} onClick={() => void submit(false)}>
          {!preview || preview.length === 1
            ? replaced.length
              ? c("Replace saved day", "覆盖已保存的这一天")
              : c("Save", "保存")
            : replaced.length
              ? c(
                  `Save ${preview.length} days (replace ${replaced.length})`,
                  `保存 ${preview.length} 天（覆盖 ${replaced.length} 天）`,
                )
              : c(`Save ${preview.length} days`, `保存 ${preview.length} 天`)}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={() => {
            setInput("");
            setResult("");
            setPreview(null);
            textarea.current?.focus();
          }}
        >
          {c("Clear", "清空")}
        </Button>
      </div>
      <div
        className="space-y-4 rounded-xl border border-border p-4"
        aria-label={c("Import result", "导入结果")}
      >
        <p role="status" className="m-0 whitespace-pre-wrap break-words text-sm">
          {result ||
            c(
              "Validate first. Saving is enabled once the preview passes. Format: docs/xhs-sentiment.md.",
              "先校验，预览通过后才能保存。格式见 docs/xhs-sentiment.md。",
            )}
        </p>
        {replaced.length > 0 && (
          <p className="m-0 text-sm font-medium text-negative">
            {c(
              `Already saved: ${replaced.map((day) => day.digest.date_pt).join(", ")}. Saving replaces each of these days in full.`,
              `已有数据：${replaced.map((day) => day.digest.date_pt).join("、")}。保存会把这些天整天覆盖。`,
            )}
          </p>
        )}
        {preview && preview.length > 1 && (
          <ul
            className="flex flex-wrap gap-2"
            aria-label={c("Days in this import", "本次导入的日期")}
          >
            {preview.map(({ digest, replaces }) => (
              <li key={digest.date_pt}>
                <button
                  type="button"
                  aria-pressed={digest.date_pt === current?.digest.date_pt}
                  onClick={() => setShown(digest.date_pt)}
                  className={cn(
                    "min-h-11 rounded-xl border px-3 py-1.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25",
                    digest.date_pt === current?.digest.date_pt
                      ? "border-foreground"
                      : "border-border hover:bg-foreground/[0.04]",
                  )}
                >
                  <span className="block font-medium tabular-nums">{digest.date_pt}</span>
                  <span className="block text-xs text-muted-foreground">
                    {c(
                      `${digest.topics.length} topics · ${digest.sample.posts_scanned} posts`,
                      `${digest.topics.length} 个话题 · ${digest.sample.posts_scanned} 帖`,
                    )}
                    {replaces && (
                      <span className="ml-1 text-negative">{c("· replaces", "· 将覆盖")}</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {current && <XhsDayView key={current.digest.date_pt} day={current.digest} />}
      </div>
    </div>
  );
}
