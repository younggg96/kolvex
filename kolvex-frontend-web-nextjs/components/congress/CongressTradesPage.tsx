"use client";

import { useState, type FormEvent } from "react";
import { useCopy } from "@/components/decision/shared";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchFieldIcon, SearchInput } from "@/components/ui/search-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CongressTrades from "./CongressTrades";

export default function CongressTradesPage({ initialTicker }: { initialTicker: string }) {
  const c = useCopy();
  const title = c("Congress trades", "国会议员交易");
  const [filters, setFilters] = useState({ ticker: initialTicker, member: "", chamber: "all", direction: "all" });
  const [applied, setApplied] = useState(initialTicker ? `ticker=${encodeURIComponent(initialTicker)}` : "");
  const [page, setPage] = useState(1);
  const [invalidTicker, setInvalidTicker] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ticker = filters.ticker.trim();
    if (ticker && !/^[A-Za-z0-9.^=-]{1,20}$/.test(ticker)) {
      setInvalidTicker(true);
      return;
    }

    const params = new URLSearchParams();
    if (ticker) params.set("ticker", ticker.toUpperCase());
    if (filters.member.trim()) params.set("member", filters.member.trim());
    if (filters.chamber !== "all") params.set("chamber", filters.chamber);
    if (filters.direction !== "all") params.set("direction", filters.direction);
    setApplied(params.toString());
    setPage(1);
  }

  return (
    <DashboardLayout title={title}>
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-background dark:bg-transparent">
        <div className="mx-auto max-w-6xl space-y-5 px-4 pb-10 pt-4 md:space-y-6 md:px-8 md:py-8">
          <header className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight md:text-[2rem]">{title}</h1>
          </header>
          <form onSubmit={submit} className="grid grid-cols-2 items-end gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="congress-ticker">{c("Ticker", "股票代码")}</Label>
              <div className="relative">
                <SearchFieldIcon />
                <Input className="pl-9 max-md:min-h-11 max-md:text-base" autoCapitalize="characters" spellCheck={false} id="congress-ticker" value={filters.ticker} placeholder="NVDA" maxLength={20}
                  aria-invalid={invalidTicker} aria-describedby={invalidTicker ? "congress-ticker-error" : undefined}
                  onChange={(event) => {
                    setInvalidTicker(false);
                    setFilters({ ...filters, ticker: event.target.value });
                  }} />
              </div>
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="congress-member">{c("Member", "议员姓名")}</Label>
              <SearchInput className="max-md:min-h-11 max-md:text-base" containerClassName="w-full" id="congress-member" value={filters.member} maxLength={100}
                onChange={(event) => setFilters({ ...filters, member: event.target.value })} />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="congress-chamber">{c("Chamber", "议院")}</Label>
              <Select value={filters.chamber} onValueChange={(chamber) => setFilters({ ...filters, chamber })}>
                <SelectTrigger className="max-md:min-h-11" id="congress-chamber"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{c("Both chambers", "参众两院")}</SelectItem>
                  <SelectItem value="house">{c("House", "众议院")}</SelectItem>
                  <SelectItem value="senate">{c("Senate", "参议院")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="congress-direction">{c("Transaction", "交易类型")}</Label>
              <Select value={filters.direction} onValueChange={(direction) => setFilters({ ...filters, direction })}>
                <SelectTrigger className="max-md:min-h-11" id="congress-direction"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{c("All transactions", "全部交易")}</SelectItem>
                  <SelectItem value="buy">{c("Buy", "买入")}</SelectItem>
                  <SelectItem value="sell">{c("Sell", "卖出")}</SelectItem>
                  <SelectItem value="exchange">{c("Exchange", "交换")}</SelectItem>
                  <SelectItem value="other">{c("Other", "其他")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="col-span-2 min-h-11 sm:justify-self-start lg:col-span-1" type="submit">{c("Apply filters", "应用筛选")}</Button>
            {invalidTicker && <p id="congress-ticker-error" role="alert" className="col-span-full text-sm text-destructive">
              {c("Enter a valid stock ticker.", "请输入有效的股票代码。")}
            </p>}
          </form>
          <CongressTrades filters={applied} page={page} onPageChange={setPage} />
        </div>
      </div>
    </DashboardLayout>
  );
}
