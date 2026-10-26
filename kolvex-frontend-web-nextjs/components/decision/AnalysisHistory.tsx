"use client";
import { loadClientCache, peekClientCache, subscribeClientCache, invalidateClientCache } from "@/lib/clientCache";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AiTechnicalAnalysis } from "@/lib/stockApi";
import { useTranslation } from "@/lib/i18n";
import { getStockAnalysisHistory, getStockAnalysisVersion, activateStockAnalysis, HistoryError, type AnalysisVersion } from "@/lib/stockAnalysisHistory";
import { useCopy } from "./shared";
import { useAuth } from "@/hooks/useAuth";

function authorLabel<T>(item: AnalysisVersion<T>, c: (en: string, zh: string) => string) {
  if (item.is_owner) return c("You", "我");
  return item.author?.username || item.author?.full_name || c(`User ${item.user_id?.slice(0, 8) || ""}`, `用户 ${item.user_id?.slice(0, 8) || ""}`);
}

function HistoryScope({ history }: { history: { scope: "all" | "mine"; setScope: (scope: "all" | "mine") => void } }) {
  const c = useCopy();
  return <div role="group" aria-label={c("Filter results by author", "按生成者筛选结果")} className="my-3 flex flex-wrap gap-2">
    {(["all", "mine"] as const).map(scope => <Button key={scope} size="sm" variant={scope === history.scope ? "secondary" : "ghost"} aria-pressed={scope === history.scope} onClick={() => history.setScope(scope)}>{scope === "all" ? c("Everyone", "全部用户") : c("Mine", "我的结果")}</Button>)}
  </div>;
}

export function useStockHistory<T>(ticker: string, kind: "technical" | "drawings" | "research") {
  const { user } = useAuth();
  const userId = user?.id;
  const [scope, setScope] = useState<"all" | "mine">("all");
  const historyKey = `/api/market/analysis-history/${encodeURIComponent(ticker)}?kind=${kind}&limit=10&offset=0&scope=${scope}`;
  const cached = peekClientCache<{ items: AnalysisVersion<T>[]; current: AnalysisVersion<T> | null; total: number }>(historyKey);
  const [items, setItems] = useState<AnalysisVersion<T>[]>(() => cached?.items ?? []);
  const [selected, setSelected] = useState<AnalysisVersion<T> | null>(() => cached?.current ?? null);
  const [current, setCurrent] = useState<AnalysisVersion<T> | null>(() => cached?.current ?? null);
  const [total, setTotal] = useState(cached?.total ?? 0);
  const [busy, setBusy] = useState(!cached);
  const resourceKey = JSON.stringify([ticker, kind, scope, userId]);
  const [loadedKey, setLoadedKey] = useState<string | null>(cached ? resourceKey : null);
  const [error, setError] = useState<number | null>(null);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const loadVersion = useCallback((id: string, signal: AbortSignal) => loadClientCache(
    `/api/market/analysis-history/${encodeURIComponent(ticker)}/${encodeURIComponent(id)}`,
    requestSignal => getStockAnalysisVersion<T>(ticker, id, requestSignal),
    { ttl: 5 * 60_000, signal },
  ), [ticker]);
  const load = useCallback(async (offset = 0, selectId?: string, force = true) => {
    controller.current?.abort();
    if (scope === "mine" && !userId) {
      setItems([]); setSelected(null); setCurrent(null); setTotal(0); setBusy(false); setError(null); setLoadedKey(resourceKey);
      return;
    }
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true); setError(null);
    try {
      const key = historyKey.replace("offset=0", `offset=${offset}`);
      const data = await loadClientCache(key, signal => getStockAnalysisHistory<T>(ticker, kind, offset, signal, scope), { ttl: 60_000, force, signal: abort.signal });
      if (abort.signal.aborted) return;
      setItems(previous => offset ? [...previous, ...data.items.filter(item => !previous.some(old => old.id === item.id))] : data.items);
      setCurrent(data.current); setTotal(data.total);
      if (!offset) {
        let next = data.current?.id === selectId ? data.current : data.items.find(item => item.id === selectId) || data.current;
        if (next && kind !== "research" && !next.bars) next = await loadVersion(next.id, abort.signal);
        if (!abort.signal.aborted) setSelected(next);
      }
    } catch (reason) {
      if (!abort.signal.aborted) setError(reason instanceof HistoryError ? reason.status : 0);
    } finally { if (!abort.signal.aborted) { setBusy(false); setLoadedKey(resourceKey); } }
  }, [ticker, kind, scope, userId, resourceKey, historyKey, loadVersion]);
  useEffect(() => {
    generation.current += 1;
    const saved = peekClientCache<{ items: AnalysisVersion<T>[]; current: AnalysisVersion<T> | null; total: number }>(historyKey);
    setItems(saved?.items ?? []); setSelected(saved?.current ?? null); setCurrent(saved?.current ?? null); setTotal(saved?.total ?? 0);
    void load(0, undefined, false);
    return () => { generation.current += 1; controller.current?.abort(); };
  }, [load, historyKey]);
  useEffect(() => subscribeClientCache(prefix => { if (historyKey.startsWith(prefix)) void load(); }), [historyKey, load]);
  async function activate() {
    if (!selected?.is_owner || busy) return;
    const token = generation.current;
    setBusy(true); setError(null);
    try {
      const result = await activateStockAnalysis<T>(ticker, selected.id, current?.is_owner ? current.id : null);
      if (token === generation.current) { setCurrent(result); invalidateClientCache(`/api/market/analysis-history/${encodeURIComponent(ticker)}`); }
    } catch (reason) {
      if (token !== generation.current) return;
      const status = reason instanceof HistoryError ? reason.status : 0;
      if (status === 409) {
        // Reload the pointer before allowing another attempt.
        await load(0, selected.id);
      }
      setError(status);
    } finally { if (token === generation.current) setBusy(false); }
  }
  const select = useCallback(async (item: AnalysisVersion<T> | null) => {
    controller.current?.abort();
    if (!item || kind === "research" || item.bars) {
      setSelected(item); setBusy(false); setError(null); return;
    }
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true); setError(null);
    try {
      const detail = await loadVersion(item.id, abort.signal);
      if (!abort.signal.aborted) setSelected(detail);
    } catch (reason) {
      if (!abort.signal.aborted) setError(reason instanceof HistoryError ? reason.status : 0);
    } finally { if (!abort.signal.aborted) setBusy(false); }
  }, [kind, loadVersion]);
  const pendingResource = loadedKey !== resourceKey;
  return { items: pendingResource ? cached?.items ?? [] : items, selected: pendingResource ? cached?.current ?? null : selected, current: pendingResource ? cached?.current ?? null : current, total: pendingResource ? cached?.total ?? 0 : total, busy: busy || (pendingResource && !cached), error: pendingResource ? null : error, load, select, activate, scope, setScope };
}
export type StockHistoryState<T> = ReturnType<typeof useStockHistory<T>>;

