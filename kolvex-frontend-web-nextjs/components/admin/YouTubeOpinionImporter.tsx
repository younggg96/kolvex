"use client";

import { useState } from "react";
import { CheckCircle2, ClipboardCopy, Download, FileJson, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CompanyLogo from "@/components/ui/company-logo";
import CreatorAvatar from "@/components/youtube/CreatorAvatar";
import { Textarea } from "@/components/ui/textarea";
import { useUserProfileContext } from "@/components/user/UserProfileProvider";
import { uploadYouTubeOpinionPayload, validateYouTubeOpinionPayload, type YouTubeImportPreview } from "@/lib/youtubeOpinionsApi";

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_VIDEOS = 50;

const template = {
  channel: { id: "REPLACE_CHANNEL_ID", title: "REPLACE_CREATOR_NAME", handle: "@creator", url: "https://www.youtube.com/@creator" },
  video: { id: "REPLACE_VIDEO_ID", title: "REPLACE_VIDEO_TITLE", url: "https://www.youtube.com/watch?v=REPLACE_VIDEO_ID", published_at: "2026-10-06T15:00:00Z", analyzed_at: "2026-10-06T16:00:00Z" },
  model: "gemini",
  opinions: [{ ticker: "NVDA", company_name: "NVIDIA", sentiment: "bullish", direction_score: 60, confidence: 0.85, time_horizon: "3-6 months", summary: "REPLACE_WITH_CREATOR_VIEW", thesis: "REPLACE_WITH_REASONING", key_points: ["REPLACE_WITH_KEY_POINT"], risks: ["REPLACE_WITH_RISK"], price_targets: [{ label: "base", value: 165 }] }],
};

const prompt = `Analyze the supplied YouTube video and extract only stock opinions explicitly expressed by its creator. Return a single JSON object matching the template below, with no Markdown fences. When several videos are supplied, return a JSON array holding one such object per video. Use the actual channel ID/name and video ID/title/URL/publication timestamp. Never invent missing facts: ask for missing required metadata before generating JSON. Use one opinions entry per stock ticker and combine repeated mentions in the same video. sentiment must be bullish, bearish, neutral or mixed. direction_score uses -100 to 100 (bearish negative, bullish positive); confidence uses 0 to 1. Do not infer a directional view from a mere stock mention. Optional facts that are not stated should be omitted; use empty arrays for missing key_points, risks and price_targets. Summaries and reasoning should be in Chinese. Video publication time must use ISO 8601 with timezone; historical views must retain the original publication date. Price targets require a positive numeric value. Return no stock opinions that are not present in the video.\n\n${JSON.stringify(template, null, 2)}`;

type Payload = Record<string, unknown>;

function parsePayloads(value: string): Payload[] {
  const raw = value.trim().replace(/^```(?:json)?\s*\n?/i, "").replace(/\s*```$/, "");
  const parsed: unknown = JSON.parse(raw);
  const items = Array.isArray(parsed) ? parsed : [parsed];
  if (!items.length || items.some((item) => !item || typeof item !== "object" || Array.isArray(item)))
    throw new Error("JSON 必须是一个视频对象，或由多个视频对象组成的数组。");
  return items as Payload[];
}

function serialize(payloads: Payload[]) {
  return JSON.stringify(payloads.length === 1 ? payloads[0] : payloads, null, 2);
}

function sourceLabels(names: string[]) {
  const counts = new Map<string, number>();
  names.forEach((name) => counts.set(name, (counts.get(name) ?? 0) + 1));
  return [...counts].map(([name, count]) => (count > 1 ? `${name} ×${count}` : name));
}

export default function YouTubeOpinionImporter({ onImported }: { onImported?: () => void }) {
  const { profile } = useUserProfileContext();
  const [text, setText] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  const [preview, setPreview] = useState<YouTubeImportPreview | null>(null);
  const [payloads, setPayloads] = useState<Payload[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [copied, setCopied] = useState(false);

  if (!profile?.is_admin) return null;

  function updateText(value: string, nextSources: string[] = []) {
    setText(value);
    setSources(nextSources);
    setPreview(null);
    setPayloads(null);
    setError("");
    setResult("");
  }

  function videoLabel(index: number) {
    return sources[index] || `视频 ${index + 1}`;
  }

  // Keep already loaded videos so several files can be picked in separate rounds.
  function loadedPayloads() {
    if (!text.trim()) return { payloads: [] as Payload[], names: [] as string[] };
    try {
      const loaded = parsePayloads(text);
      return { payloads: loaded, names: sources.length === loaded.length ? sources : loaded.map((_, index) => `视频 ${index + 1}`) };
    } catch {
      return { payloads: [] as Payload[], names: [] as string[] };
    }
  }

  async function addFiles(files: File[]) {
    setError("");
    const oversized = files.find((file) => file.size > MAX_FILE_BYTES);
    if (oversized) {
      setError(`${oversized.name} 超过 2 MB，请拆分后再上传。`);
      return;
    }
    setBusy(true);
    try {
      const loaded = loadedPayloads();
      const nextPayloads = [...loaded.payloads];
      const nextSources = [...loaded.names];
      for (const file of files) {
        let parsed: Payload[];
        try {
          parsed = parsePayloads(await file.text());
        } catch {
          setError(`${file.name} 不是有效的视频 JSON。`);
          return;
        }
        nextPayloads.push(...parsed);
        nextSources.push(...parsed.map(() => file.name));
      }
      if (nextPayloads.length > MAX_VIDEOS) {
        setError(`单次最多导入 ${MAX_VIDEOS} 个视频，当前为 ${nextPayloads.length} 个。`);
        return;
      }
      updateText(serialize(nextPayloads), nextSources);
    } catch {
      setError("文件读取失败。");
    } finally {
      setBusy(false);
    }
  }

  function downloadTemplate(batch: boolean) {
    const content = batch ? [template, template] : template;
    const url = URL.createObjectURL(new Blob([JSON.stringify(content, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = batch ? "youtube-opinions-batch-template.json" : "youtube-opinions-template.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function validate() {
    setBusy(true);
    setError("");
    setResult("");
    setPreview(null);
    setPayloads(null);
    try {
      const parsed = parsePayloads(text);
      if (parsed.length > MAX_VIDEOS) throw new Error(`单次最多导入 ${MAX_VIDEOS} 个视频，当前为 ${parsed.length} 个。`);
      if (JSON.stringify(parsed).includes("REPLACE_")) throw new Error("请将模板中的 REPLACE_ 占位内容替换为真实视频数据。");
      const checked = await validateYouTubeOpinionPayload(parsed);
      setPayloads(parsed);
      setPreview(checked);
    } catch (e) {
      setError(e instanceof SyntaxError ? "JSON 格式错误，请检查引号、逗号和括号。" : e instanceof Error ? e.message : "校验失败");
    } finally { setBusy(false); }
  }

  async function submit() {
    if (!payloads || !preview || preview.errors.length) return;
    setBusy(true);
    setError("");
    try {
      const imported = await uploadYouTubeOpinionPayload(payloads);
      const tickers = [...new Set(imported.videos.flatMap((video) => video.tickers))];
      updateText("");
      const corrected = imported.corrected_channels ?? [];
      const correctedNote = corrected.length
        ? ` 已按 YouTube 视频归属修正 ${corrected.length} 个视频的频道 ID：${corrected.map((item) => `${item.from} → ${item.to}`).join("，")}。`
        : "";
      setResult(`已保存 ${imported.video_count} 个视频的 ${imported.inserted_count} 条股票观点：${tickers.join(", ")}。${correctedNote}`);
      onImported?.();
    } catch (e) { setError(e instanceof Error ? e.message : "导入失败，可重新提交。"); }
    finally { setBusy(false); }
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-border pb-5">
        <Button variant="outline" size="sm" onClick={() => downloadTemplate(false)}><Download className="mr-2 h-4 w-4" />下载 JSON 模板</Button>
        <Button variant="outline" size="sm" onClick={() => downloadTemplate(true)}><Download className="mr-2 h-4 w-4" />下载批量模板</Button>
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
            ].map(([field, description]) => <tr key={field} className="border-b border-border"><td className="max-w-32 break-all p-2 font-mono sm:max-w-none">{field}</td><td className="p-2">{description}</td></tr>)}
          </tbody></table>
          <Textarea aria-label="Gemini 提示词" readOnly value={prompt} className="mt-3 h-48 font-mono text-xs" />
        </div>
      </details>
      <div className="space-y-2">
        <label htmlFor="youtube-json-file" className="flex items-center gap-2 text-sm font-medium"><FileJson className="h-4 w-4" />JSON 文件</label>
        <Input id="youtube-json-file" type="file" accept=".json,application/json" multiple disabled={busy} onChange={async (event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length) await addFiles(files);
        }} />
        <p className="text-xs text-muted-foreground">可一次选择多个文件批量导入，单文件不超过 2 MB，单次最多 {MAX_VIDEOS} 个视频；每个文件可以是一个视频对象或一个视频数组。</p>
      </div>
      {sources.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">已载入 {sources.length} 个视频：</span>
          {sourceLabels(sources).map((label) => <span key={label} className="max-w-full truncate rounded-full bg-muted px-2 py-0.5 font-mono">{label}</span>)}
          <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => updateText("")}><X className="mr-1 h-3 w-3" />清空</Button>
        </div>
      )}
      <div className="space-y-2">
        <label htmlFor="youtube-json-payload" className="text-sm font-medium">JSON 内容</label>
        <Textarea id="youtube-json-payload" value={text} disabled={busy} onChange={(event) => updateText(event.target.value)} spellCheck={false} className="h-64 font-mono text-xs" />
      </div>
      {error && <div role="alert" className="break-words rounded-md border border-destructive/30 p-3 text-sm text-destructive">{error}</div>}
      {result && <div role="status" className="flex items-start gap-2 text-sm text-positive"><CheckCircle2 className="h-4 w-4 shrink-0" />{result}</div>}
      {preview && <section className="space-y-4 border-t pt-4">
        <h3 className="text-sm font-medium">{preview.video_count} 个视频 · {preview.count} 条观点{preview.errors.length ? ` · ${preview.errors.length} 个视频未通过校验` : ""}</h3>
        {preview.errors.length > 0 && <ul role="alert" className="space-y-1 rounded-md border border-destructive/30 p-3 text-sm text-destructive">
          {preview.errors.map((item) => <li key={item.index} className="break-words"><span className="font-mono">{videoLabel(item.index)}</span>：{item.message}</li>)}
        </ul>}
        {preview.superseded?.length ? <ul className="space-y-1 rounded-md border border-border p-3 text-xs text-muted-foreground">
          {preview.superseded.map((item) => <li key={item.index} className="break-words"><span className="font-mono">{videoLabel(item.index)}</span> 与 <span className="font-mono">{videoLabel(item.by)}</span> 是同一视频，将以后者为准。</li>)}
        </ul> : null}
        {preview.videos.map((video) => <div key={video.video_id} className="min-w-0 space-y-2">
          <h4 className="flex items-center gap-2 text-sm font-medium"><CreatorAvatar name={video.channel_title || "?"} size="sm" /><span className="min-w-0 break-words">{video.channel_title} · {video.video_title} · {video.count} 条观点</span></h4>
          <div className="max-h-64 min-w-0 overflow-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b"><th className="p-2">股票</th><th className="p-2">观点</th><th className="p-2">分数</th><th className="p-2">日期</th><th className="p-2">摘要</th></tr></thead><tbody>
            {video.opinions.map((row) => <tr key={row.ticker} className="border-b"><td className="p-2 font-medium"><span className="inline-flex items-center gap-2"><span aria-hidden="true"><CompanyLogo symbol={row.ticker} size="xs" /></span>{row.ticker}</span></td><td className="p-2">{{ bullish: "看涨", bearish: "看跌", neutral: "中性", mixed: "分歧" }[row.sentiment]}</td><td className="p-2">{row.direction_score}</td><td className="whitespace-nowrap p-2">{row.opinion_date}</td><td className="min-w-40 break-words p-2">{row.summary}</td></tr>)}
          </tbody></table></div>
        </div>)}
        <p className="text-xs text-muted-foreground">导入后观点将对所有用户可见。同一视频可重复导入，以最后一次导入为准：该视频已有的股票观点会被整体替换，新 JSON 中没有的股票将被移除；每日变化按视频发布时间统计。校验未通过的视频需要先修正，否则本次导入不会写入任何数据。</p>
      </section>}
      <div className="grid grid-cols-2 gap-2 border-t border-border bg-background py-4 sm:sticky sm:bottom-0 sm:flex sm:flex-wrap">
        <Button variant="outline" className="h-11 px-2 sm:px-4" onClick={validate} disabled={busy || !text.trim()}><CheckCircle2 className="mr-2 h-4 w-4" />校验并预览</Button>
        <Button className="h-11 px-2 sm:px-4" onClick={submit} disabled={busy || !preview || !payloads || preview.errors.length > 0}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}确认导入</Button>
      </div>
    </div>
  );
}
