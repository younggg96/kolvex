"use client";

import { useEffect, useMemo, useState } from "react";
import { useCopy } from "@/components/decision/shared";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { FilterSheet, FilterSheetGroup } from "@/components/ui/filter-sheet";
import { Label } from "@/components/ui/label";
import { SearchInput } from "@/components/ui/search-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import CongressTrades from "./CongressTrades";

type Chamber = "all" | "house" | "senate";
type Direction = "all" | "buy" | "sell" | "exchange" | "other";
const TICKER = /^[A-Za-z0-9.^=-]{1,20}$/;
/** Typing settles before the list reloads; choices from menus apply at once. */
const TYPING_DELAY_MS = 350;

export default function CongressTradesPage({ initialTicker }: { initialTicker: string }) {
  const c = useCopy();
  const title = c("Congress trades", "国会议员交易");
  const [ticker, setTicker] = useState(initialTicker);
  const [member, setMember] = useState("");
  const [chamber, setChamber] = useState<Chamber>("all");
  const [direction, setDirection] = useState<Direction>("all");
  const [typed, setTyped] = useState({ ticker: initialTicker.trim(), member: "" });
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(
      () => setTyped({ ticker: ticker.trim(), member: member.trim() }),
      TYPING_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [ticker, member]);

  const invalidTicker = Boolean(typed.ticker) && !TICKER.test(typed.ticker);
  const applied = useMemo(() => {
    const params = new URLSearchParams();
    if (typed.ticker && !invalidTicker) params.set("ticker", typed.ticker.toUpperCase());
    if (typed.member) params.set("member", typed.member);
    if (chamber !== "all") params.set("chamber", chamber);
    if (direction !== "all") params.set("direction", direction);
    return params.toString();
  }, [typed, invalidTicker, chamber, direction]);
  useEffect(() => setPage(1), [applied]);

  const chamberOptions: { value: Chamber; label: string }[] = [
    { value: "all", label: c("Both chambers", "参众两院") },
    { value: "house", label: c("House", "众议院") },
    { value: "senate", label: c("Senate", "参议院") },
  ];
  const directionOptions: { value: Direction; label: string }[] = [
    { value: "all", label: c("All transactions", "全部交易") },
    { value: "buy", label: c("Buy", "买入") },
    { value: "sell", label: c("Sell", "卖出") },
    { value: "exchange", label: c("Exchange", "交换") },
    { value: "other", label: c("Other", "其他") },
  ];
  const sheetActive = Boolean(member.trim()) || chamber !== "all" || direction !== "all";
  const summary = [
    member.trim(),
    chamber !== "all" && chamberOptions.find((o) => o.value === chamber)?.label,
    direction !== "all" && directionOptions.find((o) => o.value === direction)?.label,
  ]
    .filter(Boolean)
    .join(" · ");

  const tickerField = (
    <SearchInput
      id="congress-ticker"
      aria-label={c("Ticker", "股票代码")}
      placeholder={c("Ticker, e.g. NVDA", "股票代码,如 NVDA")}
      autoCapitalize="characters"
      spellCheck={false}
      maxLength={20}
      value={ticker}
      onChange={(event) => setTicker(event.target.value)}
      aria-invalid={invalidTicker}
      aria-describedby={invalidTicker ? "congress-ticker-error" : undefined}
      containerClassName="w-full"
      className="max-md:min-h-11 max-md:text-base"
    />
  );

  // Desktop: the same filters sit inside the table card and apply as you type or choose.
  const desktopToolbar = (
    <div
      role="group"
      aria-label={c("Filter trades", "筛选交易")}
      className="grid grid-cols-[11rem_minmax(0,1fr)_9rem_9rem] items-center gap-2"
    >
      <SearchInput
        id="congress-ticker-desktop"
        shortcut="mod+k"
        aria-label={c("Ticker", "股票代码")}
        containerClassName="w-full"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={20}
        placeholder={c("Ticker", "股票代码")}
        value={ticker}
        onChange={(event) => setTicker(event.target.value)}
        aria-invalid={invalidTicker}
        aria-describedby={invalidTicker ? "congress-ticker-error" : undefined}
      />
      <SearchInput
        id="congress-member"
        aria-label={c("Member", "议员姓名")}
        containerClassName="w-full"
        maxLength={100}
        placeholder={c("Member", "议员姓名")}
        value={member}
        onChange={(event) => setMember(event.target.value)}
      />
      <Select value={chamber} onValueChange={(value) => setChamber(value as Chamber)}>
        <SelectTrigger aria-label={c("Chamber", "议院")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {chamberOptions.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={direction} onValueChange={(value) => setDirection(value as Direction)}>
        <SelectTrigger aria-label={c("Transaction", "交易类型")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {directionOptions.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <DashboardLayout title={title}>
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-background dark:bg-transparent">
        <div className="mx-auto max-w-6xl space-y-4 px-[16px] pb-10 pt-4 md:px-8 md:py-8">
          <header className="mb-2 md:mb-4">
            <h1 className="text-2xl font-semibold tracking-tight md:text-[2rem]">{title}</h1>
          </header>

          {/* Phones: one ticker search and everything else in the shared filter sheet. */}
          <div className="flex items-center gap-2 lg:hidden">
            <div className="min-w-0 flex-1">{tickerField}</div>
            <FilterSheet
              title={c("Filter trades", "筛选交易")}
              summary={summary || undefined}
              active={sheetActive}
              onReset={() => {
                setMember("");
                setChamber("all");
                setDirection("all");
              }}
              triggerClassName="h-11 w-11"
            >
              <div className="space-y-2">
                <Label htmlFor="congress-member-sheet">{c("Member", "议员姓名")}</Label>
                <SearchInput
                  id="congress-member-sheet"
                  containerClassName="w-full"
                  className="min-h-11 text-base"
                  maxLength={100}
                  placeholder={c("Any member", "全部议员")}
                  value={member}
                  onChange={(event) => setMember(event.target.value)}
                />
              </div>
              <FilterSheetGroup
                label={c("Chamber", "议院")}
                value={chamber}
                onChange={setChamber}
                options={chamberOptions}
              />
              <FilterSheetGroup
                label={c("Transaction", "交易类型")}
                value={direction}
                onChange={setDirection}
                options={directionOptions}
              />
            </FilterSheet>
          </div>

          {invalidTicker && (
            <p id="congress-ticker-error" role="alert" className="text-sm text-destructive">
              {c("Enter a valid stock ticker.", "请输入有效的股票代码。")}
            </p>
          )}

          <CongressTrades
            filters={applied}
            page={page}
            onPageChange={setPage}
            toolbar={desktopToolbar}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
