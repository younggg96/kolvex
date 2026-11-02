"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  INSTITUTIONS_KEY,
  freeResearchKey,
  insiderSummary,
  institutionKey,
  sameIssuer,
  type Institution,
  type InstitutionManager,
  type SecInsiders,
} from "@/lib/freeResearch";
import { cn } from "@/lib/utils";
import {
  FactList,
  SecLink,
  SecState,
  SourceNote,
  useFreeResearch,
} from "./SecData";
import { useFinancialFormat } from "./StockFinancialData";
import { useCopy } from "./shared";

const head = "px-4 py-4 font-medium";
const cell = "figure px-4 py-3 text-right";

export default function StockOwnership({
  symbol,
  companyName,
}: {
  symbol: string;
  companyName?: string | null;
}) {
  const c = useCopy();
  const [view, setView] = useState<"insiders" | "institutions">("insiders");
  const [visited, setVisited] = useState(false);
  return (
    <div className="space-y-6">
      <SegmentedControl
        label={c("Ownership view", "持仓披露视图")}
        semantics="tabs"
        value={view}
        onChange={(value) => {
          setView(value);
          if (value === "institutions") setVisited(true);
        }}
        options={[
          { value: "insiders", label: c("Insider trades", "内部人交易") },
          { value: "institutions", label: c("Investor 13F", "投资机构 13F") },
        ]}
      />
      <div hidden={view !== "insiders"}>
        <Insiders symbol={symbol} />
      </div>
      <div hidden={view !== "institutions"}>
        {visited && <Institutions companyName={companyName} />}
      </div>
    </div>
  );
}

