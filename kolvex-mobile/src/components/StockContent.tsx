import { useState } from "react";
import { View } from "react-native";
import { apiRequest } from "../lib/http";
import { demoMode } from "../lib/config";
import { stockFacts, news } from "../lib/contentApi";
import { number } from "../lib/models";
import { useResource } from "../lib/useResource";
import { Copy, Empty, Glass, Section } from "./UI";
import { Filters, ResourceState, SourceLink } from "./Content";
export function StockContent({ symbol }: { symbol: string }) {
  const [tab, setTab] = useState("company");
  return (
    <View style={{ gap: 16 }}>
      <Filters
        values={[
          ["company", "公司资料"],
          ["financials", "基本面"],
          ["news", "最新新闻"],
        ]}
        value={tab}
        onChange={setTab}
      />
      {demoMode ? (
        <Empty
          title="连接真实数据后查看"
          message="公司资料、财务指标及新闻均来自后端，不提供模拟资料。"
        />
      ) : tab === "company" ? (
        <Company symbol={symbol} />
      ) : tab === "financials" ? (
        <Financials symbol={symbol} />
      ) : (
        <StockNews symbol={symbol} />
      )}
    </View>
  );
}
function Company({ symbol }: { symbol: string }) {
  const resource = useResource(symbol, (signal) => stockFacts(symbol, signal));
  const data = resource.data;
  return (
    <>
      <ResourceState
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
          {data.website && (
            <SourceLink url={data.website}>公司网站 ↗</SourceLink>
          )}
        </Glass>
      )}
    </>
  );
}
function Financials({ symbol }: { symbol: string }) {
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
    ["free_cashflow", "自由现金流"],
  ];
  return (
    <>
      <ResourceState
        resource={resource}
        empty={!data}
        message="暂无财务指标。"
      />
      {data && (
        <Glass style={{ padding: 20, gap: 16 }}>
          <Section title="核心财务指标" note="数据口径沿用现有市场数据源" />
          {fields.map(([key, label]) => {
            const value =
              typeof data[key] === "number" ? (data[key] as number) : undefined;
            return (
              <View key={key} style={{ gap: 4 }}>
                <Copy size={14} muted>
                  {label}
                </Copy>
                <Copy>
                  {number(
                    value == null
                      ? undefined
                      : [
                            "profit_margins",
                            "operating_margins",
                            "return_on_equity",
                            "revenue_growth",
                          ].includes(key)
                        ? value * 100
                        : value,
                  )}
                  {value != null &&
                  [
                    "profit_margins",
                    "operating_margins",
                    "return_on_equity",
                    "revenue_growth",
                  ].includes(key)
                    ? "%"
                    : ""}
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
  const resource = useResource(symbol, (signal) => news(signal, symbol));
  const rows = resource.data?.articles ?? [];
  return (
    <>
      <ResourceState
        resource={resource}
        empty={!rows.length}
        message="暂未返回这只股票的新闻。"
      />
      {rows.map((item, i) => (
        <Glass key={item.uuid || i} style={{ padding: 20, gap: 12 }}>
          <Copy bold>{item.title}</Copy>
          <Copy size={12} muted>
            {item.publisher || "来源未提供"} ·{" "}
            {item.publish_time
              ? new Date(item.publish_time * 1000).toLocaleString("zh-CN")
              : "时间未提供"}
          </Copy>
          {!!item.summary && <Copy>{item.summary}</Copy>}
          <SourceLink url={item.link}>阅读原文 ↗</SourceLink>
        </Glass>
      ))}
    </>
  );
}
