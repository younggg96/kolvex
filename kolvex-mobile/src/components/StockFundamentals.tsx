import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { SymbolView } from "expo-symbols";
import { useTheme } from "../lib/theme";
import { usePreferences } from "../state/Preferences";
import { financialFormat } from "../lib/financialFormat";
import { apiRequest } from "../lib/http";
import { useResource } from "../lib/useResource";
import { finite } from "../lib/stockResearch";
import { Button, Copy, Glass, Skeleton } from "./UI";

// The Web's StockFundamentalOverview.tsx at phone size: a "Key indicators" card, nine
// group cards, a footer note and collapsible calculation notes. Source data splits into
// the /market/overview payload (quote + financials) and /market/overview-metrics.

type OverviewQuote = {
  currency?: string | null;
  market_cap?: number | null;
  fifty_two_week_low?: number | null;
  fifty_two_week_high?: number | null;
  volume?: number | null;
};
type OverviewFinancials = {
  financial_currency?: string | null;
  pe_ratio?: number | null;
  forward_pe?: number | null;
  price_to_book?: number | null;
  price_to_sales?: number | null;
  enterprise_value?: number | null;
  ev_to_revenue?: number | null;
  ev_to_ebitda?: number | null;
  profit_margins?: number | null;
  operating_margins?: number | null;
  gross_margins?: number | null;
  ebitda_margins?: number | null;
  return_on_assets?: number | null;
  return_on_equity?: number | null;
  total_revenue?: number | null;
  revenue_growth?: number | null;
  earnings_growth?: number | null;
  quarterly_earnings_growth?: number | null;
  gross_profits?: number | null;
  ebitda?: number | null;
  net_income?: number | null;
  eps_trailing?: number | null;
  eps_forward?: number | null;
  total_cash?: number | null;
  total_debt?: number | null;
  debt_to_equity?: number | null;
  current_ratio?: number | null;
  quick_ratio?: number | null;
  free_cash_flow?: number | null;
  operating_cash_flow?: number | null;
};
type Overview = {
  symbol: string;
  quote?: OverviewQuote | null;
  company?: { employees?: number | null } | null;
  financials?: OverviewFinancials | null;
};
type Metrics = {
  currency?: string | null;
  financial_currency?: string | null;
  target_currency?: string | null;
  target_mean_price?: number | null;
  current_price?: number | null;
  analyst_consensus?: string | null;
  analyst_count?: number | null;
  earnings_date?: number | null;
  beta_5y?: number | null;
  dividend_yield?: number | null;
  payout_ratio?: number | null;
  total_assets?: number | null;
  long_term_debt?: number | null;
  total_liabilities?: number | null;
  shareholder_equity?: number | null;
  operating_income?: number | null;
  capital_expenditure?: number | null;
  pretax_margin?: number | null;
  fcf_margin_annual?: number | null;
  cash_conversion_annual?: number | null;
  revenue_cagr_3y?: number | null;
  eps_cagr_3y?: number | null;
  roce_annual?: number | null;
  roic_annual?: number | null;
  price_to_fcf?: number | null;
  buyback_yield_annual?: number | null;
  forecast_earnings_growth?: number | null;
  max_drawdown_5y?: number | null;
  ytd_return?: number | null;
  benchmark_ytd_return?: number | null;
  ytd_vs_sp500?: number | null;
  shares_outstanding?: number | null;
  insider_ownership?: number | null;
  short_float?: number | null;
  income_period?: string | null;
  balance_period?: string | null;
  cash_period?: string | null;
  history_start?: string | null;
  history_end?: string | null;
  ytd_start?: string | null;
  ytd_end?: string | null;
  analyzed_at?: string | null;
  unavailable_sources?: string[];
};

/** Ratios with a positive denominator; zero numerators remain meaningful. */
function overviewRatio(a: unknown, b: unknown): number | null {
  return finite(a) && finite(b) && b > 0 && Number.isFinite(a / b)
    ? a / b
    : null;
}

/** The Web's InfoTip: a quiet ⓘ that toggles its note inline instead of a hover tooltip. */
function Info({ children }: { children: string }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="说明"
        hitSlop={8}
        onPress={() => setOpen((value) => !value)}
        style={{ padding: 2 }}
      >
        <SymbolView
          name={{ ios: "info.circle", android: "info", web: "info" }}
          size={13}
          tintColor={t.secondary}
        />
      </Pressable>
      {open && (
        <Copy size={12} muted>
          {children}
        </Copy>
      )}
    </View>
  );
}