function Insiders({ symbol }: { symbol: string }) {
  const c = useCopy();
  const f = useFinancialFormat();
  const resource = useFreeResearch<SecInsiders>(
    freeResearchKey(symbol, "insiders"),
  );
  const data = resource.data;
  const rows = data?.transactions ?? [];
  const summary = insiderSummary(rows);
  const total = (side: typeof summary.buys) =>
    side.count
      ? `$${f.number(side.value)}${side.incomplete ? "+" : ""}`
      : c("None", "无");
  const codeLabel = (code: string | null) =>
    (code &&
      {
        P: c("Open-market buy", "公开市场买入"),
        S: c("Open-market sale", "公开市场卖出"),
        A: c("Grant or award", "授予"),
        M: c("Option exercise", "期权行权"),
        F: c("Tax withholding", "代扣税"),
        G: c("Gift", "赠与"),
        D: c("Sold to issuer", "售回公司"),
        C: c("Conversion", "转换"),
        J: c("Other", "其他"),
      }[code]) ||
    code ||
    "—";
  return (
    <section aria-labelledby="insiders-title" className="space-y-6">
      <h2 id="insiders-title" className="sr-only">
        {c("Insider trades", "内部人交易")}
      </h2>
      <SecState
        loading={resource.loading}
        error={resource.error}
        empty={!resource.loading && !rows.length}
        retry={resource.refresh}
        emptyText={c(
          "No Form 4 transactions in the latest filings. Foreign private issuers generally don't file Form 4.",
          "最近的申报中没有 Form 4 交易。外国私人发行人通常不提交 Form 4。",
        )}
        errorText={c(
          "Insider filings could not be loaded. Try again.",
          "内部人申报加载失败，请重试。",
        )}
      />
      {!!rows.length && (
        <>
          <FactList
            items={[
              [c("Open-market buys", "公开市场买入"), total(summary.buys)],
              [c("Open-market sales", "公开市场卖出"), total(summary.sells)],
              [
                c("Transactions covered", "覆盖交易日期"),
                summary.from && summary.to ? (
                  <span className="text-sm font-medium">
                    {f.date(summary.from)} – {f.date(summary.to)}
                  </span>
                ) : (
                  "—"
                ),
              ],
              [
                c("Filings read", "已读取申报"),
                `${(data?.filings.length ?? 0) - (data?.failed_filings ?? 0)} / ${data?.filings.length ?? 0}`,
              ],
            ]}
          />
          <div
            role="region"
            tabIndex={0}
            aria-label={c(
              "Insider transactions, horizontally scrollable",
              "内部人交易表，可横向滚动",
            )}
            className="max-h-[72vh] overflow-auto rounded-3xl border border-border focus-visible:outline-none"
          >
            <table className="w-full whitespace-nowrap text-sm">
              <thead className="sticky top-0 z-10 bg-muted text-muted-foreground">
                <tr>
                  {[
                    c("Trade date", "交易日"),
                    c("Insider", "内部人"),
                    c("Type", "类型"),
                    c("Shares", "股数"),
                    c("Price", "价格"),
                    c("Value", "金额"),
                    c("Held after", "交易后持股"),
                    c("Filed", "申报日"),
                  ].map((label, index) => (
                    <th
                      key={label}
                      scope="col"
                      className={cn(head, index > 2 && index < 7 ? "text-right" : "text-left")}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={`${row.source_url}-${index}`}
                    className="border-t border-border"
                  >
                    <td className="figure px-4 py-3">
                      {row.date ? f.date(row.date) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="block font-medium">{row.owner}</span>
                      <span className="block text-xs text-muted-foreground">
                        {row.position}
                      </span>
                    </td>
                    <td
                      className={cn(
                        "px-4 py-3",
                        row.code === "P"
                          ? "font-medium text-positive"
                          : row.code === "S"
                            ? "font-medium text-negative"
                            : "text-muted-foreground",
                      )}
                    >
                      {codeLabel(row.code)}
                      {row.amended && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {c("Amended", "修正")}
                        </span>
                      )}
                    </td>
                    <td className={cell}>{f.number(row.shares, false)}</td>
                    <td className={cell}>
                      {row.price === null ? "—" : `$${f.number(row.price, false)}`}
                    </td>
                    <td className={cell}>
                      {row.value === null || row.value === 0 ? "—" : `$${f.number(row.value)}`}
                    </td>
                    <td className={cell}>{f.number(row.shares_after, false)}</td>
                    <td className="figure px-4 py-3">
                      <SecLink href={row.source_url}>{f.date(row.filed)}</SecLink>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <SourceNote>
        {c(
          `Source: SEC Form 4 and 4/A. Non-derivative transactions from the latest ${data?.filing_limit ?? 12} filings only, so this is not a complete trading history and 3/6/12-month totals are not shown. Totals count open-market trades (codes P and S); grants, exercises and tax withholding are listed but not counted. Amendments appear as separate rows.`,
          `来源：SEC Form 4 及 4/A。仅含最近 ${data?.filing_limit ?? 12} 份申报中的非衍生品交易，不是完整交易历史，所以不显示 3／6／12 个月汇总。合计只统计公开市场交易（代码 P、S）；授予、行权、代扣税等会列出但不计入。修正申报单独成行。`,
        )}
      </SourceNote>
    </section>
  );
}

const PAGE = 50;

function Institutions({ companyName }: { companyName?: string | null }) {
  const c = useCopy();
  const f = useFinancialFormat();
  const [manager, setManager] = useState("berkshire");
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(PAGE);
  const managers = useFreeResearch<{ managers: InstitutionManager[] }>(
    INSTITUTIONS_KEY,
  );
  const resource = useFreeResearch<Institution>(institutionKey(manager));
  const data = resource.data;
  const holdings = data?.holdings ?? [];
  const held = holdings.filter((row) => row.activity !== "exited");
  const totalValue = held.reduce((sum, row) => sum + (row.value ?? 0), 0);
  const needle = query.trim().toUpperCase();
  const filtered = holdings.filter(
    (row) => !needle || row.issuer.toUpperCase().includes(needle) || row.cusip?.includes(needle),
  );
  const matches = holdings.filter((row) => sameIssuer(row.issuer, companyName));
  const rows = [
    ...filtered.filter((row) => matches.includes(row)),
    ...filtered.filter((row) => !matches.includes(row)),
  ].slice(0, visible);
  const activity = (kind: Institution["holdings"][number]["activity"]) =>
    ({
      new: c("New", "新建仓"),
      increased: c("Added", "增持"),
      reduced: c("Reduced", "减持"),
      exited: c("Exited", "清仓"),
      unchanged: c("Unchanged", "不变"),
      unknown: c("Not compared", "未比较"),
    })[kind];
  const companyMatch = matches.find((row) => row.activity !== "exited");
  return (
    <section aria-labelledby="institutions-title" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="institutions-title" className="text-xl font-semibold">
          {data?.name ?? c("Investor 13F", "投资机构 13F")}
        </h2>
        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
          <div className="w-full sm:w-56">
            <Select
              value={manager}
              onValueChange={(value) => {
                setManager(value);
                setVisible(PAGE);
                setQuery("");
              }}
            >
              <SelectTrigger aria-label={c("Investor", "投资机构")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(managers.data?.managers ?? [{ id: "berkshire", name: "Berkshire Hathaway", cik: 0 }]).map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input
            className="w-full px-4 text-sm sm:w-56"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setVisible(PAGE);
            }}
            placeholder={c("Filter by company", "按公司筛选")}
            aria-label={c("Filter holdings by company", "按公司筛选持仓")}
          />
        </div>
      </div>
      <SecState
        loading={resource.loading}
        error={resource.error}
        empty={!resource.loading && !holdings.length}
        retry={resource.refresh}
        emptyText={c(
          "This investor has no 13F holdings available.",
          "这家机构暂无可用的 13F 持仓。",
        )}
        errorText={c(
          "13F holdings could not be loaded. Try again.",
          "13F 持仓加载失败，请重试。",
        )}
      />
      {!!holdings.length && data?.filing && (
        <>
          <FactList
            items={[
              [c("Reporting period", "持仓截止日"), f.date(data.filing.period)],
              [
                c("Filed", "申报日"),
                <SecLink key="filing" href={data.filing.source_url}>
                  {f.date(data.filing.filed)}
                </SecLink>,
              ],
              [c("Positions", "持仓数"), f.number(held.length, false)],
              [c("Reported value", "申报市值"), `$${f.number(totalValue)}`],
            ]}
          />
          {companyName && (
            <p className="text-sm text-muted-foreground" role="status">
              {companyMatch
                ? c(
                    `${companyName} is ${f.percent(companyMatch.weight)} of this filing and is listed first.`,
                    `${companyName} 占这份申报的 ${f.percent(companyMatch.weight)}，已置顶显示。`,
                  )
                : c(
                    `No position in this filing matches the name ${companyName}. Names can differ, so filter to check.`,
                    `这份申报中没有与 ${companyName} 名称一致的持仓。名称写法可能不同，可用筛选再确认。`,
                  )}
            </p>
          )}
          <div
            role="region"
            tabIndex={0}
            aria-label={c("13F holdings, horizontally scrollable", "13F 持仓表，可横向滚动")}
            className="max-h-[72vh] overflow-auto rounded-3xl border border-border focus-visible:outline-none"
          >
            <table className="w-full whitespace-nowrap text-sm">
              <thead className="sticky top-0 z-10 bg-muted text-muted-foreground">
                <tr>
                  {[
                    c("Company", "公司"),
                    c("Value", "市值"),
                    c("Weight", "权重"),
                    c("Shares", "股数"),
                    c("Vs prior quarter", "较上季"),
                    c("Share change", "股数变化"),
                  ].map((label, index) => (
                    <th
                      key={label}
                      scope="col"
                      className={cn(head, index ? "text-right" : "text-left")}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={`${row.cusip}-${row.class}-${row.share_type}-${row.put_call}`}
                    className={cn(
                      "border-t border-border",
                      matches.includes(row) && "bg-foreground/[0.04]",
                    )}
                  >
                    <th scope="row" className="px-4 py-3 text-left font-medium">
                      {row.issuer}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {row.class}
                        {row.put_call && ` · ${row.put_call}`}
                      </span>
                    </th>
                    <td className={cell}>${f.number(row.value)}</td>
                    <td className={cell}>{f.percent(row.weight)}</td>
                    <td className={cell}>{f.number(row.shares)}</td>
                    <td
                      className={cn(
                        "px-4 py-3 text-right",
                        row.activity === "new" || row.activity === "increased"
                          ? "text-positive"
                          : row.activity === "reduced" || row.activity === "exited"
                            ? "text-negative"
                            : "text-muted-foreground",
                      )}
                    >
                      {activity(row.activity)}
                    </td>
                    <td className={cell}>
                      {row.change === null
                        ? "—"
                        : `${row.change > 0 ? "+" : row.change < 0 ? "−" : ""}${f.number(Math.abs(row.change))}`}
                      {row.change_percent !== null && row.change !== 0 && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {f.percent(row.change_percent)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && (
              <p className="px-6 py-10 text-center text-sm text-muted-foreground">
                {c("No holdings match this filter.", "没有符合筛选条件的持仓。")}
              </p>
            )}
          </div>
          {filtered.length > visible && (
            <Button
              variant="outline"
              onClick={() => setVisible((count) => count + PAGE)}
            >
              {c("Show more", "显示更多")} ({filtered.length - visible})
            </Button>
          )}
          {data.partial && (
            <p className="text-sm text-muted-foreground" role="status">
              {c(
                "This filing has an amendment or its prior quarter could not be read, so quarter-over-quarter changes are not compared.",
                "这份申报有修正，或上季申报无法读取，所以不比较季度变化。",
              )}
            </p>
          )}
        </>
      )}
      <SourceNote>
        {c(
          "Source: SEC Form 13F-HR. A quarter-end snapshot filed up to 45 days later, not live positions, and it excludes shorts and most non-US holdings. Changes are unadjusted for splits and only compare adjacent quarters. Investors are a curated list.",
          "来源：SEC Form 13F-HR。这是季度末持仓快照，最晚在季末 45 天后才披露，不代表当前持仓，也不含空头和大部分非美股持仓。股数变化未按拆股调整，仅比较相邻两个季度。投资机构为精选名单。",
        )}
      </SourceNote>
    </section>
  );
}
