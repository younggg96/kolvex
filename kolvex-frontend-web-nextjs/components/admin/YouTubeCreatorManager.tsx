"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import CreatorAvatar from "@/components/youtube/CreatorAvatar";
import { cn } from "@/lib/utils";
import {
  createCreatorOpinion, deleteYouTubeOpinion, getAdminYouTubeCreators, getCreatorOpinions, updateYouTubeOpinion,
  type OpinionSentiment, type YouTubeCreatorSummary, type YouTubeOpinion, type YouTubeOpinionWrite,
} from "@/lib/youtubeOpinionsApi";

const sentiments: Array<{ value: OpinionSentiment; label: string }> = [
  { value: "bullish", label: "看多" },
  { value: "bearish", label: "看空" },
  { value: "neutral", label: "中性" },
  { value: "mixed", label: "分歧" },
];

type Draft = {
  ticker: string;
  company_name: string;
  sentiment: OpinionSentiment;
  direction_score: string;
  confidence: string;
  time_horizon: string;
  summary: string;
  thesis: string;
  key_points: string;
  risks: string;
  opinion_date: string;
  video_title: string;
  video_url: string;
  video_published_at: string;
  published_original: string;
  price_targets: Array<{ label: string; value: string }>;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function emptyDraft(): Draft {
  return {
    ticker: "", company_name: "", sentiment: "neutral", direction_score: "0", confidence: "",
    time_horizon: "", summary: "", thesis: "", key_points: "", risks: "", opinion_date: today(),
    video_title: "", video_url: "", video_published_at: "", published_original: "", price_targets: [],
  };
}

function lines(value?: string[] | null) {
  return (value || []).join("\n");
}

function draftFrom(opinion: YouTubeOpinion): Draft {
  const published = opinion.video_published_at || "";
  return {
    ticker: opinion.ticker,
    company_name: opinion.company_name || "",
    sentiment: opinion.sentiment,
    direction_score: String(opinion.direction_score ?? 0),
    confidence: opinion.confidence == null ? "" : String(Math.round(opinion.confidence * 100)),
    time_horizon: opinion.time_horizon || "",
    summary: opinion.summary || "",
    thesis: opinion.thesis || "",
    key_points: lines(opinion.key_points),
    risks: lines(opinion.risks),
    opinion_date: (opinion.opinion_date || today()).slice(0, 10),
    video_title: opinion.video_title || "",
    video_url: opinion.video_url || "",
    video_published_at: published.slice(0, 10),
    published_original: published,
    price_targets: (opinion.price_targets || []).flatMap((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const target = item as { label?: unknown; value?: unknown };
      return typeof target.value === "number" ? [{ label: typeof target.label === "string" ? target.label : "", value: String(target.value) }] : [];
    }),
  };
}

function splitLines(value: string) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}

function toPayload(draft: Draft): YouTubeOpinionWrite {
  const score = Number(draft.direction_score);
  const confidence = draft.confidence.trim() ? Number(draft.confidence) / 100 : null;
  const published = draft.video_published_at
    ? draft.published_original.startsWith(draft.video_published_at) ? draft.published_original : `${draft.video_published_at}T00:00:00Z`
    : null;
  return {
    ticker: draft.ticker.trim().toUpperCase(),
    company_name: draft.company_name.trim() || null,
    sentiment: draft.sentiment,
    direction_score: score,
    confidence,
    time_horizon: draft.time_horizon.trim() || null,
    summary: draft.summary.trim(),
    thesis: draft.thesis.trim() || null,
    key_points: splitLines(draft.key_points),
    risks: splitLines(draft.risks),
    price_targets: draft.price_targets.flatMap((target) => {
      const value = Number(target.value);
      return target.value.trim() && Number.isFinite(value) ? [{ label: target.label.trim() || null, value }] : [];
    }),
    opinion_date: draft.opinion_date,
    video_title: draft.video_title.trim() || null,
    video_url: draft.video_url.trim() || null,
    video_published_at: published,
  };
}

function sentimentLabel(value: OpinionSentiment) {
  return sentiments.find((item) => item.value === value)?.label || value;
}

