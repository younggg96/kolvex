"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { getStockAnalysisHistory, getStockAnalysisVersion, activateStockAnalysis, HistoryError, type AnalysisVersion } from "@/lib/stockAnalysisHistory";
import { useCopy } from "./shared";

export function useStockHistory<T>(ticker: string, kind: "technical" | "drawings" | "research") {
  const [items, setItems] = useState<AnalysisVersion<T>[]>([]);
  const [selected, setSelected] = useState<AnalysisVersion<T> | null>(null);
  const [current, setCurrent] = useState<AnalysisVersion<T> | null>(null);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<number | null>(null);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const load = useCallback(async (offset = 0, selectId?: string) => {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true); setError(null);
    try {
      const data = await getStockAnalysisHistory<T>(ticker, kind, offset, abort.signal);
      if (abort.signal.aborted) return;
      setItems(previous => offset ? [...previous, ...data.items.filter(item => !previous.some(old => old.id === item.id))] : data.items);
      setCurrent(data.current); setTotal(data.total);
      if (!offset) {
        let next = data.current?.id === selectId ? data.current : data.items.find(item => item.id === selectId) || data.current;
        if (next && kind !== "research" && !next.bars) next = await getStockAnalysisVersion<T>(ticker, next.id, abort.signal);
        if (!abort.signal.aborted) setSelected(next);
      }
    } catch (reason) {
      if (!abort.signal.aborted) setError(reason instanceof HistoryError ? reason.status : 0);
    } finally { if (!abort.signal.aborted) setBusy(false); }
  }, [ticker, kind]);
  useEffect(() => {
    generation.current += 1;
    setItems([]); setSelected(null); setCurrent(null); setTotal(0);
    void load();
    return () => { generation.current += 1; controller.current?.abort(); };
  }, [load]);
  async function activate() {
    if (!selected || busy) return;
    const token = generation.current;
    setBusy(true); setError(null);
    try {
      const result = await activateStockAnalysis<T>(ticker, selected.id, current?.id || null);
      if (token === generation.current) setCurrent(result);
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
    if (!item || kind === "research" || item.bars) { setSelected(item); return; }
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true); setError(null);
    try {
      const detail = await getStockAnalysisVersion<T>(ticker, item.id, abort.signal);
      if (!abort.signal.aborted) setSelected(detail);
    } catch (reason) {
      if (!abort.signal.aborted) setError(reason instanceof HistoryError ? reason.status : 0);
    } finally { if (!abort.signal.aborted) setBusy(false); }
  }, [ticker, kind]);
  return { items, selected, current, total, busy, error, load, select, activate };
}
export type StockHistoryState<T> = ReturnType<typeof useStockHistory<T>>;

export default function AnalysisHistory<T>({ history, drawings = false, title }: { history: StockHistoryState<T>; drawings?: boolean; title?: string }) {
  const c = useCopy();
  const { t } = useTranslation();
  const selectedButton = useRef<HTMLButtonElement | null>(null);
  return <>
    {history.selected && history.selected.id !== history.current?.id && <p role="status" className="mt-3 text-sm text-muted-foreground">{drawings ? c("Viewing historical drawings", "正在查看历史画线") : c("Viewing a historical analysis", "正在查看历史分析")} · {new Date(history.selected.created_at).toLocaleString(t("common.intlLocale"))}</p>}
    <details className="mt-4 border-t border-border pt-3">
    <summary className="cursor-pointer text-sm font-medium">{title || (drawings ? c("AI drawing history", "AI 画线历史") : c("Analysis history", "分析历史"))} ({history.total})</summary>
    <p className="mt-2 text-xs leading-5 text-muted-foreground">{drawings ? c("Viewing a version does not change current drawings. Updating drawings keeps previous versions.", "查看历史不会修改当前画线；更新画线会保留旧版本。") : c("Viewing a version does not change the current analysis. New analyses keep previous versions.", "查看历史不会修改当前分析；更新分析会保留旧版本。")}</p>
    {history.error !== null && <div role="alert" className="mt-3 text-sm">
      <p>{history.error === 401 ? c("Sign in to view your analysis history.", "请登录后查看个人分析历史。") : history.error === 409 ? c("The current version changed. Review and try again.", "当前版本已更新，请查看最新状态后重试。") : c("History could not be loaded or saved. Please retry.", "历史记录加载或保存失败，请重试。")}</p>
      <Button size="sm" variant="outline" disabled={history.busy} onClick={() => void history.load()}>{c("Retry", "重试")}</Button>
    </div>}
    {history.busy && <p role="status" className="mt-3 text-sm text-muted-foreground">{c("Loading history…", "正在加载历史…")}</p>}
    {!history.busy && history.error === null && !history.items.length && <p className="mt-3 text-sm text-muted-foreground">{c("No saved analyses yet.", "暂无已保存分析。")}</p>}
    <ul className="mt-2 divide-y divide-border">
      {history.items.map(item => <li key={item.id} className="flex flex-wrap items-center gap-2 py-2">
        <Button ref={history.selected?.id === item.id ? selectedButton : undefined} variant={history.selected?.id === item.id ? "secondary" : "ghost"} size="sm" aria-pressed={history.selected?.id === item.id} disabled={history.busy} onClick={() => void history.select(item)}>
          {new Date(item.created_at).toLocaleString(t("common.intlLocale"), { dateStyle: "medium", timeStyle: "medium" })}
        </Button>
        {history.current?.id === item.id && <span className="text-xs font-medium text-positive">{c("Current", "当前版本")}</span>}
      </li>)}
    </ul>
    <div className="mt-3 flex flex-wrap gap-2">
      {history.selected && history.selected.id !== history.current?.id && <Button variant="outline" size="sm" disabled={history.busy} onClick={async () => { await history.activate(); selectedButton.current?.focus(); }}>{drawings ? c("Set as current drawings", "设为当前画线") : c("Set as current", "设为当前分析")}</Button>}
      {history.current && history.selected?.id !== history.current.id && <Button variant="ghost" size="sm" onClick={() => history.select(history.current)}>{drawings ? c("Back to current drawings", "返回当前画线") : c("Back to current", "返回当前分析")}</Button>}
      {history.items.length < history.total && <Button variant="outline" size="sm" disabled={history.busy} onClick={() => void history.load(history.items.length)}>{c("Load older analyses", "加载更早的分析")}</Button>}
    </div>
  </details></>;
}
