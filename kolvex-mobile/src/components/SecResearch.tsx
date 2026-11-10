import { useState } from "react";
import { CardsSkeleton } from "./Skeletons";
import { Linking, View } from "react-native";
import { exportCSV } from "../lib/exportFile";
import { financialFormat } from "../lib/financialFormat";
import {
  financialRatios,
  insiderSummary,
  sameIssuer,
  secSourceUrl,
  type FinancialRow,
  type Institution,
} from "../lib/freeResearch";
import {
  institution,
  managers,
  revenueOutlook,
  secFilings,
  secFinancials,
  secInsiders,
} from "../lib/freeResearchApi";
import { csvCell } from "../lib/stockResearch";
import { useTheme } from "../lib/theme";
import { useResource } from "../lib/useResource";
import { usePreferences } from "../state/Preferences";
import { DataTable } from "./DataTable";
import { Field, Filters } from "./Content";
import { MetricBars, Statements } from "./StockResearch";
import { Button, Copy, Empty, Failure, Glass, Section, LoadingStatus } from "./UI";
export const SEC_TIMEOUT = 55_000;
export function useFormat() {
  return financialFormat(usePreferences().locale);
}
export function SecState({
  resource,
  empty,
  emptyText,
  errorText,
  skeleton,
}: {
  resource: { loading: boolean; error?: string; refresh: () => void };
  /** Placeholder in the shape of the content this state stands in for. */
  skeleton: React.ReactNode;
  empty: boolean;
  emptyText: string;
  errorText: string;
}) {
  if (resource.loading) return <LoadingStatus>{skeleton}</LoadingStatus>;
  if (resource.error)
    return <Failure message={errorText} retry={resource.refresh} />;
  return empty ? <Empty title="暂无数据" message={emptyText} /> : null;
}
/** Links only to validated sec.gov archive paths; anything else renders as plain text. */
export function SecLink({ href, label }: { href?: string; label: string }) {
  const t = useTheme();
  const [failed, setFailed] = useState(false);
  const safe = secSourceUrl(href);
  if (!safe) return <Copy size={13}>{label}</Copy>;
  return (
    <Copy
      size={13}
      color={failed ? t.negative : t.accent}
      onPress={() => {
        Linking.openURL(safe).catch(() => setFailed(true));
      }}
      role="link"
    >
      {label}
    </Copy>
  );
}
export function FactList({ items }: { items: [string, string][] }) {
  return (
    <Glass style={{ padding: 16 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 16 }}>
        {items.map(([label, value]) => (
          <View key={label} style={{ width: "50%", paddingRight: 8, gap: 4 }}>
            <Copy size={12} muted>
              {label}
            </Copy>
            <Copy size={15} bold localize={false}>
              {value}
            </Copy>
          </View>
        ))}
      </View>
    </Glass>
  );
}
export function Note({ children }: { children: string }) {
  return (
    <Copy size={12} muted>
      {children}
    </Copy>
  );
}
type MetricKey =
  | keyof FinancialRow
  | "revenue_growth"
  | "fcf_margin"
  | "roe"
  | "liabilities_to_equity";
