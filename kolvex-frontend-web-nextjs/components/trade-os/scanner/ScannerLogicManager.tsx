"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Pencil, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { useCopy } from "@/components/decision/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createScannerLogic,
  deleteScannerLogic,
  fetchScannerLogicSpec,
  fetchScannerLogics,
  updateScannerLogic,
  type ScannerLogic,
  type ScannerLogicParams,
  type ScannerLogicSpec,
} from "@/lib/tradeOsApi";
import { cn } from "@/lib/utils";

type Copy = (en: string, zh: string) => string;
type ParamKey = keyof ScannerLogicParams;

const STORAGE_KEY = "kolvex:trade-os:scanner-logic";

/** How each number is shown and typed: percentages as %, dollar volume in $M. */
const FIELDS: Record<ParamKey, { en: string; zh: string; unit: string; scale: number }> = {
  min_price: { en: "Minimum price", zh: "最低股价", unit: "$", scale: 1 },
  min_avg_dollar_volume: {
    en: "20-day avg dollar volume",
    zh: "20 日均成交额",
    unit: "$M",
    scale: 1e-6,
  },
  rs20_min: {
    en: "20-day return vs SPY, at least",
    zh: "20 日相对 SPY 至少",
    unit: "%",
    scale: 100,
  },
  pivot_lookback: { en: "New-high lookback", zh: "新高回看", unit: "days", scale: 1 },
  pullback_min_days: { en: "Pullback days, min", zh: "回调天数下限", unit: "days", scale: 1 },
  pullback_max_days: { en: "Pullback days, max", zh: "回调天数上限", unit: "days", scale: 1 },
  pullback_min_depth: { en: "Pullback depth, min", zh: "回调幅度下限", unit: "%", scale: 100 },
  pullback_max_depth: { en: "Pullback depth, max", zh: "回调幅度上限", unit: "%", scale: 100 },
  ema_touch_atr: { en: "Touch EMA20 within", zh: "回踩 EMA20 距离", unit: "×ATR", scale: 1 },
  stop_atr_buffer: {
    en: "Stop below pullback low",
    zh: "止损低于回调低点",
    unit: "×ATR",
    scale: 1,
  },
  target_r_multiple: { en: "Target", zh: "目标", unit: "R", scale: 1 },
  min_stop_distance: { en: "Stop distance, min", zh: "止损距离下限", unit: "%", scale: 100 },
  max_stop_distance: { en: "Stop distance, max", zh: "止损距离上限", unit: "%", scale: 100 },
  entry_window_days: { en: "Entry window", zh: "入场有效期", unit: "days", scale: 1 },
  max_gap_r: {
    en: "Cancel if it opens above entry by",
    zh: "开盘跳空超过入场价",
    unit: "R",
    scale: 1,
  },
  earnings_blackout_sessions: {
    en: "Skip if earnings within",
    zh: "财报回避",
    unit: "sessions",
    scale: 1,
  },
  time_exit_day: { en: "Exit after holding", zh: "最长持有", unit: "days", scale: 1 },
};

const GROUPS: { en: string; zh: string; rows: (ParamKey | [ParamKey, ParamKey])[] }[] = [
  { en: "Liquidity", zh: "流动性", rows: ["min_price", "min_avg_dollar_volume"] },
  { en: "Strength", zh: "相对强度", rows: ["rs20_min"] },
  {
    en: "Pullback",
    zh: "回调形态",
    rows: [
      "pivot_lookback",
      ["pullback_min_days", "pullback_max_days"],
      ["pullback_min_depth", "pullback_max_depth"],
      "ema_touch_atr",
    ],
  },
  {
    en: "Plan",
    zh: "交易计划",
    rows: [
      "stop_atr_buffer",
      "target_r_multiple",
      ["min_stop_distance", "max_stop_distance"],
      "entry_window_days",
      "max_gap_r",
    ],
  },
  {
    en: "Events and exit",
    zh: "事件与离场",
    rows: ["earnings_blackout_sessions", "time_exit_day"],
  },
];

