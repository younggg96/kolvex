"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { FileJson, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/lib/i18n";
import { invalidateClientCache } from "@/lib/clientCache";
import BriefContent from "@/components/briefs/BriefContent";
import { BRIEF_TYPES, briefRequest, type BriefType, type DailyBrief, type SavedBrief } from "@/lib/dailyBriefs";

const MAX_BYTES = 2 * 1024 * 1024;
type BriefDetail = { payload: DailyBrief; revision: string };

export default function DailyBriefImporter() {
  const { t } = useTranslation();
  const [edition, setEdition] = useState<"auto" | BriefType>("auto");
  const [text, setText] = useState("");
  const [initialText, setInitialText] = useState("");
  const [editing, setEditing] = useState<{ id: string; revision: string } | null>(null);
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
  const [viewing, setViewing] = useState<DailyBrief | null>(null);
  const [deleting, setDeleting] = useState<{ item: SavedBrief; revision: string } | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [discardAction, setDiscardAction] = useState<(() => void) | null>(null);
  const editor = useRef<HTMLTextAreaElement>(null);
  const listHeading = useRef<HTMLHeadingElement>(null);
  const cancelDelete = useRef<HTMLButtonElement>(null);
  const lock = useRef(false);
  const listRequest = useRef<AbortController | null>(null);
  const dirty = text !== initialText;

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const refresh = useCallback(async () => {
    listRequest.current?.abort();
    const controller = new AbortController();
    listRequest.current = controller;
    const timeout = setTimeout(() => controller.abort(), 30000);
    setListBusy(true); setListError("");
    try {
      const data = await briefRequest<{ items: SavedBrief[]; total: number }>(`?page=${page}${edition === "auto" ? "" : `&type=${edition}`}`, undefined, controller.signal);
      if (!controller.signal.aborted) {
        setItems(data.items); setTotal(data.total);
        const lastPage = Math.max(1, Math.ceil(data.total / 10));
        if (page > lastPage) setPage(lastPage);
      }
    } catch (e) {
      if (listRequest.current === controller) setListError(e instanceof Error && e.name !== "AbortError" ? e.message : "读取超时，请重试。");
    } finally {
      clearTimeout(timeout);
      if (listRequest.current === controller) setListBusy(false);
    }
  }, [page, edition]);
  useEffect(() => { void refresh(); return () => { listRequest.current?.abort(); listRequest.current = null; }; }, [refresh]);

  function update(value: string) {
    setText(value); setPreview(null); setValidated(false); setError(""); setMessage("");
  }
  function reset() {
    update(""); setInitialText(""); setEditing(null);
  }
  function protectDraft(action: () => void) {
    if (dirty) setDiscardAction(() => action); else action();
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
      const data = await briefRequest<BriefDetail>("?validate=1", JSON.stringify(parsed));
      if (editing && data.payload.brief.id !== editing.id) throw new Error("编辑时不能修改日期、期次或 ID，请新增另一份简报。");
      if (!editing && edition !== "auto" && data.payload.brief.type !== edition) throw new Error(`所选期次为${t(`briefs.${edition}`)}，JSON 为${t(`briefs.${data.payload.brief.type}`)}。请检查期次。`);
      setPreview(data.payload); setValidated(true);
    } catch (e) { editor.current?.focus(); throw e; }
  }
  async function save() {
    if (!preview || !validated) return;
    const result = editing
      ? await briefRequest<{ id: string; revision: string }>(`?id=${encodeURIComponent(editing.id)}`, JSON.stringify(preview), undefined, { method: "PUT", revision: editing.revision })
      : await briefRequest<{ id: string; already_exists: boolean }>("", JSON.stringify(preview));
    invalidateClientCache("/api/briefs");
    setMessage(editing ? `已更新 ${result.id}（包含上传的中英文内容）。` : `已保存 ${result.id}。`);
    if ("revision" in result) setEditing({ id: result.id, revision: result.revision });
    else {
      const saved = await briefRequest<BriefDetail>(`?id=${encodeURIComponent(result.id)}`);
      setEditing({ id: result.id, revision: saved.revision });
    }
    setInitialText(text); setValidated(false);
    if (page !== 1) setPage(1); else await refresh();
  }
  async function edit(item: SavedBrief) {
    const result = await briefRequest<BriefDetail>(`?id=${encodeURIComponent(item.id)}`);
    const value = JSON.stringify(result.payload, null, 2);
    update(value); setInitialText(value); setEditing({ id: item.id, revision: result.revision });
    editor.current?.focus(); editor.current?.scrollIntoView({ block: "center" });
  }
  async function remove() {
    if (!deleting || lock.current) return;
    lock.current = true; setBusy(true); setDeleteError("");
    try {
      await briefRequest(`?id=${encodeURIComponent(deleting.item.id)}`, undefined, undefined, { method: "DELETE", revision: deleting.revision });
      invalidateClientCache("/api/briefs");
      if (editing?.id === deleting.item.id) reset();
      setMessage(`已删除 ${deleting.item.id} 及其中英文内容。`); setDeleting(null);
      await refresh();
    } catch (e) { setDeleteError(e instanceof Error ? e.message : "删除失败，请重试。"); }
    finally { lock.current = false; setBusy(false); }
  }

  return <div className="min-w-0 space-y-8">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-2"><h2 className="text-xl font-semibold">日报管理</h2><p id="brief-help" className="max-w-3xl text-sm leading-6 text-muted-foreground">管理盘前 1 小时、盘中、盘后 1 小时的中英文日报。每份 JSON 最大 2 MB；原文用 language 标记 zh 或 en，另一语言放在 translations.en 或 translations.zh。保存或编辑后，所有登录用户按语言偏好阅读。</p></div>
      <Button variant="outline" disabled={busy} onClick={() => protectDraft(reset)}>新增日报</Button>
    </div>
    <div className="max-w-sm space-y-2"><label id="brief-edition-label" htmlFor="brief-edition" className="text-sm font-medium">期次筛选</label><Select value={edition} disabled={busy} onValueChange={value => { setEdition(value as "auto" | BriefType); setPage(1); if (!editing) setValidated(false); }}><SelectTrigger id="brief-edition" aria-labelledby="brief-edition-label"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="auto">全部期次</SelectItem>{BRIEF_TYPES.map(type => <SelectItem key={type} value={type}>{t(`briefs.${type}`)}</SelectItem>)}</SelectContent></Select></div>
    <section className="space-y-4 rounded-xl border border-border p-4 sm:p-6" aria-label={editing ? "编辑日报" : "新增日报"}>
      <h3 className="break-all font-semibold">{editing ? `编辑 ${editing.id}` : "新增日报"}</h3>
      {editing && <p className="text-xs leading-5 text-muted-foreground">日期、期次和 ID 固定。可修改正文、标题，或补充 translations 中的另一种语言；修改后请重新校验。</p>}
      <div className="space-y-2"><label htmlFor="brief-file" className="flex items-center gap-2 text-sm font-medium"><FileJson className="h-4 w-4" aria-hidden="true" />选择 JSON 文件</label><Input id="brief-file" type="file" accept=".json,application/json" disabled={busy} aria-describedby="brief-help" onChange={event => {
        const file = event.target.files?.[0]; event.target.value = "";
        if (!file) return;
        protectDraft(() => { void run(async () => {
          if (!file.name.toLowerCase().endsWith(".json")) throw new Error("请选择 .json 文件。");
          if (file.size > MAX_BYTES) throw new Error("文件超过 2 MB，请缩小后重试。");
          update((await file.text()).replace(/^\uFEFF/, ""));
        }); });
      }} /></div>
      <div className="space-y-2"><label htmlFor="brief-json" className="text-sm font-medium">JSON 内容</label><Textarea ref={editor} id="brief-json" value={text} disabled={busy} onChange={e => update(e.target.value)} spellCheck={false} aria-invalid={!!error} aria-describedby={error ? "brief-help brief-error" : "brief-help"} className="h-72 resize-none font-mono text-xs" /></div>
      <div className="flex flex-wrap items-center gap-3" aria-busy={busy}>
        <Button variant="outline" disabled={busy || !text.trim()} onClick={() => void run(validate)}>校验并预览</Button>
        <Button disabled={busy || !validated} onClick={() => void run(save)}>{editing ? "保存修改" : "保存日报"}</Button>
        <Button variant="ghost" disabled={busy || (!text && !editing)} onClick={() => protectDraft(reset)}>{editing ? "取消编辑" : "清空"}</Button>
        {busy && <span role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />处理中…</span>}
      </div>
      {error && <p id="brief-error" role="alert" className="rounded-xl bg-negative/10 p-4 text-sm leading-6">{error}</p>}
      {message && <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-positive/10 p-4 text-sm"><p>{message}</p>{preview && <Link href={`/dashboard/briefs/${encodeURIComponent(preview.brief.id)}`} className="font-semibold underline underline-offset-4">在日报中查看</Link>}</div>}
    </section>
    {preview && <div className="space-y-5 rounded-xl border border-border bg-card p-4 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4"><h3 className="font-semibold">保存前预览</h3><span className="text-xs text-muted-foreground">语言：{preview.language ?? "zh"}{Object.keys(preview.translations ?? {}).map(language => ` / ${language}`).join("")}</span></div><BriefContent document={preview} /></div>}
    <section className="space-y-4 border-t border-border pt-6" aria-busy={listBusy}>
      <div className="flex items-center justify-between gap-3"><h3 ref={listHeading} tabIndex={-1} className="text-lg font-semibold">已保存日报</h3><Button variant="ghost" size="sm" disabled={listBusy || busy} onClick={() => void refresh()}>刷新列表</Button></div>
      {listError ? <p role="alert" className="text-sm leading-6 text-negative">{listError}</p> : listBusy ? <p role="status" className="text-sm text-muted-foreground">加载中…</p> : !items.length ? <p className="text-sm text-muted-foreground">暂无符合期次的日报。</p> : <ul className="divide-y divide-border">{items.map(item => <li key={item.id} className="flex flex-wrap items-start justify-between gap-4 py-4"><div className="min-w-0 flex-1 basis-48"><p className="text-xs text-muted-foreground">{item.brief_date} · {t(`briefs.${item.brief_type}`)}</p><h4 className="mt-1 break-words text-sm font-semibold">{item.headline}</h4><p className="mt-1 text-xs text-muted-foreground">{item.title}</p></div><div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(async () => { const result = await briefRequest<BriefDetail>(`?id=${encodeURIComponent(item.id)}`); setViewing(result.payload); })}>查看</Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => protectDraft(() => { void run(() => edit(item)); })}>编辑</Button>
        <Button size="sm" variant="ghost" className="text-negative hover:text-negative" disabled={busy} onClick={() => void run(async () => { const result = await briefRequest<BriefDetail>(`?id=${encodeURIComponent(item.id)}`); setDeleteError(""); setDeleting({ item, revision: result.revision }); })}>删除</Button>
      </div></li>)}</ul>}
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">第 {page} 页 · 共 {total} 份</p><div className="flex gap-2"><Button size="sm" variant="outline" disabled={listBusy || busy || page === 1} onClick={() => setPage(p => p - 1)}>上一页</Button><Button size="sm" variant="outline" disabled={listBusy || busy || page * 10 >= total} onClick={() => setPage(p => p + 1)}>下一页</Button></div></div>
    </section>
    <Dialog open={!!viewing} onOpenChange={open => { if (!open) setViewing(null); }}><DialogContent className="max-w-5xl"><DialogHeader><DialogTitle>日报详情</DialogTitle><DialogDescription>{viewing?.brief.id} · 按当前语言偏好显示上传内容</DialogDescription></DialogHeader>{viewing && <BriefContent document={viewing} />}</DialogContent></Dialog>
    <Dialog open={!!deleting} onOpenChange={open => { if (!open && !busy) setDeleting(null); }}><DialogContent showCloseButton={!busy} onOpenAutoFocus={event => { event.preventDefault(); cancelDelete.current?.focus(); }} onCloseAutoFocus={event => { event.preventDefault(); listHeading.current?.focus(); }}><DialogHeader><DialogTitle>删除这份日报？</DialogTitle><DialogDescription className="break-words">{deleting?.item.brief_date} · {deleting && t(`briefs.${deleting.item.brief_type}`)} · {deleting?.item.headline}。中英文内容将同时删除，读者无法继续查看，此操作无法撤销。</DialogDescription></DialogHeader>{deleteError && <p role="alert" className="text-sm text-negative">{deleteError}</p>}<DialogFooter className="gap-2"><Button ref={cancelDelete} variant="outline" disabled={busy} onClick={() => setDeleting(null)}>取消</Button><Button className="bg-negative text-white hover:bg-negative/90" disabled={busy} onClick={() => void remove()}>{busy ? "正在删除…" : "删除日报"}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={!!discardAction} onOpenChange={open => { if (!open) setDiscardAction(null); }}><DialogContent><DialogHeader><DialogTitle>放弃未保存的修改？</DialogTitle><DialogDescription>当前 JSON 修改尚未保存。继续后将替换或清空这些内容。</DialogDescription></DialogHeader><DialogFooter className="gap-2"><Button variant="outline" onClick={() => setDiscardAction(null)}>继续编辑</Button><Button onClick={() => { const action = discardAction; setDiscardAction(null); action?.(); }}>放弃修改并继续</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