type Metric = {
  key: MetricKey;
  label: string;
  kind?: "percent" | "plain" | "multiple";
  ratio?: boolean;
};
const metrics: Metric[] = [
  { key: "revenue", label: "营业收入" },
  { key: "gross_profit", label: "毛利润" },
  { key: "operating_income", label: "营业利润" },
  { key: "net_income", label: "净利润" },
  { key: "eps_diluted", label: "稀释每股收益", kind: "plain" },
  { key: "operating_cash_flow", label: "经营现金流" },
  { key: "capex", label: "资本支出" },
  { key: "free_cash_flow", label: "自由现金流" },
  { key: "assets", label: "总资产" },
  { key: "liabilities", label: "总负债" },
  { key: "equity", label: "股东权益" },
  {
    key: "revenue_growth",
    label: "营收同比增长",
    kind: "percent",
    ratio: true,
  },
  { key: "gross_margin", label: "毛利率", kind: "percent", ratio: true },
  {
    key: "operating_margin",
    label: "营业利润率",
    kind: "percent",
    ratio: true,
  },
  { key: "net_margin", label: "净利率", kind: "percent", ratio: true },
  {
    key: "fcf_margin",
    label: "自由现金流利润率",
    kind: "percent",
    ratio: true,
  },
  { key: "roe", label: "净资产收益率", kind: "percent", ratio: true },
  {
    key: "liabilities_to_equity",
    label: "负债权益比",
    kind: "multiple",
    ratio: true,
  },
];
/** Statements come from the provider; long-term history comes from SEC filings. */
export function FinancialsTab({ symbol }: { symbol: string }) {
  const [view, setView] = useState("statements");
  return (
    <View style={{ gap: 16 }}>
      <Filters
        values={[
          ["statements", "财务报表"],
          ["history", "长期历史 · TTM · 比率"],
        ]}
        value={view}
        onChange={setView}
      />
      {view === "statements" ? (
        <Statements symbol={symbol} />
      ) : (
        <LongTermFinancials symbol={symbol} />
      )}
    </View>
  );
}
function LongTermFinancials({ symbol }: { symbol: string }) {
  const f = useFormat();
  const [frequency, setFrequency] = useState("annual");
  const [shareError, setShareError] = useState(false);
  const quarterly = frequency === "quarterly";
  const resource = useResource(
    `sec-financials:${symbol}`,
    (signal) => secFinancials(symbol, signal),
    SEC_TIMEOUT,
  );
  const data = resource.data;
  const history = (quarterly ? data?.quarterly : data?.annual) ?? [];
  const ttm = !quarterly ? (data?.ttm ?? null) : null;
  const columns = [
    ...(ttm ? [{ id: "ttm", label: "TTM", row: ttm, fullYear: true }] : []),
    ...history.map((row) => ({
      id: row.period,
      label: f.date(row.period),
      row,
      fullYear: !quarterly,
    })),
  ];
  type Column = (typeof columns)[number];
  const value = (column: Column, metric: Metric): number | null =>
    metric.ratio &&
    !(
      metric.key in column.row &&
      column.row[metric.key as keyof FinancialRow] !== undefined
    )
      ? financialRatios(column.row, history, column.fullYear)[
          metric.key as
            "revenue_growth" | "fcf_margin" | "roe" | "liabilities_to_equity"
        ]
      : ((column.row[metric.key as keyof FinancialRow] as
          number | null | undefined) ?? null);
  const format = (metric: Metric, raw: number | null) =>
    metric.kind === "percent"
      ? f.percent(raw)
      : metric.kind === "multiple"
        ? raw === null
          ? "—"
          : `${f.number(raw, false)}×`
        : f.number(raw, metric.kind !== "plain");
  const available = metrics.filter((metric) =>
    columns.some((column) => value(column, metric) !== null),
  );
  const chartRows = history.slice(0, 20).reverse();
  const series = (metric: "revenue" | "net_margin" | "free_cash_flow") =>
    chartRows.map((row) => ({
      label: row.period,
      value: row[metric] ?? null,
    }));
  const span = history.length
    ? `${f.date(history[history.length - 1].period)} – ${f.date(history[0].period)}`
    : "";
  async function share() {
    const csv = [
      [
        "Metric",
        ...columns.map((column) =>
          column.id === "ttm" ? `TTM ${column.row.period}` : column.id,
        ),
      ],
      ...available.map((metric) => [
        metric.label,
        ...columns.map((column) => value(column, metric)),
      ]),
    ]
      .map((row) => row.map((cell) => csvCell(cell)).join(","))
      .join("\r\n");
    try {
      await exportCSV(`${symbol}-sec-${frequency}`, csv);
      setShareError(false);
    } catch {
      setShareError(true);
    }
  }
  return (
    <View style={{ gap: 16 }}>
      <Section
        title="长期财务"
        note={
          history.length
            ? `${data?.currency ?? ""} · ${history.length} 个报告期 · ${span}`
            : undefined
        }
      />
      <Filters
        values={[
          ["annual", "年度"],
          ["quarterly", "季度"],
        ]}
        value={frequency}
        onChange={setFrequency}
      />
      <SecState skeleton={<CardsSkeleton count={2} padding={16} gap={8} lines={[{ size: 16, width: "30%" }]} chartHeight={120} />}
        resource={resource}
        empty={!columns.length}
        emptyText="SEC 没有这只证券的美国会计准则财务数据。按 IFRS 申报的外国公司和 ETF 不在覆盖范围内。"
        errorText="SEC 数据加载失败，请重试。"
      />
      {!!columns.length && !resource.loading && (
        <>
          {!!chartRows.length && (
            <>
              <Glass style={{ padding: 16, gap: 8 }}>
                <Copy bold>营业收入</Copy>
                <MetricBars
                  points={series("revenue")}
                  format={(v) => f.number(v)}
                  list={false}
                />
              </Glass>
              <Glass style={{ padding: 16, gap: 8 }}>
                <Copy bold>净利率</Copy>
                <MetricBars
                  points={series("net_margin")}
                  format={f.percent}
                  list={false}
                />
              </Glass>
              <Glass style={{ padding: 16, gap: 8 }}>
                <Copy bold>自由现金流</Copy>
                <MetricBars
                  points={series("free_cash_flow")}
                  format={(v) => f.number(v)}
                  list={false}
                />
              </Glass>
            </>
          )}
          <DataTable
            label="SEC 财务历史，可横向滚动查看更多报告期"
            corner="报告期截止日"
            columns={columns.map((column) => {
              const source = Object.values(column.row.sources).find(
                (item) => item.source_url,
              )?.source_url;
              const safe =
                column.id === "ttm" ? undefined : secSourceUrl(source);
              return {
                key: column.id,
                label: column.label,
                note:
                  column.id === "ttm" ? f.date(column.row.period) : undefined,
                onPress: safe
                  ? () => void Linking.openURL(safe).catch(() => undefined)
                  : undefined,
              };
            })}
            rows={available.map((metric) => ({
              key: String(metric.key),
              label: metric.label,
              strong: !metric.ratio,
              cells: columns.map((column) => {
                const derived =
                  column.row.sources[String(metric.key)]?.derived &&
                  column.id !== "ttm";
                return `${format(metric, value(column, metric))}${derived ? "*" : ""}`;
              }),
            }))}
          />
          <Button onPress={() => void share()}>导出 CSV</Button>
          {shareError && (
            <Failure message="此环境无法导出或分享，请使用报表列表查看数据。" />
          )}
          <Note>
            来源：SEC EDGAR 公司披露数据，点击日期可查看申报原文。*
            表示由累计披露数相减得出。TTM
            为最近连续四个季度之和，季度不连续时不显示；第四季度通常没有单独披露
            EPS，所以 TTM EPS 多为空。EPS
            为申报时的原值，未按之后的拆股调整，拆股前后的跳变不代表真实变化。净资产收益率使用期末股东权益。自由现金流
            = 经营现金流 − 资本支出。历史长度取决于公司的 XBRL 申报（一般始于
            2009 年前后），重述数据以最新申报为准。
          </Note>
        </>
      )}
    </View>
  );
}
const periodLabels: Record<string, string> = {
  "0q": "本季度",
  "+1q": "下季度",
  "0y": "本财年",
  "+1y": "下财年",
};
/** Revenue consensus and SEC filing links, shown below the EPS history. */
export function EarningsMaterials({ symbol }: { symbol: string }) {
  return (
    <View style={{ gap: 24 }}>
      <RevenueEstimates symbol={symbol} />
      <EarningsFilings symbol={symbol} />
    </View>
  );
}
function RevenueEstimates({ symbol }: { symbol: string }) {
  const f = useFormat();
  const resource = useResource(
    `revenue-outlook:${symbol}`,
    (signal) => revenueOutlook(symbol, signal),
    SEC_TIMEOUT,
  );
  const rows = resource.data?.estimates ?? [];
  const source = resource.data?.source ?? "Yahoo Finance";
  const currency = resource.data?.currency;
  return (
    <View style={{ gap: 12 }}>
      <Section title="营收预期" />
      <SecState skeleton={<CardsSkeleton count={1} padding={16} gap={8} lines={[{ size: 14, width: "40%" }, { size: 14, lines: 8, width: "80%" }]} />}
        resource={resource}
        empty={!rows.length}
        emptyText="免费数据源暂无这只股票的营收预期。"
        errorText="营收预期加载失败，请重试。"
      />
      {!!rows.length && !resource.loading && (
        <DataTable
          label="营收预期表，可横向滚动"
          corner="周期"
          labelWidth={104}
          columns={[
            "平均预期",
            "最低",
            "最高",
            "去年同期",
            "隐含增长",
            "分析师数",
          ].map((label) => ({ key: label, label }))}
          rows={rows.map((row) => ({
            key: row.period,
            label: periodLabels[row.period] ?? row.period,
            cells: [
              f.number(row.average),
              f.number(row.low),
              f.number(row.high),
              f.number(row.year_ago),
              f.percent(row.growth),
              f.number(row.analysts, false),
            ],
          }))}
        />
      )}
      <Note>
        {`来源：${source}${currency ? ` · ${currency}` : ""}。仅为当前一致预期：免费数据源不保留历史营收预期，所以暂无各季度营收 Beat/Miss，也不做推算。`}
      </Note>
    </View>
  );
}
function filingType(form: string, items: string[] = []) {
  if (form.startsWith("10-K") || form.startsWith("20-F")) return "年度报告";
  if (form.startsWith("10-Q")) return "季度报告";
  if (items.includes("2.02")) return "财报发布（Item 2.02），新闻稿见附件";
  return "临时报告";
}
function EarningsFilings({ symbol }: { symbol: string }) {
  const f = useFormat();
  const t = useTheme();
  const [scope, setScope] = useState("earnings");
  const resource = useResource(
    `sec-filings:${symbol}`,
    (signal) => secFilings(symbol, signal),
    SEC_TIMEOUT,
  );
  const filings = resource.data?.filings ?? [];
  const rows =
    scope === "earnings" ? filings.filter((row) => row.earnings) : filings;
  return (
    <View style={{ gap: 12 }}>
      <Section title="财报原文" />
      <Filters
        values={[
          ["earnings", "财报相关"],
          ["all", "全部近期"],
        ]}
        value={scope}
        onChange={setScope}
      />
      <SecState skeleton={<CardsSkeleton count={1} padding={16} gap={8} lines={[{ size: 13, width: "50%" }, { size: 12, width: "30%" }, { size: 13, width: "60%" }, { size: 12, width: "30%" }, { size: 13, width: "45%" }, { size: 12, width: "30%" }]} />}
        resource={resource}
        empty={!rows.length}
        emptyText="SEC 暂无这只证券的相关申报。"
        errorText="SEC 申报加载失败，请重试。"
      />
      {!resource.loading && !!rows.length && (
        <Glass style={{ paddingHorizontal: 16 }}>
          {rows.map((row, index) => (
            <View
              key={row.accession}
              style={{
                gap: 4,
                paddingVertical: 12,
                borderTopWidth: index ? 1 : 0,
                borderColor: t.border,
              }}
            >
              <SecLink href={row.source_url} label={row.form} />
              <Copy size={13}>{filingType(row.form, row.items)}</Copy>
              <Copy size={12} muted localize={false}>
                {f.date(row.filed)}
                {row.period ? ` · ${f.date(row.period)}` : ""}
              </Copy>
            </View>
          ))}
        </Glass>
      )}
      <Note>
        来源：SEC
        EDGAR。链接打开申报索引页，可查看全部附件。电话会文字稿和演示文稿没有可靠的免费来源，这里不提供。
      </Note>
    </View>
  );
}
const codeLabels: Record<string, string> = {
  P: "公开市场买入",
  S: "公开市场卖出",
  A: "授予",
  M: "期权行权",
  F: "代扣税",
  G: "赠与",
  D: "售回公司",
  C: "转换",
  J: "其他",
};
export function Ownership({
  symbol,
  companyName,
}: {
  symbol: string;
  companyName?: string | null;
}) {
  const [view, setView] = useState("insiders");
  return (
    <View style={{ gap: 16 }}>
      <Filters
        values={[
          ["insiders", "内部人交易"],
          ["institutions", "投资机构 13F"],
        ]}
        value={view}
        onChange={setView}
      />
      {view === "insiders" ? (
        <Insiders symbol={symbol} />
      ) : (
        <Institutions companyName={companyName} />
      )}
    </View>
  );
}
function Insiders({ symbol }: { symbol: string }) {
  const f = useFormat();
  const t = useTheme();
  const resource = useResource(
    `sec-insiders:${symbol}`,
    (signal) => secInsiders(symbol, signal),
    SEC_TIMEOUT,
  );
  const data = resource.data;
  const rows = data?.transactions ?? [];
  const summary = insiderSummary(rows);
  const total = (side: typeof summary.buys) =>
    side.count ? `$${f.number(side.value)}${side.incomplete ? "+" : ""}` : "无";
  return (
    <View style={{ gap: 16 }}>
      <SecState skeleton={<><CardsSkeleton count={1} padding={16} gap={8} lines={[{ size: 12, width: "30%" }, { size: 16, width: "40%" }, { size: 12, width: "30%" }, { size: 16, width: "40%" }]} /><CardsSkeleton count={1} padding={16} gap={8} lines={[{ size: 13, lines: 6, width: "70%" }]} /></>}
        resource={resource}
        empty={!rows.length}
        emptyText="最近的申报中没有 Form 4 交易。外国私人发行人通常不提交 Form 4。"
        errorText="内部人申报加载失败，请重试。"
      />
      {!!rows.length && !resource.loading && (
        <>
          <FactList
            items={[
              ["公开市场买入", total(summary.buys)],
              ["公开市场卖出", total(summary.sells)],
              [
                "覆盖交易日期",
                summary.from && summary.to
                  ? `${f.date(summary.from)} – ${f.date(summary.to)}`
                  : "—",
              ],
              [
                "已读取申报",
                `${(data?.filings.length ?? 0) - (data?.failed_filings ?? 0)} / ${data?.filings.length ?? 0}`,
              ],
            ]}
          />
          <Glass style={{ paddingHorizontal: 16 }}>
            {rows.map((row, index) => (
              <View
                key={`${row.source_url}-${index}`}
                style={{
                  gap: 4,
                  paddingVertical: 12,
                  borderTopWidth: index ? 1 : 0,
                  borderColor: t.border,
                }}
              >
                <Copy bold size={14} localize={false}>
                  {row.owner}
                </Copy>
                <Copy size={12} muted localize={false}>
                  {row.position}
                </Copy>
                <Copy
                  size={13}
                  color={
                    row.code === "P"
                      ? t.accent
                      : row.code === "S"
                        ? t.negative
                        : t.secondary
                  }
                >
                  {(row.code && codeLabels[row.code]) || row.code || "—"}
                  {row.amended ? " · 修正" : ""}
                </Copy>
                <Copy size={13} localize={false}>
                  {f.number(row.shares, false)} ×{" "}
                  {row.price === null ? "—" : `$${f.number(row.price, false)}`}{" "}
                  ={" "}
                  {row.value === null || row.value === 0
                    ? "—"
                    : `$${f.number(row.value)}`}
                </Copy>
                <Copy size={12} muted>
                  {`交易日 ${row.date ? f.date(row.date) : "—"} · 交易后持股 ${f.number(row.shares_after, false)}`}
                </Copy>
                <SecLink href={row.source_url} label={f.date(row.filed)} />
              </View>
            ))}
          </Glass>
        </>
      )}
      <Note>
        {`来源：SEC Form 4 及 4/A。仅含最近 ${data?.filing_limit ?? 12} 份申报中的非衍生品交易，不是完整交易历史，所以不显示 3／6／12 个月汇总。合计只统计公开市场交易（代码 P、S）；授予、行权、代扣税等会列出但不计入。修正申报单独成行。`}
      </Note>
    </View>
  );
}
const PAGE = 50;
const activityLabels: Record<
  Institution["holdings"][number]["activity"],
  string