/** The same saved drawing selection is available in compact and fullscreen charts. */
export function DrawingVersionSelector({ history, hidden, disabled = false }: {
  history: StockHistoryState<AiTechnicalAnalysis>;
  hidden: boolean;
  disabled?: boolean;
}) {
  const c = useCopy();
  const { t } = useTranslation();
  const blocked = disabled || history.busy;
  // The selected/current snapshot may be outside the loaded page of history.
  const options = [...history.items];
  for (const item of [history.selected, history.current]) {
    if (item && !options.some(option => option.id === item.id)) options.push(item);
  }
  return <div className="mt-3 min-w-0 border-t border-border pt-3">
    <p className="mb-2 text-sm font-medium">{c("Saved AI drawings", "已保存的 AI 画线")}{!history.busy && ` (${history.total})`}</p>
    <HistoryScope history={history} />
    <Select value={hidden ? "" : history.selected?.id || ""} disabled={blocked || !options.length}
      onValueChange={id => { const item = options.find(option => option.id === id); if (item) void history.select(item); }}>
      <SelectTrigger aria-label={c("Switch AI drawing version", "切换 AI 画线版本")} className="w-full">
        <SelectValue placeholder={history.busy ? c("Loading drawings…", "正在加载画线…") : history.error !== null ? c("Drawings could not be loaded", "画线加载失败") : hidden ? c("Drawings hidden · select a version to show", "画线已隐藏，选择版本重新显示") : c("No saved drawings yet", "暂无已保存的画线")} />
      </SelectTrigger>
      <SelectContent style={{ width: "var(--radix-select-trigger-width)", maxHeight: "min(20rem, var(--radix-select-content-available-height))" }}>
        {options.map(item => <SelectItem key={item.id} value={item.id}>
          <span className="block break-words">
            {new Date(item.created_at).toLocaleString(t("common.intlLocale"), { dateStyle: "medium", timeStyle: "medium" })}
            {` · ${authorLabel(item, c)}`}
            {item.payload.model ? ` · ${item.payload.model}` : ""}
            {item.id === history.current?.id ? c(" · Current", " · 当前版本") : ""}
          </span>
        </SelectItem>)}
      </SelectContent>
    </Select>
    <p className="mt-2 text-xs leading-5 text-muted-foreground">{c("All signed-in users can view these drawings. Your result opens first, otherwise the newest result. Switching only changes your view.", "所有已登录用户都可查看画线。优先显示自己的结果，否则显示最新结果；切换仅改变正在查看的版本。")}</p>
    {history.busy && <p role="status" className="mt-2 text-xs text-muted-foreground">{c("Loading drawings…", "正在加载画线…")}</p>}
    {history.error !== null && <p role="alert" className="mt-2 text-sm">{history.error === 401 ? c("Sign in to view shared drawings.", "请登录后查看共享画线。") : history.error === 409 ? c("The current version changed. Review and try again.", "当前版本已更新，请查看后重试。") : c("Drawing versions could not be loaded or saved. Please retry.", "画线版本加载或保存失败，请重试。")}</p>}
    <div className="mt-2 flex flex-wrap gap-2">
      {history.error !== null && <Button size="sm" variant="outline" disabled={blocked} onClick={() => void history.load(0, history.selected?.id)}>{c("Retry", "重试")}</Button>}
      {history.current && (hidden || history.selected?.id !== history.current.id) && <Button size="sm" variant="ghost" disabled={blocked} onClick={() => void history.select(history.current)}>{c("Back to current drawings", "返回当前画线")}</Button>}
      {!hidden && history.selected?.is_owner && history.selected.id !== history.current?.id && <Button size="sm" variant="outline" disabled={blocked} onClick={() => void history.activate()}>{c("Set as current drawings", "设为当前画线")}</Button>}
      {history.items.length < history.total && <Button size="sm" variant="outline" disabled={blocked} onClick={() => void history.load(history.items.length)}>{c("Load older drawings", "加载更早的画线")}</Button>}
    </div>
  </div>;
}