const PAIRS: [ParamKey, ParamKey][] = [
  ["pullback_min_days", "pullback_max_days"],
  ["pullback_min_depth", "pullback_max_depth"],
  ["min_stop_distance", "max_stop_distance"],
];

const unitLabel = (unit: string, c: Copy) =>
  unit === "days" ? c("days", "天") : unit === "sessions" ? c("sessions", "个交易日") : unit;

/** Display value: rounded so 0.03 × 100 reads 3, not 3.0000000000000004. */
const shown = (key: ParamKey, value: number) =>
  String(Math.round(value * FIELDS[key].scale * 1e6) / 1e6);

/** One-paragraph summary of a logic, for the scan rules tooltip. */
export function describeLogic(p: ScannerLogicParams, c: Copy): string {
  const pct = (value: number) => `${Math.round(value * 1000) / 10}%`;
  const vol = Math.round(p.min_avg_dollar_volume / 1e6);
  return c(
    `1) Price ≥ $${p.min_price} and ≥ $${vol}M daily dollar volume. 2) EMA20 > SMA50 > SMA200, close > SMA50. 3) 20-day return beats SPY by more than ${pct(p.rs20_min)} (sorted by this). 4) No earnings in ${p.earnings_blackout_sessions} trading days. Then a new ${p.pivot_lookback}-day high, a ${p.pullback_min_days}–${p.pullback_max_days} day / ${pct(p.pullback_min_depth)}–${pct(p.pullback_max_depth)} pullback that comes within ${p.ema_touch_atr}×ATR of the EMA20, and a strong close above the prior day's high. Entry = signal high + $0.01, stop = pullback low − ${p.stop_atr_buffer}×ATR (stop distance ${pct(p.min_stop_distance)}–${pct(p.max_stop_distance)}), target = ${p.target_r_multiple}R. Valid for ${p.entry_window_days} trading days; cancelled if it opens more than ${p.max_gap_r}R above entry. Exit on day ${p.time_exit_day} or the session before earnings if neither is hit.`,
    `1）股价 ≥ $${p.min_price}，日均成交额 ≥ ${vol} 百万美元。2）EMA20 > SMA50 > SMA200，收盘 > SMA50。3）近 20 日涨幅超过 SPY ${pct(p.rs20_min)} 以上（按此排序）。4）未来 ${p.earnings_blackout_sessions} 个交易日无财报。然后：创 ${p.pivot_lookback} 日新高后回调 ${p.pullback_min_days}–${p.pullback_max_days} 天、幅度 ${pct(p.pullback_min_depth)}–${pct(p.pullback_max_depth)}、最低价到 EMA20 的距离在 ${p.ema_touch_atr}×ATR 以内，并出现收盘高于前一日最高价的阳线。入场 = 信号日最高价 + $0.01，止损 = 回调低点 − ${p.stop_atr_buffer}×ATR（止损距离 ${pct(p.min_stop_distance)}–${pct(p.max_stop_distance)}），目标 = ${p.target_r_multiple}R，信号有效 ${p.entry_window_days} 个交易日，开盘跳空高于入场价 ${p.max_gap_r}R 以上则作废。止损和目标都没碰到时，持有满 ${p.time_exit_day} 天或财报前最后一个交易日离场。`,
  );
}

function readSelected(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) || "default";
  } catch {
    return "default";
  }
}

