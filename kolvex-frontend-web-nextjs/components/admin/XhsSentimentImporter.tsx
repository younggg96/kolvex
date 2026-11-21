"use client";

import { useMemo, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { useCopy } from "@/components/decision/shared";
import XhsDayView from "@/components/xhs/XhsDayView";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/lib/i18n";
import { buildXhsCollectionPrompt, todayPt, type XhsDay } from "@/lib/xhsSentiment";

/** Paste one day's xhs-daily.v2 JSON, preview it as readers will see it, then save. */
export default function XhsSentimentImporter() {
  const c = useCopy();
  const [input, setInput] = useState("");
  const [result, setResult] = useState("");
  const [preview, setPreview] = useState<{ digest: XhsDay; replaces: boolean } | null>(null);
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
        const data: { digest: XhsDay; replaces_existing: boolean } = await response.json();
        setPreview({ digest: data.digest, replaces: data.replaces_existing });
        setResult(
          c(
            `Valid: ${data.digest.date_pt}, ${data.digest.topics.length} topic(s).`,
            `校验通过：${data.digest.date_pt}，${data.digest.topics.length} 个话题。`,
          ),
        );
      } else {
        const data: { date_pt: string; topics: number } = await response.json();
        setPreview(null);
        setResult(
          c(
            `Saved ${data.date_pt} with ${data.topics} topic(s).`,
            `已保存 ${data.date_pt}，共 ${data.topics} 个话题。`,
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
      <p className="text-sm font-medium">
        {c("2. Paste the JSON it returns", "2. 粘贴返回的 JSON")}
      </p>
      <Textarea
        ref={textarea}
        aria-label={c("Daily digest JSON", "每日情绪 JSON")}
        placeholder={c("Paste one day of xhs-daily.v2 JSON", "粘贴一天的 xhs-daily.v2 JSON")}
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
          {preview?.replaces ? c("Replace saved day", "覆盖已保存的这一天") : c("Save", "保存")}
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
        {preview?.replaces && (
          <p className="m-0 text-sm font-medium text-negative">
            {c(
              `${preview.digest.date_pt} is already saved. Saving replaces that whole day.`,
              `${preview.digest.date_pt} 已有数据，保存会整天覆盖原内容。`,
            )}
          </p>
        )}
        {preview && <XhsDayView day={preview.digest} />}
      </div>
    </div>
  );
}
