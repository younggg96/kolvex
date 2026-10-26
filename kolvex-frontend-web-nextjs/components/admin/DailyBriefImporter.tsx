"use client";
import { invalidateClientCache } from "@/lib/clientCache";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { FileJson, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import BriefContent from "@/components/briefs/BriefContent";
import { briefRequest, type DailyBrief, type SavedBrief } from "@/lib/dailyBriefs";

const MAX_BYTES = 2 * 1024 * 1024;

export default function DailyBriefImporter() {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<DailyBrief | null>(null);
  const [validated, setValidated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [items, setItems] = useState<SavedBrief[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [listError, setListError] = useState("");
  const [listBusy, setListBusy] = useState(true);
  const editor = useRef<HTMLTextAreaElement>(null);
  const lock = useRef(false);
  const listRequest = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    listRequest.current?.abort();
    const controller = new AbortController();
    listRequest.current = controller;
    const timeout = setTimeout(() => controller.abort(), 30000);
    setListBusy(true);
    setListError("");
    try {
      const data = await briefRequest<{ items: SavedBrief[]; total: number }>(`?page=${page}`, undefined, controller.signal);
      if (!controller.signal.aborted) { setItems(data.items); setTotal(data.total); }
    } catch (e) {
      if (listRequest.current === controller) setListError(e instanceof Error && e.name !== "AbortError" ? e.message : "读取超时，请重试。");
    } finally {
      clearTimeout(timeout);
      if (listRequest.current === controller) setListBusy(false);
    }
  }, [page]);
  useEffect(() => { void refresh(); return () => { listRequest.current?.abort(); listRequest.current = null; }; }, [refresh]);

  function update(value: string) {
    setText(value); setPreview(null); setValidated(false); setError(""); setMessage("");
  }
  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(""); setMessage("");
    try { await action(); }
    catch (e) { setError(e instanceof Error ? e.message : "操作失败，请重试。"); }
    finally { lock.current = false; setBusy(false); }
  }
  async function validate() {
    setPreview(null); setValidated(false);
    try {
      if (new Blob([text]).size > MAX_BYTES) throw new Error("JSON 超过 2 MB，请缩小后重试。");
      let parsed: unknown;
      try { parsed = JSON.parse(text.replace(/^\uFEFF/, "")); }
      catch { throw new Error("JSON 格式错误，请检查引号、逗号和括号。"); }
      const data = await briefRequest<{ payload: DailyBrief }>("?validate=1", JSON.stringify(parsed));
      setPreview(data.payload); setValidated(true);
    } catch (e) { editor.current?.focus(); throw e; }
  }
  async function save() {
    if (!preview || !validated) return;
    const result = await briefRequest<{ id: string; already_exists: boolean }>("", JSON.stringify(preview));
    invalidateClientCache("/api/briefs");
    setMessage(result.already_exists ? `${result.id} 已保存，无需重复导入。` : `已保存 ${result.id}。`);
    setValidated(false);
    if (page !== 1) setPage(1); else await refresh();
  }
  return <div className="min-w-0 space-y-8">
    <div className="space-y-2"><h2 className="text-xl font-semibold">早晚报 JSON 导入</h2><p id="brief-help" className="text-sm leading-6 text-muted-foreground">支持 kolvex-brief/1.0，单份 JSON 最大 2 MB。上传文件或粘贴内容，校验预览后保存。保存后将显示在「早晚报」，所有登录用户可阅读。</p></div>
    <div className="space-y-2"><label htmlFor="brief-file" className="flex items-center gap-2 text-sm font-medium"><FileJson className="h-4 w-4" />选择 JSON 文件</label><Input id="brief-file" type="file" accept=".json,application/json" disabled={busy} aria-describedby="brief-help" onChange={event => {
      const file = event.target.files?.[0]; event.target.value = "";
      if (!file) return;
      setValidated(false); setPreview(null);
      void run(async () => {
        if (!file.name.toLowerCase().endsWith(".json")) throw new Error("请选择 .json 文件。");
        if (file.size > MAX_BYTES) throw new Error("文件超过 2 MB，请缩小后重试。");
        update((await file.text()).replace(/^\uFEFF/, ""));
      });
    }} /></div>
    <div className="space-y-2"><label htmlFor="brief-json" className="text-sm font-medium">JSON 内容</label><Textarea ref={editor} id="brief-json" value={text} disabled={busy} onChange={e => update(e.target.value)} spellCheck={false} aria-invalid={!!error} aria-describedby={error ? "brief-help brief-error" : "brief-help"} placeholder={'{ "schema_version": "kolvex-brief/1.0", "brief": { … }, "sections": [ … ] }'} className="h-72 resize-none font-mono text-xs" /></div>
    <div className="flex flex-wrap items-center gap-3" aria-busy={busy}>
      <Button variant="outline" disabled={busy || !text.trim()} onClick={() => void run(validate)}>校验并预览</Button>
      <Button disabled={busy || !validated} onClick={() => void run(save)}>保存简报</Button>
      <Button variant="ghost" disabled={busy || (!text && !preview)} onClick={() => update("")}>清空</Button>
      {busy && <span role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />处理中…</span>}
    </div>
    {error && <p id="brief-error" role="alert" className="rounded-xl bg-negative/10 p-4 text-sm leading-6">{error}</p>}
    {message && <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-positive/10 p-4 text-sm"><p>{message}</p>{preview && <Link href={`/dashboard/briefs/${encodeURIComponent(preview.brief.id)}`} className="font-semibold underline underline-offset-4">在早晚报中查看</Link>}</div>}
    {preview && <div className="space-y-5 rounded-xl border border-border bg-card p-4 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4"><h2 className="font-semibold">简报预览</h2><span className="break-all text-xs text-muted-foreground">{preview.brief.id} · {preview.sections.length} 个章节</span></div><BriefContent document={preview} /></div>}
    <section className="space-y-4 border-t border-border pt-6" aria-busy={listBusy}>
      <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">已导入简报</h2><Button variant="ghost" size="sm" disabled={listBusy} onClick={() => void refresh()}>刷新列表</Button></div>
      {listError ? <p role="alert" className="text-sm leading-6 text-negative">{listError}</p> : listBusy ? <p role="status" className="text-sm text-muted-foreground">加载中…</p> : !items.length ? <p className="text-sm text-muted-foreground">暂无简报。导入第一份早报或晚报后，会显示在这里。</p> : <ul className="divide-y divide-border">{items.map(item => <li key={item.id} className="flex items-start justify-between gap-4 py-4"><div className="min-w-0"><p className="text-xs text-muted-foreground">{item.brief_date} · {item.brief_type === "morning" ? "早报" : "晚报"}</p><h3 className="mt-1 break-words text-sm font-semibold">{item.headline}</h3><p className="mt-1 text-xs text-muted-foreground">{item.title}</p></div><Button size="sm" variant="outline" disabled={busy} onClick={() => void run(async () => {
        const result = await briefRequest<{ payload: DailyBrief }>(`?id=${encodeURIComponent(item.id)}`);
        const checked = await briefRequest<{ payload: DailyBrief }>("?validate=1", JSON.stringify(result.payload));
        setPreview(checked.payload); setValidated(false);
      })}>查看</Button></li>)}</ul>}
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">第 {page} 页 · 共 {total} 份</p><div className="flex gap-2"><Button size="sm" variant="outline" disabled={listBusy || page === 1} onClick={() => setPage(p => p - 1)}>上一页</Button><Button size="sm" variant="outline" disabled={listBusy || page * 10 >= total} onClick={() => setPage(p => p + 1)}>下一页</Button></div></div>
    </section>
  </div>;
}