/** The user's logics plus the one picked for scanning (remembered per browser). */
export function useScannerLogics() {
  const [logics, setLogics] = useState<ScannerLogic[]>([]);
  const [spec, setSpec] = useState<ScannerLogicSpec | null>(null);
  const [failed, setFailed] = useState(false);
  const [selectedKey, setSelectedKeyState] = useState("default");

  const refresh = useCallback(async () => {
    try {
      const [list, limits] = await Promise.all([fetchScannerLogics(), fetchScannerLogicSpec()]);
      setLogics(list);
      setSpec(limits);
      setFailed(false);
      return list;
    } catch {
      setFailed(true);
      return null;
    }
  }, []);

  useEffect(() => {
    setSelectedKeyState(readSelected());
    void refresh();
  }, [refresh]);

  const setSelectedKey = useCallback((key: string) => {
    setSelectedKeyState(key);
    try {
      window.localStorage.setItem(STORAGE_KEY, key);
    } catch {
      // Remembering the choice is a convenience only.
    }
  }, []);

  // A deleted (or another browser's) logic falls back to the default.
  const selected =
    logics.find((logic) => logic.key === selectedKey) ??
    logics.find((logic) => logic.builtin) ??
    null;
  useEffect(() => {
    if (logics.length && !logics.some((logic) => logic.key === selectedKey))
      setSelectedKey("default");
  }, [logics, selectedKey, setSelectedKey]);

  return {
    logics,
    spec,
    failed,
    selected,
    selectedKey: selected?.key ?? "default",
    setSelectedKey,
    refresh,
  };
}

const logicLabel = (logic: ScannerLogic, c: Copy) =>
  logic.builtin ? `${c("Default", "默认")} · ${logic.name}` : logic.name;

