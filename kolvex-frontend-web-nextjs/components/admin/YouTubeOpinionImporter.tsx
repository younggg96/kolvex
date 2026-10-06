"use client";

import { useState } from "react";
import { CheckCircle2, ClipboardCopy, Download, FileJson, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useUserProfileContext } from "@/components/user/UserProfileProvider";
import { uploadYouTubeOpinionPayload, validateYouTubeOpinionPayload, type YouTubeImportPreview } from "@/lib/youtubeOpinionsApi";

const template = {
  channel: { id: "REPLACE_CHANNEL_ID", title: "REPLACE_CREATOR_NAME", handle: "@creator", url: "https://www.youtube.com/@creator" },
  video: { id: "REPLACE_VIDEO_ID", title: "REPLACE_VIDEO_TITLE", url: "https://www.youtube.com/watch?v=REPLACE_VIDEO_ID", published_at: "2026-10-06T15:00:00Z", analyzed_at: "2026-10-06T16:00:00Z" },
  model: "gemini",
  opinions: [{ ticker: "NVDA", company_name: "NVIDIA", sentiment: "bullish", direction_score: 60, confidence: 0.85, time_horizon: "3-6 months", summary: "REPLACE_WITH_CREATOR_VIEW", thesis: "REPLACE_WITH_REASONING", key_points: ["REPLACE_WITH_KEY_POINT"], risks: ["REPLACE_WITH_RISK"], price_targets: [{ label: "base", value: 165 }] }],
};

const prompt = `Analyze the supplied YouTube video and extract only stock opinions explicitly expressed by its creator. Return a single JSON object matching the template below, with no Markdown fences. Use the actual channel ID/name and video ID/title/URL/publication timestamp. Never invent missing facts: ask for missing required metadata before generating JSON. Use one opinions entry per stock ticker and combine repeated mentions in the same video. sentiment must be bullish, bearish, neutral or mixed. direction_score uses -100 to 100 (bearish negative, bullish positive); confidence uses 0 to 1. Do not infer a directional view from a mere stock mention. Optional facts that are not stated should be omitted; use empty arrays for missing key_points, risks and price_targets. Summaries and reasoning should be in Chinese. Video publication time must use ISO 8601 with timezone; historical views must retain the original publication date. Price targets require a positive numeric value. Return no stock opinions that are not present in the video.\n\n${JSON.stringify(template, null, 2)}`;

