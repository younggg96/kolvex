import { PersonalResearch } from "./PersonalResearch";
import { usePreferences } from "../state/Preferences";
import { CardsSkeleton } from "./Skeletons";
import { StockOpinions } from "./StockOpinions";
import { StockOptionsChain } from "./StockOptionsChain";
import { StockValuation } from "./StockValuation";
import { AiFundamentals } from "./AiFundamentals";
import { StockFundamentals } from "./StockFundamentals";
import { StockPaperTrading } from "./StockPaperTrading";
import { Multicharts, Earnings, Analysts } from "./StockResearch";
import { EarningsMaterials, FinancialsTab, Ownership } from "./SecResearch";
import { StockPeers } from "./StockPeers";
import { TechnicalPreview } from "./TechnicalPreview";
import { useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { router } from "expo-router";
import { BENCHMARKS } from "../lib/marketBenchmarks";
import { useAuth } from "../state/Auth";
import { demoMode } from "../lib/config";
import { news, reports, stockFacts } from "../lib/contentApi";
import { number } from "../lib/models";
import { useResource } from "../lib/useResource";
import { useNewsTranslations } from "../lib/useNewsTranslations";
import { Button, Copy, Empty, Glass, Section } from "./UI";
import { Filters, ResourceState, SourceLink } from "./Content";
import { ListItem, type } from "./StockBlocks";
import { safeExternal } from "../lib/links";
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
// Technicals draws its own annotated chart card.
const CHART_TABS = ["summary", "paper-trading"];
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
        <TechnicalPreview symbol={symbol} />
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
          {!benchmark && <StockFundamentals symbol={symbol} />}
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
        <Glass key={item.id} style={{ padding: 16, gap: 12 }}>
          <Copy size={15} bold>
            {item.trade_date}
          </Copy>
          <Copy size={14} localize={false}>
            {item.final_decision?.slice(0, 240) || "—"}
          </Copy>
          <Button
            size="sm"
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
        <Glass style={{ padding: 16, gap: 12 }}>
          <Section
            title={data.name || symbol}
            note={[data.sector, data.industry].filter(Boolean).join(" · ")}
          />
          <Copy size={14}>{data.business_summary || "公司简介未提供。"}</Copy>
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
      {/* The Web's phone news feed: edge-to-edge rows, the whole row opens the article. */}
      <View>
        {rows.map((item, i) => {
          const url = safeExternal(item.link);
          return (
            <Pressable
              key={item.uuid || i}
              accessibilityRole="link"
              disabled={!url}
              onPress={() => url && void Linking.openURL(url).catch(() => {})}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <ListItem last={i === rows.length - 1}>
                <Copy size={type.item} bold localize={false} lines={3}>
                  {locale === "zh"
                    ? item.title_zh ||
                      translated.title(item.title) ||
                      item.title
                    : item.title}
                </Copy>
                {!!item.summary && (
                  <Copy size={type.body} muted localize={false} lines={3}>
                    {item.summary}
                  </Copy>
                )}
                <Copy size={type.meta} muted>
                  {item.publisher || "来源未提供"} ·{" "}
                  {item.publish_time
                    ? new Date(item.publish_time * 1000).toLocaleString(
                        locale === "en" ? "en-US" : "zh-CN",
                        {
                          month: "numeric",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )
                    : "时间未提供"}
                </Copy>
              </ListItem>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}
