"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getAdminYouTubeCreators, updateYouTubeCreator,
  type YouTubeCreatorSummary, type YouTubeCreatorUpdate,
} from "@/lib/youtubeOpinionsApi";

const fields = [
  { key: "channel_title", label: "博主名称", placeholder: "博主名称", type: "text", maxLength: 200 },
  { key: "channel_handle", label: "YouTube 账号", placeholder: "@creator", type: "text", maxLength: 200 },
  { key: "channel_url", label: "频道链接", placeholder: "https://www.youtube.com/@creator", type: "url", maxLength: 2048 },
  { key: "channel_avatar_url", label: "头像链接", placeholder: "https://…", type: "url", maxLength: 2048 },
] as const;

export default function YouTubeCreatorManager() {
  const [creators, setCreators] = useState<YouTubeCreatorSummary[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<YouTubeCreatorSummary | null>(null);
  const [draft, setDraft] = useState<YouTubeCreatorUpdate>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getAdminYouTubeCreators();
      setCreators(result.creators);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载博主失败。");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (selected) {
      formRef.current?.scrollIntoView({ block: "nearest" });
      nameRef.current?.focus({ preventScroll: true });
    }
  }, [selected]);

  function edit(creator: YouTubeCreatorSummary) {
    setSelected(creator);
    setDraft(Object.fromEntries(fields.map(({ key }) => [key, creator[key] || ""])));
    setError("");
    setMessage("");
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || saving) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const values = Object.fromEntries(fields.map(({ key }) => [key, draft[key]?.trim() || null]));
      const result = await updateYouTubeCreator(selected.channel_id, values);
      setCreators((current) => current.map((creator) => creator.channel_id === selected.channel_id ? result.creator : creator));
      setSelected(null);
      setMessage(`已保存 ${result.creator.channel_title || result.creator.channel_id} 的资料。`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败，请重试。");
    } finally { setSaving(false); }
  }

  const query = search.trim().toLowerCase();
  const filtered = creators.filter((creator) => [creator.channel_id, creator.channel_title, creator.channel_handle].some((value) => value?.toLowerCase().includes(query)));

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">YouTube 博主管理</h2>
          <p className="mt-1 text-sm text-muted-foreground">修改资料会同步到该博主的所有股票观点。重新导入视频时，资料会按导入内容更新。</p>
        </div>
        <Button variant="outline" size="sm" disabled={loading || saving || !!selected} onClick={() => void refresh()}>刷新博主</Button>
      </div>
      {error && <p role="alert" className="break-words rounded-xl bg-negative/10 p-3 text-sm">{error}</p>}
      {message && <p role="status" className="text-sm text-positive">{message}</p>}
      {selected && (
        <form ref={formRef} onSubmit={save} className="space-y-4 rounded-2xl border border-border p-4">
          <h3 className="break-words font-semibold">编辑 {selected.channel_title || selected.channel_id}</h3>
          <p className="break-all font-mono text-xs text-muted-foreground">频道 ID：{selected.channel_id}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map(({ key, label, placeholder, type, maxLength }) => (
              <div key={key} className="min-w-0 space-y-2">
                <label htmlFor={`creator-${key}`} className="text-sm font-medium">{label}</label>
                <Input ref={key === "channel_title" ? nameRef : undefined} id={`creator-${key}`} type={type} value={draft[key] || ""} placeholder={placeholder}
                  required={key === "channel_title"} maxLength={maxLength} disabled={saving}
                  onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))} />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <Button type="submit" disabled={saving || !draft.channel_title?.trim()}>{saving ? "保存中…" : "保存修改"}</Button>
            <Button type="button" variant="outline" disabled={saving} onClick={() => { setSelected(null); setError(""); }}>取消</Button>
          </div>
        </form>
      )}
      <Input aria-label="搜索 YouTube 博主" placeholder="搜索博主名称、账号或频道 ID" value={search} onChange={(event) => setSearch(event.target.value)} />
      {loading ? <p role="status" className="text-sm text-muted-foreground">加载博主中…</p> : (
        <>
          <p className="text-xs text-muted-foreground">共 {filtered.length} 位博主</p>
          <div className="divide-y divide-border">
            {filtered.map((creator) => (
              <div key={creator.channel_id} className="flex items-start justify-between gap-3 py-4">
                <div className="min-w-0 space-y-1">
                  <p className="break-words text-sm font-semibold">{creator.channel_title || creator.channel_id}</p>
                  <p className="break-all text-xs text-muted-foreground">{creator.channel_handle || "未设置账号"} · {creator.total_opinions} 条观点</p>
                  <p className="break-all font-mono text-xs text-muted-foreground">{creator.channel_id}</p>
                </div>
                <Button variant="outline" size="sm" className="shrink-0" aria-label={`编辑 ${creator.channel_title || creator.channel_id}`}
                  disabled={saving || !!selected} onClick={() => edit(creator)}>编辑</Button>
              </div>
            ))}
            {!filtered.length && <p className="py-4 text-sm text-muted-foreground">{creators.length ? "没有匹配的博主。" : "暂无博主，请先导入 YouTube 视频观点。"}</p>}
          </div>
        </>
      )}
    </div>
  );
}
