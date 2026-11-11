import { PersonalResearch } from "./PersonalResearch";
import { usePreferences } from "../state/Preferences";
import { CardsSkeleton } from "./Skeletons";
import { StockOpinions } from "./StockOpinions";
import { StockOptionsChain } from "./StockOptionsChain";
import { StockValuation } from "./StockValuation";
import { AiFundamentals } from "./AiFundamentals";
import { StockPaperTrading } from "./StockPaperTrading";
import { Multicharts, Earnings, Analysts } from "./StockResearch";
import { EarningsMaterials, FinancialsTab, Ownership } from "./SecResearch";
import { StockPeers } from "./StockPeers";
import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useTheme } from "../lib/theme";
import { BENCHMARKS } from "../lib/marketBenchmarks";
import { useAuth } from "../state/Auth";
import { apiRequest } from "../lib/http";
import { demoMode } from "../lib/config";
import { news, reports, stockFacts } from "../lib/contentApi";
import { number } from "../lib/models";
import { useResource } from "../lib/useResource";
import { useNewsTranslations } from "../lib/useNewsTranslations";
import { Button, Copy, Empty, Glass, Section } from "./UI";
import { Filters, ResourceState, SourceLink } from "./Content";
// The Web's StockWorkspace tab order and phone labels.
const allTabs = [
  ["summary", "概览"],
  ["technical", "技术分析"],
  ["paper-trading", "我的虚拟交易"],
  ["creators", "博主情报"],
  ["research", "AI 研究"],
  ["news", "新闻"],
  ["options", "期权"],
  ["financials", "财务报表"],
  ["valuation", "估值"],
  ["earnings", "盈利表现"],
  ["multicharts", "指标趋势"],
  ["analyst", "分析师目标价"],
  ["peers", "同行比较"],
  ["ownership", "内部人交易"],
  ["profile", "公司资料"],
] as const;
const benchmarkTabs = [
  "summary",
  "technical",
  "creators",
  "research",
  "news",
  "options",
];
/** Tabs that show the price card above their content, as on the Web. */
const CHART_TABS = ["summary", "technical", "paper-trading"];
export function StockContent({
  symbol,
  currency,
  companyName,
  initialTab,
  chart,
}: {
  symbol: string;
  currency?: string;
  companyName?: string;
  initialTab?: string;
  chart?: React.ReactNode;
}) {
  const t = useTheme();
  const benchmark = BENCHMARKS.some((item) => item.symbol === symbol);
  const user = useAuth().session?.user.id;
  const tabs = benchmark
    ? allTabs.filter(([key]) => benchmarkTabs.includes(key))
    : allTabs;
  const [tab, setTab] = useState<string>(
    tabs.some(([key]) => key === initialTab) ? initialTab! : "summary",
  );
  return (
    <View style={{ gap: 16 }}>
      <Filters values={tabs} value={tab} onChange={setTab} />
      {CHART_TABS.includes(tab) && chart}
      {tab === "technical" ? (
        <Button
          icon={
            <SymbolView
              name={{
                ios: "chart.xyaxis.line",
                android: "candlestick_chart",
                web: "candlestick_chart",
              }}
              size={14}
              tintColor={t.text}
            />
          }
          onPress={() =>
            router.push(`/technical/${encodeURIComponent(symbol)}`)
          }
        >
          K 线、指标与 AI 画线
        </Button>
      ) : demoMode ? (
        <Empty
          title="连接真实数据后查看"
          message="公司资料、财务指标及新闻均来自后端，不提供模拟资料。"
        />
      ) : tab === "profile" ? (
        <Company symbol={symbol} />
      ) : tab === "summary" ? (
        <>
          {/* The Web shows fundamentals for companies only; an index shows its chart. */}
          {!benchmark && !!user && <AiFundamentals symbol={symbol} />}
          {!benchmark && <Financials symbol={symbol} />}
        </>
      ) : tab === "valuation" ? (
        <StockValuation key={symbol} symbol={symbol} />
      ) : tab === "financials" ? (
        <FinancialsTab symbol={symbol} />
      ) : tab === "multicharts" ? (
        <Multicharts symbol={symbol} />
      ) : tab === "earnings" ? (
        <>
          <Earnings symbol={symbol} />
          <EarningsMaterials symbol={symbol} />
        </>
      ) : tab === "analyst" ? (
        <Analysts symbol={symbol} currency={currency} />
      ) : tab === "peers" ? (
        <StockPeers symbol={symbol} />
      ) : tab === "ownership" ? (
        <Ownership symbol={symbol} companyName={companyName} />
      ) : tab === "creators" ? (
        <StockOpinions symbol={symbol} />
      ) : tab === "options" ? (
        <StockOptionsChain key={symbol} symbol={symbol} />
      ) : tab === "paper-trading" ? (
        <StockPaperTrading key={symbol} symbol={symbol} />
      ) : tab === "research" ? (
        <StockReports symbol={symbol} />
      ) : (
        <StockNews symbol={symbol} />
      )}
    </View>
  );
}
function StockReports({ symbol }: { symbol: string }) {
  const user = useAuth().session?.user.id;
  const resource = useResource(`stock-reports:${user}:${symbol}`, (signal) =>
    reports(signal, user ?? "", 0, symbol),
  );
  const rows = (resource.data?.items ?? []).filter(
    (item) => item.status === "completed",
  );
  return (
    <>
      {!!user && <PersonalResearch symbol={symbol} />}
      <ResourceState
        skeleton={
          <CardsSkeleton
            lines={[
              { size: 16, width: "30%" },
              { size: 14, width: "70%", lines: 2 },
            ]}
            buttons={1}
          />
        }
        resource={resource}
        empty={!rows.length}
        message="这只股票还没有已发布的研究报告。"
      />
      {rows.map((item) => (
        <Glass key={item.id} style={{ padding: 20, gap: 12 }}>
          <Copy bold>{item.trade_date}</Copy>
          <Copy size={14} localize={false}>
            {item.final_decision?.slice(0, 240) || "—"}
          </Copy>
          <Button
            onPress={() =>
              router.push(`/report/${encodeURIComponent(item.id)}`)
            }
          >
            阅读报告
          </Button>
        </Glass>
      ))}
    </>
  );
}
function Company({ symbol }: { symbol: string }) {
  const resource = useResource(symbol, (signal) => stockFacts(symbol, signal));
  const data = resource.data;
  return (
    <>
      <ResourceState
        skeleton={
          <CardsSkeleton
            count={1}
            lines={[
              { size: 20, width: "40%" },
              { size: 12, width: "50%" },
              { size: 16, width: "60%", lines: 4 },
              { size: 14, width: "40%" },
              { size: 14, width: "25%" },
            ]}
          />
        }
        resource={resource}
        empty={!data}
        message="暂无公司资料。"
      />
      {data && (
        <Glass style={{ padding: 20, gap: 12 }}>
          <Section
            title={data.name || symbol}
            note={[data.sector, data.industry].filter(Boolean).join(" · ")}
          />
          <Copy>{data.business_summary || "公司简介未提供。"}</Copy>
          <Copy size={14} muted>
            员工数：{number(data.employees, 0)}
          </Copy>
          {!!data.website && (
            <SourceLink url={data.website}>公司网站 ↗</SourceLink>
          )}
        </Glass>
      )}
    </>
  );
}
function Financials({ symbol }: { symbol: string }) {
  const t = useTheme();
  const resource = useResource(symbol, (signal) =>
    apiRequest<Record<string, unknown>>(
      `/market/financials/${encodeURIComponent(symbol)}`,
      { signal },
    ),
  );
  const data = resource.data;
  const fields = [
    ["pe_ratio", "市盈率"],
    ["forward_pe", "预期市盈率"],
    ["price_to_book", "市净率"],
    ["price_to_sales", "市销率"],
    ["profit_margins", "净利率"],
    ["operating_margins", "营业利润率"],
    ["return_on_equity", "净资产收益率"],
    ["revenue_growth", "营收增长率"],
    ["debt_to_equity", "负债权益比"],
    ["free_cash_flow", "自由现金流"],
  ];
  return (
    <>
      <ResourceState
        skeleton={
          <CardsSkeleton
            count={1}
            lines={[
              { size: 20, width: "50%" },
              { size: 12, width: "60%" },
              { size: 14, width: "30%" },
              { size: 16, width: "40%" },
              { size: 14, width: "30%" },
              { size: 16, width: "40%" },
              { size: 14, width: "30%" },
              { size: 16, width: "40%" },
              { size: 14, width: "30%" },
              { size: 16, width: "40%" },
              { size: 14, width: "30%" },
              { size: 16, width: "40%" },
              { size: 14, width: "30%" },
              { size: 16, width: "40%" },
            ]}
            gap={16}
          />
        }
        resource={resource}
        empty={!data}
        message="暂无财务指标。"
      />
      {data && (
        // The Web's fundamentals group card: a quiet heading, then label / value rows.
        <Glass style={{ padding: 16, gap: 4 }}>
          <Copy size={14} muted>
            核心财务指标
          </Copy>
          {fields.map(([key, label], index) => {
            const value =
              typeof data[key] === "number" ? (data[key] as number) : undefined;
            const pct = [
              "profit_margins",
              "operating_margins",
              "return_on_equity",
              "revenue_growth",
            ].includes(key);
            return (
              <View
                key={key}
                style={{
                  flexDirection: "row",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 16,
                  paddingVertical: 10,
                  borderTopWidth: index ? 1 : 0,
                  borderColor: t.border,
                }}
              >
                <Copy size={14} muted>
                  {label}
                </Copy>
                <Copy size={14} bold localize={false}>
                  {`${number(value == null ? undefined : pct ? value * 100 : value)}${value != null && pct ? "%" : ""}`}
                </Copy>
              </View>
            );
          })}
        </Glass>
      )}
    </>
  );
}
function StockNews({ symbol }: { symbol: string }) {
  const { locale } = usePreferences();
  const resource = useResource(symbol, (signal) => news(signal, symbol));
  const rows = resource.data?.articles ?? [];
  const translated = useNewsTranslations(
    rows.filter((item) => !item.title_zh).map((item) => item.title),
    locale,
  );
  return (
    <>
      <ResourceState
        skeleton={
          <CardsSkeleton
            lines={[
              { size: 16, width: "70%", lines: 2 },
              { size: 12, width: "30%" },
            ]}
          />
        }
        resource={resource}
        empty={!rows.length}
        message="暂未返回这只股票的新闻。"
      />
      {rows.map((item, i) => (
        <Glass key={item.uuid || i} style={{ padding: 20, gap: 12 }}>
          <Copy bold localize={false}>
            {locale === "zh"
              ? item.title_zh || translated.title(item.title) || item.title
              : item.title}
          </Copy>
          <Copy size={12} muted>
            {item.publisher || "来源未提供"} ·{" "}
            {item.publish_time
              ? new Date(item.publish_time * 1000).toLocaleString(
                  locale === "en" ? "en-US" : "zh-CN",
                )
              : "时间未提供"}
          </Copy>
          {!!item.summary && <Copy localize={false}>{item.summary}</Copy>}
          <SourceLink url={item.link}>阅读原文 ↗</SourceLink>
        </Glass>
      ))}
    </>
  );
}