/** Scanner header control: pick the logic to scan with, and open the manager. */
export function ScannerLogicPicker({
  state,
  disabled,
}: {
  state: ReturnType<typeof useScannerLogics>;
  disabled?: boolean;
}) {
  const c = useCopy();
  const [open, setOpen] = useState(false);
  const { logics, selectedKey, setSelectedKey } = state;
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <Select
        value={selectedKey}
        onValueChange={setSelectedKey}
        disabled={disabled || !logics.length}
      >
        <SelectTrigger
          aria-label={c("Scan logic", "扫描逻辑")}
          className="!h-9 !w-auto min-w-0 max-w-[14rem] gap-1.5 rounded-full px-3 text-xs font-medium"
        >
          <SelectValue placeholder={c("Default · Swing V3.1", "默认 · Swing V3.1")} />
        </SelectTrigger>
        <SelectContent align="end">
          {logics.map((logic) => (
            <SelectItem key={logic.key} value={logic.key}>
              {logicLabel(logic, c)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        disabled={!state.spec}
        className="h-9 gap-1.5 rounded-full px-3 text-xs"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
        {c("Logics", "管理逻辑")}
      </Button>
      <ScannerLogicDialog open={open} onOpenChange={setOpen} state={state} />
    </div>
  );
}

type Draft = { key: string | null; name: string; values: Record<ParamKey, string> };

function ScannerLogicDialog({
  open,
  onOpenChange,
  state,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: ReturnType<typeof useScannerLogics>;
}) {
  const c = useCopy();
  const { logics, spec, refresh, setSelectedKey } = state;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Partial<Record<ParamKey | "name" | "form", string>>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setDraft(null);
      setErrors({});
      setConfirmDelete(null);
    }
  }, [open]);

  const startDraft = (from: ScannerLogic, editing: boolean, name?: string) => {
    setErrors({});
    setDraft({
      key: editing ? from.key : null,
      name: name ?? (editing ? from.name : c(`${from.name} copy`, `${from.name} 副本`)),
      values: Object.fromEntries(
        (Object.keys(FIELDS) as ParamKey[]).map((key) => [key, shown(key, from.params[key])]),
      ) as Record<ParamKey, string>,
    });
  };

  const parse = (d: Draft): ScannerLogicParams | null => {
    if (!spec) return null;
    const next: Partial<Record<ParamKey | "name", string>> = {};
    const params = {} as ScannerLogicParams;
    if (!d.name.trim()) next.name = c("Give it a name.", "请填写名称。");
    for (const key of Object.keys(FIELDS) as ParamKey[]) {
      const { min, max, integer } = spec[key];
      const raw = d.values[key].trim();
      const value = Number(raw) / FIELDS[key].scale;
      if (!raw || !Number.isFinite(value)) next[key] = c("Enter a number.", "请输入数字。");
      else if (integer && !Number.isInteger(Number(raw)))
        next[key] = c("Whole numbers only.", "只能是整数。");
      else if (value < min - 1e-9 || value > max + 1e-9)
        next[key] = c(
          `Between ${shown(key, min)} and ${shown(key, max)}.`,
          `范围 ${shown(key, min)}–${shown(key, max)}。`,
        );
      else params[key] = integer ? Math.round(value) : Math.round(value * 1e8) / 1e8;
    }
    for (const [low, high] of PAIRS)
      if (!next[low] && !next[high] && params[low] > params[high])
        next[low] = c("Must not be above the maximum.", "不能大于上限。");
    setErrors(next);
    return Object.keys(next).length ? null : params;
  };

  const save = async () => {
    if (!draft) return;
    const params = parse(draft);
    if (!params) return;
    setSaving(true);
    try {
      const payload = { name: draft.name.trim(), params };
      const saved = draft.key
        ? await updateScannerLogic(draft.key, payload)
        : await createScannerLogic(payload);
      await refresh();
      setSelectedKey(saved.key);
      setDraft(null);
    } catch (error) {
      const field = (error as { field?: string }).field as ParamKey | undefined;
      const message = error instanceof Error ? error.message : "";
      setErrors(
        field && field in FIELDS
          ? { [field]: message }
          : { form: c("Could not save. Try again.", "保存失败，请重试。") },
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async (key: string) => {
    setSaving(true);
    try {
      await deleteScannerLogic(key);
      setConfirmDelete(null);
      await refresh();
    } catch {
      setErrors({ form: c("Could not delete. Try again.", "删除失败，请重试。") });
    } finally {
      setSaving(false);
    }
  };

  const field = (key: ParamKey) => {
    if (!draft || !spec) return null;
    const meta = FIELDS[key];
    const id = `scanner-logic-${key}`;
    const changed = draft.values[key].trim() !== shown(key, spec[key].default);
    return (
      <div key={key} className="min-w-0">
        <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
          {c(meta.en, meta.zh)}
        </Label>
        <div className="mt-1 flex items-center gap-1.5">
          <Input
            id={id}
            inputMode="decimal"
            value={draft.values[key]}
            aria-invalid={Boolean(errors[key])}
            aria-describedby={`${id}-hint`}
            onChange={(event) =>
              setDraft({ ...draft, values: { ...draft.values, [key]: event.target.value } })
            }
            className={cn(
              "h-10 min-w-0 rounded-xl text-sm tabular-nums",
              changed && "font-semibold",
              errors[key] && "border-negative focus-visible:border-negative",
            )}
          />
          <span className="w-12 shrink-0 text-xs text-muted-foreground">
            {unitLabel(meta.unit, c)}
          </span>
        </div>
        <p
          id={`${id}-hint`}
          className={cn(
            "mt-1 text-[0.6875rem]",
            errors[key] ? "text-negative" : "text-muted-foreground",
          )}
        >
          {errors[key] ??
            c(`Default ${shown(key, spec[key].default)}`, `默认 ${shown(key, spec[key].default)}`)}
        </p>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent layout="sheet" className="flex flex-col">
        <DialogTitle className="text-base">
          {draft
            ? draft.key
              ? c("Edit logic", "编辑逻辑")
              : c("New logic", "新建逻辑")
            : c("Scan logics", "扫描逻辑")}
        </DialogTitle>
        <DialogDescription className="text-xs">
          {draft
            ? c(
                "Saving keeps the earlier version, so trade plans made with it still point at the numbers they used.",
                "保存会生成新版本，之前用旧版本建的交易计划仍指向当时的数值。",
              )
            : c(
                "The default can't be changed. Copy it to make your own.",
                "默认逻辑不能修改，复制一份即可调整。",
              )}
        </DialogDescription>

        {draft ? (
          <>
            <div className="-mx-5 mt-3 min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 pb-2">
              <div>
                <Label
                  htmlFor="scanner-logic-name"
                  className="text-xs font-medium text-muted-foreground"
                >
                  {c("Name", "名称")}
                </Label>
                <Input
                  id="scanner-logic-name"
                  value={draft.name}
                  maxLength={100}
                  aria-invalid={Boolean(errors.name)}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  className="mt-1 h-10 rounded-xl text-sm"
                />
                {errors.name && (
                  <p className="mt-1 text-[0.6875rem] text-negative">{errors.name}</p>
                )}
              </div>
              {GROUPS.map((group) => (
                <fieldset key={group.en} className="space-y-3">
                  <legend className="mb-2 text-xs font-semibold text-foreground">
                    {c(group.en, group.zh)}
                  </legend>
                  {group.rows.map((row) =>
                    Array.isArray(row) ? (
                      <div key={row[0]} className="grid grid-cols-2 gap-3">
                        {field(row[0])}
                        {field(row[1])}
                      </div>
                    ) : (
                      field(row)
                    ),
                  )}
                </fieldset>
              ))}
            </div>
            {errors.form && (
              <p role="alert" className="mt-2 text-xs text-negative">
                {errors.form}
              </p>
            )}
            <div className="mt-3 flex shrink-0 justify-end gap-2 border-t border-border pt-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDraft(null)}
                disabled={saving}
              >
                {c("Back", "返回")}
              </Button>
              <Button type="button" onClick={() => void save()} disabled={saving}>
                {saving ? c("Saving…", "保存中…") : c("Save", "保存")}
              </Button>
            </div>
          </>
        ) : (
          <>
            <ul className="-mx-5 mt-3 min-h-0 flex-1 divide-y divide-border overflow-y-auto overscroll-contain px-5">
              {logics.map((logic) => (
                <li key={logic.key} className="py-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{logicLabel(logic, c)}</p>
                      <p className="text-[0.6875rem] text-muted-foreground">
                        {logic.builtin
                          ? c("Built in · read-only", "内置 · 只读")
                          : c(`Version ${logic.version}`, `第 ${logic.version} 版`)}
                        {" · "}
                        {`${logic.params.target_r_multiple}R · ${c("stop", "止损")} ${logic.params.stop_atr_buffer}×ATR · ${c("pullback", "回调")} ${logic.params.pullback_min_days}–${logic.params.pullback_max_days}${c("d", "天")}`}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      aria-label={c(`Copy ${logic.name}`, `复制 ${logic.name}`)}
                      title={c("Copy", "复制")}
                      onClick={() => startDraft(logic, false)}
                    >
                      <Copy className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    {!logic.builtin && (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 shrink-0"
                          aria-label={c(`Edit ${logic.name}`, `编辑 ${logic.name}`)}
                          title={c("Edit", "编辑")}
                          onClick={() => startDraft(logic, true)}
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 shrink-0 text-negative hover:text-negative"
                          aria-label={c(`Delete ${logic.name}`, `删除 ${logic.name}`)}
                          title={c("Delete", "删除")}
                          onClick={() => setConfirmDelete(logic.key)}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </>
                    )}
                  </div>
                  {confirmDelete === logic.key && (
                    <div
                      role="alertdialog"
                      aria-label={c("Confirm delete", "确认删除")}
                      className="mt-2 rounded-xl border border-negative/30 bg-negative/10 p-3 text-xs"
                    >
                      <p>
                        {c(
                          "You won't be able to scan with it again. Trade plans already made with it keep their numbers.",
                          "删除后不能再用它扫描；已经用它建的交易计划不受影响。",
                        )}
                      </p>
                      <div className="mt-2 flex justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setConfirmDelete(null)}
                          disabled={saving}
                        >
                          {c("Keep", "保留")}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => void remove(logic.key)}
                          disabled={saving}
                        >
                          {c("Delete", "删除")}
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {errors.form && (
              <p role="alert" className="mt-2 text-xs text-negative">
                {errors.form}
              </p>
            )}
            <div className="mt-3 flex shrink-0 justify-end border-t border-border pt-3">
              <Button
                type="button"
                onClick={() => {
                  const base = logics.find((logic) => logic.builtin);
                  if (base) startDraft(base, false, c("My logic", "我的逻辑"));
                }}
                className="gap-1.5"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                {c("New logic", "新建逻辑")}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function useLogicSummary(logic: ScannerLogic | null) {
  const c = useCopy();
  return useMemo(() => (logic ? describeLogic(logic.params, c) : null), [logic, c]);
}