export default function AnalysisHistory<T>({ history, drawings = false, title }: { history: StockHistoryState<T>; drawings?: boolean; title?: string }) {
  const c = useCopy();
  const { t } = useTranslation();
  const selectedButton = useRef<HTMLButtonElement | null>(null);
  return <>
    <p className="mt-3 text-xs leading-5 text-muted-foreground">{c("All results are shared with signed-in users. Your current result opens first; otherwise the newest result opens.", "所有结果对所有已登录用户可见。默认优先显示自己的当前结果；没有时显示最新结果。")}</p>
    {history.selected && <p className="mt-1 text-xs text-muted-foreground">{c("Generated by", "生成者")} · {authorLabel(history.selected, c)}</p>}
    {history.selected && history.selected.id !== history.current?.id && <p role="status" className="mt-3 text-sm text-muted-foreground">{drawings ? c("Viewing historical drawings", "正在查看历史画线") : c("Viewing a historical analysis", "正在查看历史分析")} · {new Date(history.selected.created_at).toLocaleString(t("common.intlLocale"))}</p>}
    <details className="group/disclosure mt-4 border-t border-border pt-3">
    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded text-sm font-medium hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-details-marker]:hidden"><span>{title || (drawings ? c("AI drawing history", "AI 画线历史") : c("Analysis history", "分析历史"))}{!history.busy && ` (${history.total})`}</span><ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground group-open/disclosure:rotate-180" aria-hidden="true" /></summary>
    <HistoryScope history={history} />
    <p className="mt-2 text-xs leading-5 text-muted-foreground">{drawings ? c("Viewing a version does not change current drawings. Updating drawings keeps previous versions.", "查看历史不会修改当前画线；更新画线会保留旧版本。") : c("Viewing a version does not change the current analysis. New analyses keep previous versions.", "查看历史不会修改当前分析；更新分析会保留旧版本。")}</p>
    {history.error !== null && <div role="alert" className="mt-3 text-sm">
      <p>{history.error === 401 ? c("Sign in to view shared results.", "请登录后查看共享结果。") : history.error === 409 ? c("The current version changed. Review and try again.", "当前版本已更新，请查看最新状态后重试。") : c("History could not be loaded or saved. Please retry.", "历史记录加载或保存失败，请重试。")}</p>
      <Button size="sm" variant="outline" disabled={history.busy} onClick={() => void history.load()}>{c("Retry", "重试")}</Button>
    </div>}
    {history.busy && <p role="status" className="mt-3 text-sm text-muted-foreground">{c("Loading history…", "正在加载历史…")}</p>}
    {!history.busy && history.error === null && !history.items.length && <p className="mt-3 text-sm text-muted-foreground">{c("No saved analyses yet.", "暂无已保存分析。")}</p>}
    <ul className="mt-2 divide-y divide-border">
      {history.items.map(item => <li key={item.id} className="flex flex-wrap items-center gap-2 py-2">
        <Button ref={history.selected?.id === item.id ? selectedButton : undefined} variant={history.selected?.id === item.id ? "secondary" : "ghost"} size="sm" aria-pressed={history.selected?.id === item.id} disabled={history.busy} onClick={() => void history.select(item)}>
          {new Date(item.created_at).toLocaleString(t("common.intlLocale"), { dateStyle: "medium", timeStyle: "medium" })}
        </Button>
        <span className="text-xs text-muted-foreground">{authorLabel(item, c)}</span>
        {history.current?.id === item.id && <span className="text-xs font-medium text-positive">{c("Current", "当前版本")}</span>}
      </li>)}
    </ul>
    <div className="mt-3 flex flex-wrap gap-2">
      {history.selected?.is_owner && history.selected.id !== history.current?.id && <Button variant="outline" size="sm" disabled={history.busy} onClick={async () => { await history.activate(); selectedButton.current?.focus(); }}>{drawings ? c("Set as current drawings", "设为当前画线") : c("Set as current", "设为当前分析")}</Button>}
      {history.current && history.selected?.id !== history.current.id && <Button variant="ghost" size="sm" onClick={() => history.select(history.current)}>{drawings ? c("Back to current drawings", "返回当前画线") : c("Back to current", "返回当前分析")}</Button>}
      {history.items.length < history.total && <Button variant="outline" size="sm" disabled={history.busy} onClick={() => void history.load(history.items.length)}>{c("Load older analyses", "加载更早的分析")}</Button>}
    </div>
  </details></>;
}