export default function YouTubeOpinionImporter({ onImported }: { onImported?: () => void }) {
  const { profile } = useUserProfileContext();
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<YouTubeImportPreview | null>(null);
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [copied, setCopied] = useState(false);

  if (!profile?.is_admin) return null;

  function updateText(value: string) {
    setText(value);
    setPreview(null);
    setPayload(null);
    setError("");
    setResult("");
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(template, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "youtube-opinions-template.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function validate() {
    setBusy(true);
    setError("");
    setResult("");
    setPreview(null);
    setPayload(null);
    try {
      const raw = text.trim().replace(/^```(?:json)?\s*\n?/i, "").replace(/\s*```$/, "");
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("JSON 顶层必须是一个对象，每次导入一个视频。");
      if (JSON.stringify(parsed).includes("REPLACE_")) throw new Error("请将模板中的 REPLACE_ 占位内容替换为真实视频数据。");
      const checked = await validateYouTubeOpinionPayload(parsed as Record<string, unknown>);
      setPayload(parsed as Record<string, unknown>);
      setPreview(checked);
    } catch (e) {
      setError(e instanceof SyntaxError ? "JSON 格式错误，请检查引号、逗号和括号。" : e instanceof Error ? e.message : "校验失败");
    } finally { setBusy(false); }
  }

  async function submit() {
    if (!payload || !preview) return;
    setBusy(true);
    setError("");
    try {
      const imported = await uploadYouTubeOpinionPayload(payload);
      setResult(`已保存 ${imported.inserted_count} 条股票观点：${imported.tickers.join(", ")}。`);
      setPreview(null);
      setPayload(null);
      onImported?.();
    } catch (e) { setError(e instanceof Error ? e.message : "导入失败，可重新提交。"); }
    finally { setBusy(false); }
  }

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={downloadTemplate}><Download className="mr-2 h-4 w-4" />下载 JSON 模板</Button>
        <Button variant="outline" size="sm" onClick={async () => {
          try { await navigator.clipboard.writeText(prompt); setCopied(true); }
          catch { setError("无法复制，请展开下方 Gemini 提示词并选择文本。"); }
        }}><ClipboardCopy className="mr-2 h-4 w-4" />{copied ? "已复制提示词" : "复制 Gemini 提示词"}</Button>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer font-medium">JSON 字段与 Gemini 提示词</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs"><thead><tr className="border-b"><th className="p-2">字段</th><th className="p-2">要求</th></tr></thead><tbody>
            {[
              ["channel.id / title", "必填：真实博主频道 ID / 名称；同一博主保持同一 ID"],
              ["video.id / title / published_at", "必填：真实视频 ID / 标题 / 发布时间（带时区 ISO 8601）"],
              ["opinions[].ticker / summary", "必填：股票代码 / 博主观点摘要；每只股票一条"],
              ["opinions[].sentiment", "必填：bullish 看涨、bearish 看跌、neutral 中性、mixed 分歧"],
              ["direction_score / confidence", "可选：方向分数 -100 到 100；置信度 0 到 1"],
              ["thesis / time_horizon", "可选：观点理由 / 时间范围"],
              ["key_points / risks / price_targets", "可选：要点字符串数组 / 风险字符串数组 / 目标价对象数组"],
            ].map(([field, description]) => <tr key={field} className="border-b border-border"><td className="p-2 font-mono">{field}</td><td className="p-2">{description}</td></tr>)}
          </tbody></table>
          <Textarea aria-label="Gemini 提示词" readOnly value={prompt} className="mt-3 h-48 font-mono text-xs" />
        </div>
      </details>
      <div className="space-y-2">
        <label htmlFor="youtube-json-file" className="flex items-center gap-2 text-sm font-medium"><FileJson className="h-4 w-4" />JSON 文件</label>
        <Input id="youtube-json-file" type="file" accept=".json,application/json" disabled={busy} onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          if (file.size > 2 * 1024 * 1024) { setError("文件不能超过 2 MB。"); return; }
          setBusy(true);
          try { updateText(await file.text()); } catch { setError("文件读取失败。"); }
          finally { setBusy(false); }
        }} />
      </div>
      <div className="space-y-2">
        <label htmlFor="youtube-json-payload" className="text-sm font-medium">JSON 内容</label>
        <Textarea id="youtube-json-payload" value={text} disabled={busy} onChange={(event) => updateText(event.target.value)} spellCheck={false} className="h-64 font-mono text-xs" />
      </div>
      {error && <div role="alert" className="break-words rounded-md border border-destructive/30 p-3 text-sm text-destructive">{error}</div>}
      {result && <div role="status" className="flex items-start gap-2 text-sm text-emerald-600"><CheckCircle2 className="h-4 w-4 shrink-0" />{result}</div>}
      {preview && <section className="space-y-3 border-t pt-4">
        <h3 className="text-sm font-medium">{preview.channel_title} · {preview.video_title} · {preview.count} 条观点</h3>
        <div className="max-h-64 overflow-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b"><th className="p-2">股票</th><th className="p-2">观点</th><th className="p-2">分数</th><th className="p-2">日期</th><th className="p-2">摘要</th></tr></thead><tbody>
          {preview.opinions.map((row) => <tr key={row.ticker} className="border-b"><td className="p-2 font-medium">{row.ticker}</td><td className="p-2">{{ bullish: "看涨", bearish: "看跌", neutral: "中性", mixed: "分歧" }[row.sentiment]}</td><td className="p-2">{row.direction_score}</td><td className="whitespace-nowrap p-2">{row.opinion_date}</td><td className="min-w-40 break-words p-2">{row.summary}</td></tr>)}
        </tbody></table></div>
        <p className="text-xs text-muted-foreground">导入后观点将对所有用户可见。同一视频 ID 与股票代码的记录会被更新；每日变化按视频发布时间统计。</p>
      </section>}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={validate} disabled={busy || !text.trim()}><CheckCircle2 className="mr-2 h-4 w-4" />校验并预览</Button>
        <Button onClick={submit} disabled={busy || !preview || !payload}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}确认导入</Button>
      </div>
    </div>
  );
}