> = {
  new: "新建仓",
  increased: "增持",
  reduced: "减持",
  exited: "清仓",
  unchanged: "不变",
  unknown: "未比较",
};
function Institutions({ companyName }: { companyName?: string | null }) {
  const f = useFormat();
  const t = useTheme();
  const [manager, setManager] = useState("berkshire");
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(PAGE);
  const list = useResource(
    "sec-managers",
    (signal) => managers(signal),
    SEC_TIMEOUT,
  );
  const resource = useResource(
    `sec-institution:${manager}`,
    (signal) => institution(manager, signal),
    SEC_TIMEOUT,
  );
  const data = resource.data;
  const holdings = data?.holdings ?? [];
  const held = holdings.filter((row) => row.activity !== "exited");
  const totalValue = held.reduce((sum, row) => sum + (row.value ?? 0), 0);
  const needle = query.trim().toUpperCase();
  const filtered = holdings.filter(
    (row) =>
      !needle ||
      row.issuer.toUpperCase().includes(needle) ||
      row.cusip?.includes(needle),
  );
  const matches = holdings.filter((row) => sameIssuer(row.issuer, companyName));
  const rows = [
    ...filtered.filter((row) => matches.includes(row)),
    ...filtered.filter((row) => !matches.includes(row)),
  ].slice(0, visible);
  const companyMatch = matches.find((row) => row.activity !== "exited");
  return (
    <View style={{ gap: 16 }}>
      <Section title={data?.name ?? "投资机构 13F"} localize={!data?.name} />
      <Filters
        values={(
          list.data?.managers ?? [
            { id: "berkshire", name: "Berkshire Hathaway", cik: 0 },
          ]
        ).map((item) => [item.id, item.name] as const)}
        value={manager}
        onChange={(value) => {
          setManager(value);
          setVisible(PAGE);
          setQuery("");
        }}
      />
      <Field
        label="按公司筛选"
        value={query}
        onChangeText={(value) => {
          setQuery(value);
          setVisible(PAGE);
        }}
        autoCorrect={false}
      />
      <SecState skeleton={<><CardsSkeleton count={1} padding={16} gap={8} lines={[{ size: 12, width: "30%" }, { size: 16, width: "40%" }, { size: 12, width: "30%" }, { size: 16, width: "40%" }]} /><CardsSkeleton count={1} padding={16} gap={8} lines={[{ size: 13, lines: 8, width: "70%" }]} /></>}
        resource={resource}
        empty={!holdings.length}
        emptyText="这家机构暂无可用的 13F 持仓。"
        errorText="13F 持仓加载失败，请重试。"
      />
      {!!holdings.length && data?.filing && !resource.loading && (
        <>
          <FactList
            items={[
              ["持仓截止日", f.date(data.filing.period)],
              ["申报日", f.date(data.filing.filed)],
              ["持仓数", f.number(held.length, false)],
              ["申报市值", `$${f.number(totalValue)}`],
            ]}
          />
          <SecLink href={data.filing.source_url} label="SEC 13F-HR" />
          {!!companyName && (
            <Copy size={14} muted>
              {companyMatch
                ? `${companyName} 占这份申报的 ${f.percent(companyMatch.weight)}，已置顶显示。`
                : `这份申报中没有与 ${companyName} 名称一致的持仓。名称写法可能不同，可用筛选再确认。`}
            </Copy>
          )}
          <Glass style={{ paddingHorizontal: 16 }}>
            {rows.map((row, index) => (
              <View
                key={`${row.cusip}-${row.class}-${row.share_type}-${row.put_call}`}
                style={{
                  gap: 4,
                  paddingVertical: 12,
                  borderTopWidth: index ? 1 : 0,
                  borderColor: t.border,
                  backgroundColor: matches.includes(row) ? t.tint : undefined,
                }}
              >
                <Copy size={14} bold localize={false}>
                  {row.issuer}
                </Copy>
                <Copy size={12} muted localize={false}>
                  {row.class}
                  {row.put_call ? ` · ${row.put_call}` : ""}
                </Copy>
                <Copy size={13} localize={false}>
                  ${f.number(row.value)} · {f.percent(row.weight)} ·{" "}
                  {f.number(row.shares)}
                </Copy>
                <Copy
                  size={13}
                  color={
                    row.activity === "new" || row.activity === "increased"
                      ? t.accent
                      : row.activity === "reduced" || row.activity === "exited"
                        ? t.negative
                        : t.secondary
                  }
                >
                  {activityLabels[row.activity]}
                  {row.change === null
                    ? ""
                    : ` · ${row.change > 0 ? "+" : row.change < 0 ? "−" : ""}${f.number(Math.abs(row.change))}`}
                  {row.change_percent !== null && row.change !== 0
                    ? ` (${f.percent(row.change_percent)})`
                    : ""}
                </Copy>
              </View>
            ))}
            {!rows.length && (
              <View style={{ paddingVertical: 24 }}>
                <Copy size={14} muted>
                  没有符合筛选条件的持仓。
                </Copy>
              </View>
            )}
          </Glass>
          {filtered.length > visible && (
            <Button onPress={() => setVisible((count) => count + PAGE)}>
              {`显示更多（${filtered.length - visible}）`}
            </Button>
          )}
          {data.partial && (
            <Copy size={14} muted>
              这份申报有修正，或上季申报无法读取，所以不比较季度变化。
            </Copy>
          )}
        </>
      )}
      <Note>
        来源：SEC Form 13F-HR。这是季度末持仓快照，最晚在季末 45
        天后才披露，不代表当前持仓，也不含空头和大部分非美股持仓。股数变化未按拆股调整，仅比较相邻两个季度。投资机构为精选名单。
      </Note>
    </View>
  );
}