export default function YouTubeCreatorManager() {
  const [creators, setCreators] = useState<YouTubeCreatorSummary[]>([]);
  const [search, setSearch] = useState("");
  const [opinionQuery, setOpinionQuery] = useState("");
  const [selected, setSelected] = useState<YouTubeCreatorSummary | null>(null);
  const [opinions, setOpinions] = useState<YouTubeOpinion[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [loadingOpinions, setLoadingOpinions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const refreshCreators = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError("");
    }
    try {
      const result = await getAdminYouTubeCreators();
      setCreators(result.creators);
      return result.creators;
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : "加载博主失败。");
      return [];
    } finally { if (!silent) setLoading(false); }
  }, []);

  const loadOpinions = useCallback(async (channelId: string) => {
    setLoadingOpinions(true);
    setError("");
    try {
      const result = await getCreatorOpinions(channelId);
      setOpinions(result.opinions);
    } catch (e) {
      setOpinions([]);
      setError(e instanceof Error ? e.message : "加载观点失败。");
    } finally { setLoadingOpinions(false); }
  }, []);

  useEffect(() => { void refreshCreators(); }, [refreshCreators]);

  useEffect(() => {
    if (creating || editingId) formRef.current?.scrollIntoView({ block: "nearest" });
  }, [creating, editingId]);

  function closeForm() {
    setCreating(false);
    setEditingId(null);
    setDraft(emptyDraft());
  }

  async function openCreator(creator: YouTubeCreatorSummary) {
    setSelected(creator);
    setOpinionQuery("");
    setPendingDelete(null);
    setMessage("");
    closeForm();
    await loadOpinions(creator.channel_id);
  }

  function beginCreate() {
    setCreating(true);
    setEditingId(null);
    setDraft(emptyDraft());
    setError("");
    setMessage("");
    setPendingDelete(null);
  }

  function beginEdit(opinion: YouTubeOpinion) {
    setCreating(false);
    setEditingId(opinion.id);
    setDraft(draftFrom(opinion));
    setError("");
    setMessage("");
    setPendingDelete(null);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || saving) return;
    const payload = toPayload(draft);
    if (!payload.ticker || !payload.summary) {
      setError("请填写股票代码和观点摘要。");
      return;
    }
    if (!Number.isFinite(payload.direction_score) || payload.direction_score! < -100 || payload.direction_score! > 100) {
      setError("方向分数必须在 -100 到 100 之间。");
      return;
    }
    if (payload.confidence != null && (!Number.isFinite(payload.confidence) || payload.confidence < 0 || payload.confidence > 1)) {
      setError("置信度请填写 0 到 100。");
      return;
    }
    if (draft.price_targets.some((target) => target.value.trim() && !(Number(target.value) > 0))) {
      setError("目标价必须是大于 0 的数字。");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = editingId
        ? await updateYouTubeOpinion(editingId, payload)
        : await createCreatorOpinion(selected.channel_id, payload);
      setOpinions((current) => editingId
        ? current.map((item) => item.id === editingId ? result.opinion : item)
        : [result.opinion, ...current]);
      const nextCreators = await refreshCreators(true);
      setSelected(nextCreators.find((creator) => creator.channel_id === selected.channel_id) || selected);
      closeForm();
      setMessage(editingId ? `已更新 ${result.opinion.ticker} 的观点。` : `已新增 ${result.opinion.ticker} 的观点。`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败，请重试。");
    } finally { setSaving(false); }
  }

  async function remove(opinion: YouTubeOpinion) {
    if (!selected || saving) return;
    if (pendingDelete !== opinion.id) {
      setPendingDelete(opinion.id);
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await deleteYouTubeOpinion(opinion.id);
      const remaining = opinions.filter((item) => item.id !== opinion.id);
      setOpinions(remaining);
      setPendingDelete(null);
      if (editingId === opinion.id) closeForm();
      const nextCreators = await refreshCreators(true);
      const stillThere = nextCreators.find((creator) => creator.channel_id === selected.channel_id);
      setSelected(stillThere || null);
      setMessage(`已删除 ${opinion.ticker} 的观点。`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败，请重试。");
    } finally { setSaving(false); }
  }

  const query = search.trim().toLowerCase();
  const filtered = creators.filter((creator) => [creator.channel_id, creator.channel_title, creator.channel_handle].some((value) => value?.toLowerCase().includes(query)));
  const opinionSearch = opinionQuery.trim().toLowerCase();
  const visibleOpinions = opinions.filter((opinion) => [opinion.ticker, opinion.summary, opinion.thesis, opinion.video_title].some((value) => value?.toLowerCase().includes(opinionSearch)));
  const formOpen = creating || !!editingId;

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">博主观点</h2>
          <p className="mt-1 text-sm text-muted-foreground">按博主查看、新增、修改或删除股票观点。这里不修改博主名称、账号或头像。</p>
        </div>
      </div>
      {error && <p role="alert" className="break-words rounded-xl bg-negative/10 p-3 text-sm">{error}</p>}
      {message && <p role="status" className="text-sm text-positive">{message}</p>}

      {selected && (
        <section className="space-y-4 rounded-2xl border border-border p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <CreatorAvatar name={selected.channel_title || selected.channel_id} avatarUrl={selected.channel_avatar_url} />
              <div className="min-w-0">
                <h3 className="break-words font-semibold">{selected.channel_title || selected.channel_id} 的观点</h3>
                <p className="text-xs text-muted-foreground">{selected.channel_handle || "未设置账号"} · {opinions.length} 条观点</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" disabled={saving || formOpen} onClick={beginCreate}>新增观点</Button>
              <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => { setSelected(null); closeForm(); setError(""); }}>返回</Button>
            </div>
          </div>

          {formOpen && (
            <form ref={formRef} onSubmit={save} className="space-y-4 border-t border-border pt-4">
              <h4 className="font-semibold">{editingId ? "编辑观点" : "新增观点"}</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="股票代码" id="opinion-ticker">
                  <Input id="opinion-ticker" value={draft.ticker} required maxLength={20} disabled={saving} placeholder="NVDA"
                    onChange={(event) => setDraft((current) => ({ ...current, ticker: event.target.value.toUpperCase() }))} />
                </Field>
                <Field label="公司名称" id="opinion-company">
                  <Input id="opinion-company" value={draft.company_name} maxLength={200} disabled={saving} placeholder="NVIDIA"
                    onChange={(event) => setDraft((current) => ({ ...current, company_name: event.target.value }))} />
                </Field>
                <Field label="观点方向" id="opinion-sentiment">
                  <select id="opinion-sentiment" value={draft.sentiment} disabled={saving}
                    className={cn("flex h-10 w-full rounded-xl border border-transparent bg-muted px-3.5 text-sm")}
                    onChange={(event) => setDraft((current) => ({ ...current, sentiment: event.target.value as OpinionSentiment }))}>
                    {sentiments.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </Field>
                <Field label="方向分数" id="opinion-score" hint="-100 看空，100 看多">
                  <Input id="opinion-score" type="number" min={-100} max={100} step="0.01" required value={draft.direction_score} disabled={saving}
                    onChange={(event) => setDraft((current) => ({ ...current, direction_score: event.target.value }))} />
                </Field>
                <Field label="置信度" id="opinion-confidence" hint="0 到 100，可留空">
                  <Input id="opinion-confidence" type="number" min={0} max={100} step="1" value={draft.confidence} disabled={saving} placeholder="85"
                    onChange={(event) => setDraft((current) => ({ ...current, confidence: event.target.value }))} />
                </Field>
                <Field label="观点日期" id="opinion-date">
                  <Input id="opinion-date" type="date" required value={draft.opinion_date} disabled={saving}
                    onChange={(event) => setDraft((current) => ({ ...current, opinion_date: event.target.value }))} />
                </Field>
                <Field label="时间范围" id="opinion-horizon">
                  <Input id="opinion-horizon" value={draft.time_horizon} maxLength={80} disabled={saving} placeholder="3-6 months"
                    onChange={(event) => setDraft((current) => ({ ...current, time_horizon: event.target.value }))} />
                </Field>
                <Field label="视频发布时间" id="opinion-published">
                  <Input id="opinion-published" type="date" value={draft.video_published_at} disabled={saving}
                    onChange={(event) => setDraft((current) => ({ ...current, video_published_at: event.target.value }))} />
                </Field>
              </div>
              <Field label="视频标题" id="opinion-video-title">
                <Input id="opinion-video-title" value={draft.video_title} maxLength={300} disabled={saving}
                  onChange={(event) => setDraft((current) => ({ ...current, video_title: event.target.value }))} />
              </Field>
              <Field label="视频链接" id="opinion-video-url">
                <Input id="opinion-video-url" type="url" value={draft.video_url} maxLength={2048} disabled={saving} placeholder="https://www.youtube.com/watch?v=…"
                  onChange={(event) => setDraft((current) => ({ ...current, video_url: event.target.value }))} />
              </Field>
              <Field label="观点摘要" id="opinion-summary">
                <Textarea id="opinion-summary" required maxLength={4000} value={draft.summary} disabled={saving}
                  onChange={(event) => setDraft((current) => ({ ...current, summary: event.target.value }))} />
              </Field>
              <Field label="理由" id="opinion-thesis">
                <Textarea id="opinion-thesis" maxLength={8000} value={draft.thesis} disabled={saving}
                  onChange={(event) => setDraft((current) => ({ ...current, thesis: event.target.value }))} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="要点" id="opinion-points" hint="每行一条">
                  <Textarea id="opinion-points" value={draft.key_points} disabled={saving}
                    onChange={(event) => setDraft((current) => ({ ...current, key_points: event.target.value }))} />
                </Field>
                <Field label="风险" id="opinion-risks" hint="每行一条">
                  <Textarea id="opinion-risks" value={draft.risks} disabled={saving}
                    onChange={(event) => setDraft((current) => ({ ...current, risks: event.target.value }))} />
                </Field>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">目标价</span>
                  <Button type="button" variant="outline" size="sm" disabled={saving || draft.price_targets.length >= 10}
                    onClick={() => setDraft((current) => ({ ...current, price_targets: [...current.price_targets, { label: "", value: "" }] }))}>添加</Button>
                </div>
                {draft.price_targets.map((target, index) => (
                  <div key={index} className="grid grid-cols-[1fr_8rem_auto] gap-2">
                    <Input aria-label={`目标价名称 ${index + 1}`} value={target.label} maxLength={40} disabled={saving} placeholder="base"
                      onChange={(event) => setDraft((current) => ({ ...current, price_targets: current.price_targets.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item) }))} />
                    <Input aria-label={`目标价 ${index + 1}`} type="number" min="0" step="0.01" value={target.value} disabled={saving} placeholder="165"
                      onChange={(event) => setDraft((current) => ({ ...current, price_targets: current.price_targets.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item) }))} />
                    <Button type="button" variant="ghost" size="sm" disabled={saving}
                      onClick={() => setDraft((current) => ({ ...current, price_targets: current.price_targets.filter((_, itemIndex) => itemIndex !== index) }))}>移除</Button>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                <Button type="submit" disabled={saving || !draft.ticker.trim() || !draft.summary.trim()}>{saving ? "保存中…" : editingId ? "保存修改" : "添加观点"}</Button>
                <Button type="button" variant="outline" disabled={saving} onClick={closeForm}>取消</Button>
              </div>
            </form>
          )}

          <Input aria-label="搜索观点" placeholder="搜索股票、摘要或视频标题" value={opinionQuery} onChange={(event) => setOpinionQuery(event.target.value)} />
          {loadingOpinions ? <p role="status" className="text-sm text-muted-foreground">加载观点中…</p> : (
            <div className="divide-y divide-border">
              {visibleOpinions.map((opinion) => (
                <article key={opinion.id} className="flex items-start justify-between gap-3 py-4">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold">{opinion.ticker} · {sentimentLabel(opinion.sentiment)} · {opinion.direction_score}</p>
                    <p className="text-xs text-muted-foreground">{opinion.opinion_date}{opinion.video_title ? ` · ${opinion.video_title}` : ""}</p>
                    <p className="break-words text-sm text-muted-foreground">{opinion.summary}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button variant="outline" size="sm" disabled={saving || formOpen} onClick={() => beginEdit(opinion)}>编辑</Button>
                    <Button variant={pendingDelete === opinion.id ? "destructive" : "ghost"} size="sm" disabled={saving || formOpen} onClick={() => void remove(opinion)}>
                      {pendingDelete === opinion.id ? "确认删除" : "删除"}
                    </Button>
                  </div>
                </article>
              ))}
              {!visibleOpinions.length && <p className="py-4 text-sm text-muted-foreground">{opinions.length ? "没有匹配的观点。" : "这位博主还没有观点。"}</p>}
            </div>
          )}
        </section>
      )}

      {!selected && (
        <>
          <Input aria-label="搜索 YouTube 博主" placeholder="搜索博主名称、账号或频道 ID" value={search} onChange={(event) => setSearch(event.target.value)} />
          {loading ? <p role="status" className="text-sm text-muted-foreground">加载博主中…</p> : (
            <>
              <p className="text-xs text-muted-foreground">共 {filtered.length} 位博主</p>
              <div className="divide-y divide-border">
                {filtered.map((creator) => (
                  <div key={creator.channel_id} className="flex items-start justify-between gap-3 py-4">
                    <CreatorAvatar name={creator.channel_title || creator.channel_id} avatarUrl={creator.channel_avatar_url} />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="break-words text-sm font-semibold">{creator.channel_title || creator.channel_id}</p>
                      <p className="break-all text-xs text-muted-foreground">{creator.channel_handle || "未设置账号"} · {creator.total_opinions} 条观点</p>
                    </div>
                    <Button variant="outline" size="sm" className="shrink-0" aria-label={`管理 ${creator.channel_title || creator.channel_id} 的观点`}
                      disabled={saving} onClick={() => void openCreator(creator)}>观点</Button>
                  </div>
                ))}
                {!filtered.length && <p className="py-4 text-sm text-muted-foreground">{creators.length ? "没有匹配的博主。" : "暂无博主，请先导入 YouTube 视频观点。"}</p>}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function Field({ label, id, hint, children }: { label: string; id: string; hint?: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-2">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