function TrendIcon({ up, directional }: { up: boolean; directional: boolean }) {
  const t = useTheme();
  return (
    <SymbolView
      name={{
        ios: up ? "arrow.up.right" : "arrow.down.right",
        android: up ? "north_east" : "south_east",
        web: up ? "north_east" : "south_east",
      }}
      size={14}
      tintColor={directional ? (up ? t.accent : t.negative) : t.secondary}
    />
  );
}

export function StockFundamentals({ symbol }: { symbol: string }) {
  const t = useTheme();
  const { locale } = usePreferences();
  const f = financialFormat(locale);
  const overview = useResource<Overview>(`overview:${symbol}`, (signal) =>
    apiRequest<Overview>(`/market/overview/${encodeURIComponent(symbol)}`, {
      signal,
    }),
  );
  const metrics = useResource<Metrics>(`overview-metrics:${symbol}`, (signal) =>
    apiRequest<Metrics>(
      `/market/overview-metrics/${encodeURIComponent(symbol)}`,
      { signal, timeout: 22_000 },
    ),
  );
  const m = metrics.data;
  const v = overview.data?.financials;
  const q = overview.data?.quote;
  const currency = q?.currency || m?.currency || "USD";
  const financialCurrency =
    v?.financial_currency || m?.financial_currency || currency;
  const date = (value?: string | null) => (value ? f.date(value) : "—");
  const consensus: Record<string, string> = {
    strong_buy: "强烈买入",
    buy: "买入",
    hold: "持有",
    underperform: "弱于大盘",
    sell: "卖出",
    strong_sell: "强烈卖出",
    none: "—",
  };
  const groups: { title: string; note?: string; rows: [string, string][] }[] = [
    {
      title: "基本信息",
      note: "行情数据与分析师预估",
      rows: [
        ["总市值", f.number(q?.market_cap)],
        ["企业价值", f.number(v?.enterprise_value)],
        ["流通在外股数", f.number(m?.shares_outstanding)],
        ["内部人士持股比例", f.percent(m?.insider_ownership)],
        ["流通股做空比例", f.percent(m?.short_float)],
        [
          "分析师平均目标价",
          finite(m?.target_mean_price)
            ? `${f.number(m.target_mean_price, false)} ${m?.target_currency || currency}`
            : "—",
        ],
        [
          "分析师共识",
          consensus[m?.analyst_consensus as keyof typeof consensus] || "—",
        ],
        ["覆盖分析师人数", f.number(m?.analyst_count, false)],
        [
          "数据源财报日期",
          finite(m?.earnings_date)
            ? f.date(new Date(m.earnings_date * 1000).toISOString())
            : "—",
        ],
        ["员工人数", f.number(overview.data?.company?.employees)],
        [
          "52 周区间",
          `${f.number(q?.fifty_two_week_low)} – ${f.number(q?.fifty_two_week_high)}`,
        ],
        ["成交量", f.number(q?.volume)],
      ],
    },
    {
      title: "收入与利润",
      note: `数据源 TTM；营业利润：财年 ${date(m?.income_period)}`,
      rows: [
        ["营业收入", f.number(v?.total_revenue)],
        ["毛利润", f.number(v?.gross_profits)],
        ["营业利润（财年）", f.number(m?.operating_income)],
        ["净利润", f.number(v?.net_income)],
        ["息税折旧摊销前利润", f.number(v?.ebitda)],
        ["滚动每股收益", f.number(v?.eps_trailing, false)],
        ["预期每股收益", f.number(v?.eps_forward, false)],
        ["经营现金流", f.number(v?.operating_cash_flow)],
        ["自由现金流", f.number(v?.free_cash_flow)],
        ["资本支出（财年）", f.number(m?.capital_expenditure)],
      ],
    },
    {
      title: "资产与负债",
      note: `最新资产负债表：${date(m?.balance_period)}；现金与总债务以数据源为准`,
      rows: [
        ["总资产", f.number(m?.total_assets)],
        ["现金总额", f.number(v?.total_cash)],
        ["总债务", f.number(v?.total_debt)],
        ["长期债务", f.number(m?.long_term_debt)],
        ["总负债", f.number(m?.total_liabilities)],
        ["股东权益", f.number(m?.shareholder_equity)],
        [
          "债务权益比",
          f.percent(finite(v?.debt_to_equity) ? v.debt_to_equity / 100 : null),
        ],
        ["流动比率", f.number(v?.current_ratio, false)],
        ["速动比率", f.number(v?.quick_ratio, false)],
      ],
    },
    {
      title: "估值",
      note: "数据源比率；市现率使用 TTM 自由现金流",
      rows: [
        ["滚动市盈率", f.number(v?.pe_ratio, false)],
        ["预期市盈率", f.number(v?.forward_pe, false)],
        ["市销率", f.number(v?.price_to_sales, false)],
        ["市净率", f.number(v?.price_to_book, false)],
        ["市值 / 自由现金流", f.number(m?.price_to_fcf, false)],
        ["企业价值 / EBITDA", f.number(v?.ev_to_ebitda, false)],
        ["企业价值 / 营收", f.number(v?.ev_to_revenue, false)],
        [
          "现金 / 债务",
          f.number(overviewRatio(v?.total_cash, v?.total_debt), false),
        ],
      ],
    },
    {
      title: "利润率",
      note: `数据源报告周期；财年指标：${date(m?.income_period)}`,
      rows: [
        ["毛利率", f.percent(v?.gross_margins)],
        ["营业利润率", f.percent(v?.operating_margins)],
        ["EBITDA 利润率", f.percent(v?.ebitda_margins)],
        ["税前利润率（财年）", f.percent(m?.pretax_margin)],
        ["净利率", f.percent(v?.profit_margins)],
        ["自由现金流率（财年）", f.percent(m?.fcf_margin_annual)],
      ],
    },
    {
      title: "资本回报",
      note: `最新财年：${date(m?.income_period)} · ROA/ROE 以数据源为准`,
      rows: [
        ["净资产收益率（ROE）", f.percent(v?.return_on_equity)],
        ["总资产收益率（ROA）", f.percent(v?.return_on_assets)],
        ["资本使用回报率（财年）", f.percent(m?.roce_annual)],
        ["投入资本回报率（财年）", f.percent(m?.roic_annual)],
        [
          "现金转化率（经营现金流 / 净利润，财年）",
          f.number(m?.cash_conversion_annual, false),
        ],
      ],
    },
    {
      title: "增长",
      note: "三年指标为年复合增长率；预估对应下一财年",
      rows: [
        ["营收同比增长", f.percent(v?.revenue_growth)],
        ["营收三年复合增长", f.percent(m?.revenue_cagr_3y)],
        ["季度净利润同比增长", f.percent(v?.quarterly_earnings_growth)],
        ["盈利同比增长", f.percent(v?.earnings_growth)],
        ["稀释 EPS 三年复合增长", f.percent(m?.eps_cagr_3y)],
        ["下一财年 EPS 增长预估", f.percent(m?.forecast_earnings_growth)],
      ],
    },
    {
      title: "分红与回购",
      note: `股息率：年度股息 / 股价；回购：财年 ${date(m?.cash_period)}`,
      rows: [
        ["股息率", f.percent(m?.dividend_yield)],
        ["股息支付率", f.percent(m?.payout_ratio)],
        ["净回购收益率（财年）", f.percent(m?.buyback_yield_annual)],
      ],
    },
    {
      title: "风险与表现",
      note: "年回报不含股息；回撤使用含股息调整的近五年内历史",
      rows: [
        ["Beta（数据源五年月度）", f.number(m?.beta_5y, false)],
        ["最大回撤（近五年内）", f.percent(m?.max_drawdown_5y)],
        ["年初至今价格回报", f.percent(m?.ytd_return)],
        ["标普 500 年初至今价格回报", f.percent(m?.benchmark_ytd_return)],
        [
          "相对标普 500（百分点）",
          finite(m?.ytd_vs_sp500) ? f.number(m.ytd_vs_sp500 * 100, false) : "—",
        ],
      ],
    },
  ];
  const targetUpside =
    m?.target_currency === currency
      ? overviewRatio(m?.target_mean_price, m?.current_price)
      : null;
  const peRatio = overviewRatio(v?.forward_pe, v?.pe_ratio);
  const indicators = [
    { label: "营收同比增长", value: v?.revenue_growth, directional: true },
    { label: "盈利同比增长", value: v?.earnings_growth, directional: true },
    {
      label: "分析师平均目标价相对数据源股价",
      value: targetUpside === null ? null : targetUpside - 1,
      directional: false,
    },
    {
      label: "下一财年 EPS 增长预估",
      value: m?.forecast_earnings_growth,
      directional: true,
    },
    {
      label: "预期市盈率相对滚动市盈率",
      value: peRatio === null ? null : peRatio - 1,
      directional: false,
    },
  ].filter((item) => finite(item.value));
  const partial = Boolean(metrics.error || m?.unavailable_sources?.length);
  const [notesOpen, setNotesOpen] = useState(false);

  return (
    <View style={{ gap: 16 }}>
      <Glass style={{ padding: 16, gap: 16 }}>
        <Copy size={14} muted>
          关键指标
        </Copy>
        <View style={{ gap: 16 }}>
          {indicators.map((item) => {
            const value = item.value as number;
            return (
              <View
                key={item.label}
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: 12,
                }}
              >
                <View style={{ marginTop: 4 }}>
                  <TrendIcon up={value >= 0} directional={item.directional} />
                </View>
                <View
                  style={{ flex: 1, flexDirection: "row", flexWrap: "wrap" }}
                >
                  <Copy size={14}>{item.label} </Copy>
                  <Copy size={14} bold localize={false}>
                    {f.percent(value)}
                  </Copy>
                </View>
              </View>
            );
          })}
          {finite(m?.ytd_vs_sp500) && (
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              <Copy size={14}>
                {m.ytd_vs_sp500! >= 0
                  ? "年初至今跑赢标普 500"
                  : "年初至今跑输标普 500"}{" "}
              </Copy>
              <Copy
                size={14}
                bold
                localize={false}
                color={m.ytd_vs_sp500! >= 0 ? t.accent : t.negative}
              >
                {f.number(Math.abs(m.ytd_vs_sp500!) * 100, false)}
              </Copy>
              <Copy size={14}> 个百分点</Copy>
            </View>
          )}
        </View>
        {m?.analyzed_at && (
          <Copy size={12} muted>
            {`指标获取时间 ${m.analyzed_at.slice(0, 16).replace("T", " ")} UTC`}
          </Copy>
        )}
        {metrics.loading && (
          <View style={{ gap: 12 }}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: 12,
                }}
              >
                <Skeleton width={14} height={14} radius={3} />
                <View style={{ flex: 1, gap: 8 }}>
                  <Skeleton width="66%" height={14} />
                  <Skeleton width="50%" height={12} />
                </View>
              </View>
            ))}
          </View>
        )}
        {partial && (
          <View style={{ gap: 8 }}>
            <Copy size={12} muted>
              部分补充数据源暂不可用，下方保留已获取的数据。
            </Copy>
            <Button
              size="sm"
              disabled={metrics.loading}
              onPress={metrics.refresh}
            >
              重试
            </Button>
          </View>
        )}
        {!metrics.loading && !indicators.length && !finite(m?.ytd_vs_sp500) && (
          <Copy size={14} muted>
            数据源暂无可用的关键指标。
          </Copy>
        )}
      </Glass>

      {groups.map((group) => (
        <Glass key={group.title} style={{ padding: 16 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <Copy size={14} muted>
              {group.title}
            </Copy>
            {!!group.note && <Info>{group.note}</Info>}
          </View>
          <View>
            {group.rows.map(([label, value], index) => (
              <View
                key={label}
                style={{
                  flexDirection: "row",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 16,
                  paddingVertical: 12,
                  borderTopWidth: index ? StyleSheet.hairlineWidth : 0,
                  borderColor: t.border,
                }}
              >
                <View style={{ flexShrink: 1 }}>
                  <Copy size={14} muted>
                    {label}
                  </Copy>
                </View>
                <Copy size={14} bold>
                  {value}
                </Copy>
              </View>
            ))}
          </View>
        </Glass>
      ))}

      <Copy size={12} muted>
        {`来源：Yahoo Finance · 行情单位 ${currency}，财务单位 ${financialCurrency}。各指标报告周期可能不同；— 表示暂无数据。分析师预估不代表确定回报。`}
      </Copy>

      <View style={{ gap: 8 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: notesOpen }}
          onPress={() => setNotesOpen((value) => !value)}
          hitSlop={4}
          style={{ alignSelf: "flex-start" }}
        >
          <Copy size={12} muted>
            计算说明与数据周期
          </Copy>
        </Pressable>
        {notesOpen && (
          <View style={{ gap: 12 }}>
            <Copy size={12} muted>
              ROCE = EBIT /（总资产 − 流动负债）；ROIC = 税后 EBIT /
              平均投入资本（债务 + 股东权益 − 现金）；现金转化率 = 经营现金流 /
              净利润；净回购收益率 =（回购 − 增发）/
              总市值，负值表示净增发。无效或非正分母不计算。三年复合增长率要求正基数和约三年的年度报告。
            </Copy>
            <Copy size={12} muted>
              {`现金流财年：${date(m?.cash_period)}。可用价格历史：${date(m?.history_start)} 至 ${date(m?.history_end)}。年初至今对比使用共同交易日：${date(m?.ytd_start)} 至 ${date(m?.ytd_end)}。`}
            </Copy>
          </View>
        )}
      </View>
    </View>
  );
}
