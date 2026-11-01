"use client";

import { ContentSkeleton } from "@/components/ui/content-skeleton";
import { ArrowDownRight, ArrowUpRight, ExternalLink } from "lucide-react";
import type { StockOverview, StockQuote } from "@/lib/stockApi";
import {
  finite,
  fundamentalsKey,
  loadFundamentals,
  overviewRatio,
  type StockOverviewMetrics,
} from "@/lib/stockFundamentals";
import { useCachedResource } from "@/hooks/useCachedResource";
import { Button } from "@/components/ui/button";
import { FinancialState, useFinancialFormat } from "./StockFinancialData";
import { useCopy } from "./shared";

export default function StockFundamentalOverview({
  symbol,
  overview,
  quote,
  loading,
  error,
  retry,
}: {
  symbol: string;
  overview?: StockOverview;
  quote: StockQuote | null;
  loading: boolean;
  error: boolean;
  retry: () => void;
}) {
  const c = useCopy();
  const f = useFinancialFormat();
  const key = fundamentalsKey(symbol, "overview-metrics");
  const extra = useCachedResource(
    key,
    (signal) => loadFundamentals<StockOverviewMetrics>(key, signal),
    { ttl: 300_000, timeout: 22_000 },
  );
  const m = extra.data;
  const v = overview?.financials;
  const q = overview?.quote;
  const currency = q?.currency || m?.currency || "USD";
  const financialCurrency =
    v?.financial_currency || m?.financial_currency || currency;
  const date = (value?: string | null) => (value ? f.date(value) : "—");
  const annual = c("Latest fiscal year", "最新财年");
  const consensus = {
    strong_buy: c("Strong buy", "强烈买入"),
    buy: c("Buy", "买入"),
    hold: c("Hold", "持有"),
    underperform: c("Underperform", "弱于大盘"),
    sell: c("Sell", "卖出"),
    strong_sell: c("Strong sell", "强烈卖出"),
    none: "—",
  };
  const groups = [
    {
      title: c("Basic", "基本信息"),
      note: c("Market values and analyst estimates", "行情数据与分析师预估"),
      rows: [
        [
          c("Market cap", "总市值"),
          f.number(q?.market_cap ?? quote?.marketCap),
        ],
        [c("Enterprise value", "企业价值"), f.number(v?.enterprise_value)],
        [
          c("Shares outstanding", "流通在外股数"),
          f.number(m?.shares_outstanding),
        ],
        [
          c("Insider ownership", "内部人士持股比例"),
          f.percent(m?.insider_ownership),
        ],
        [c("Short float", "流通股做空比例"), f.percent(m?.short_float)],
        [
          c("Analyst mean target", "分析师平均目标价"),
          finite(m?.target_mean_price)
            ? `${f.number(m.target_mean_price, false)} ${m?.target_currency || currency}`
            : "—",
        ],
        [
          c("Analyst consensus", "分析师共识"),
          consensus[m?.analyst_consensus as keyof typeof consensus] || "—",
        ],
        [
          c("Analyst coverage", "覆盖分析师人数"),
          f.number(m?.analyst_count, false),
        ],
        [
          c("Source earnings date", "数据源财报日期"),
          finite(m?.earnings_date)
            ? f.date(new Date(m.earnings_date * 1000).toISOString())
            : "—",
        ],
        [c("Employees", "员工人数"), f.number(overview?.company.employees)],
        [
          c("52 week range", "52 周区间"),
          `${f.number(q?.fifty_two_week_low ?? quote?.week52Low)} – ${f.number(q?.fifty_two_week_high ?? quote?.week52High)}`,
        ],
        [c("Volume", "成交量"), f.number(q?.volume ?? quote?.volume)],
      ],
    },
    {
      title: c("Revenue & profit", "收入与利润"),
      note: c(
        `Source TTM; operating income: FY ${date(m?.income_period)}`,
        `数据源 TTM；营业利润：财年 ${date(m?.income_period)}`,
      ),
      rows: [
        [c("Revenue", "营业收入"), f.number(v?.total_revenue)],
        [c("Gross profit", "毛利润"), f.number(v?.gross_profits)],
        [
          c("Operating income (FY)", "营业利润（财年）"),
          f.number(m?.operating_income),
        ],
        [c("Net income", "净利润"), f.number(v?.net_income)],
        [c("EBITDA", "息税折旧摊销前利润"), f.number(v?.ebitda)],
        [c("Trailing EPS", "滚动每股收益"), f.number(v?.eps_trailing, false)],
        [c("Forward EPS", "预期每股收益"), f.number(v?.eps_forward, false)],
        [
          c("Operating cash flow", "经营现金流"),
          f.number(v?.operating_cash_flow),
        ],
        [c("Free cash flow", "自由现金流"), f.number(v?.free_cash_flow)],
        [c("CapEx (FY)", "资本支出（财年）"), f.number(m?.capital_expenditure)],
      ],
    },
    {
      title: c("Assets & liabilities", "资产与负债"),
      note: c(
        `Latest balance sheet: ${date(m?.balance_period)}; cash/debt follow source`,
        `最新资产负债表：${date(m?.balance_period)}；现金与总债务以数据源为准`,
      ),
      rows: [
        [c("Total assets", "总资产"), f.number(m?.total_assets)],
        [c("Total cash", "现金总额"), f.number(v?.total_cash)],
        [c("Total debt", "总债务"), f.number(v?.total_debt)],
        [c("Long term debt", "长期债务"), f.number(m?.long_term_debt)],
        [c("Total liabilities", "总负债"), f.number(m?.total_liabilities)],
        [
          c("Shareholders’ equity", "股东权益"),
          f.number(m?.shareholder_equity),
        ],
        [
          c("Debt / equity", "债务权益比"),
          f.percent(finite(v?.debt_to_equity) ? v.debt_to_equity / 100 : null),
        ],
        [c("Current ratio", "流动比率"), f.number(v?.current_ratio, false)],
        [c("Quick ratio", "速动比率"), f.number(v?.quick_ratio, false)],
      ],
    },
    {
      title: c("Valuation", "估值"),
      note: c(
        "Source ratios; price / FCF uses TTM cash flow",
        "数据源比率；市现率使用 TTM 自由现金流",
      ),
      rows: [
        [c("Trailing P/E", "滚动市盈率"), f.number(v?.pe_ratio, false)],
        [c("Forward P/E", "预期市盈率"), f.number(v?.forward_pe, false)],
        [c("Price / sales", "市销率"), f.number(v?.price_to_sales, false)],
        [c("Price / book", "市净率"), f.number(v?.price_to_book, false)],
        [
          c("Price / FCF", "市值 / 自由现金流"),
          f.number(m?.price_to_fcf, false),
        ],
        [
          c("EV / EBITDA", "企业价值 / EBITDA"),
          f.number(v?.ev_to_ebitda, false),
        ],
        [
          c("EV / revenue", "企业价值 / 营收"),
          f.number(v?.ev_to_revenue, false),
        ],
        [
          c("Cash / debt", "现金 / 债务"),
          f.number(overviewRatio(v?.total_cash, v?.total_debt), false),
        ],
      ],
    },
    {
      title: c("Margins", "利润率"),
      note: c(
        `Source periods; FY metrics: ${date(m?.income_period)}`,
        `数据源报告周期；财年指标：${date(m?.income_period)}`,
      ),
      rows: [
        [c("Gross margin", "毛利率"), f.percent(v?.gross_margins)],
        [c("Operating margin", "营业利润率"), f.percent(v?.operating_margins)],
        [c("EBITDA margin", "EBITDA 利润率"), f.percent(v?.ebitda_margins)],
        [
          c("Pretax margin (FY)", "税前利润率（财年）"),
          f.percent(m?.pretax_margin),
        ],
        [c("Net margin", "净利率"), f.percent(v?.profit_margins)],
        [
          c("FCF margin (FY)", "自由现金流率（财年）"),
          f.percent(m?.fcf_margin_annual),
        ],
      ],
    },
    {
      title: c("Returns", "资本回报"),
      note: `${annual}：${date(m?.income_period)} · ${c("ROA/ROE follow source", "ROA/ROE 以数据源为准")}`,
      rows: [
        [
          c("Return on equity (ROE)", "净资产收益率（ROE）"),
          f.percent(v?.return_on_equity),
        ],
        [
          c("Return on assets (ROA)", "总资产收益率（ROA）"),
          f.percent(v?.return_on_assets),
        ],
        [
          c("Capital employed return (FY)", "资本使用回报率（财年）"),
          f.percent(m?.roce_annual),
        ],
        [
          c("Invested capital return (FY)", "投入资本回报率（财年）"),
          f.percent(m?.roic_annual),
        ],
        [
          c(
            "Cash conversion (CFO / income, FY)",
            "现金转化率（经营现金流 / 净利润，财年）",
          ),
          f.number(m?.cash_conversion_annual, false),
        ],
      ],
    },
    {
      title: c("Growth", "增长"),
      note: c(
        "3 year figures are annualized; estimates are next fiscal year",
        "三年指标为年复合增长率；预估对应下一财年",
      ),
      rows: [
        [
          c("Revenue growth (YoY)", "营收同比增长"),
          f.percent(v?.revenue_growth),
        ],
        [
          c("Revenue CAGR (3Y)", "营收三年复合增长"),
          f.percent(m?.revenue_cagr_3y),
        ],
        [
          c("Quarterly earnings (YoY)", "季度净利润同比增长"),
          f.percent(v?.quarterly_earnings_growth),
        ],
        [
          c("Earnings growth (YoY)", "盈利同比增长"),
          f.percent(v?.earnings_growth),
        ],
        [
          c("Diluted EPS CAGR (3Y)", "稀释 EPS 三年复合增长"),
          f.percent(m?.eps_cagr_3y),
        ],
        [
          c("EPS growth estimate (next FY)", "下一财年 EPS 增长预估"),
          f.percent(m?.forecast_earnings_growth),
        ],
      ],
    },
    {
      title: c("Dividends & buybacks", "分红与回购"),
      note: c(
        `Yield: annual dividend / price; buybacks: FY ${date(m?.cash_period)}`,
        `股息率：年度股息 / 股价；回购：财年 ${date(m?.cash_period)}`,
      ),
      rows: [
        [c("Dividend yield", "股息率"), f.percent(m?.dividend_yield)],
        [c("Payout ratio", "股息支付率"), f.percent(m?.payout_ratio)],
        [
          c("Net buyback yield (FY)", "净回购收益率（财年）"),
          f.percent(m?.buyback_yield_annual),
        ],
      ],
    },
    {
      title: c("Risk & performance", "风险与表现"),
      note: c(
        "YTD excludes dividends; drawdown includes dividend adjustments",
        "年回报不含股息；回撤使用含股息调整的近五年内历史",
      ),
      rows: [
        [
          c("Beta (5Y monthly, source)", "Beta（数据源五年月度）"),
          f.number(m?.beta_5y, false),
        ],
        [
          c("Max drawdown (within 5Y)", "最大回撤（近五年内）"),
          f.percent(m?.max_drawdown_5y),
        ],
        [c("YTD price return", "年初至今价格回报"), f.percent(m?.ytd_return)],
        [
          c("S&P 500 YTD price return", "标普 500 年初至今价格回报"),
          f.percent(m?.benchmark_ytd_return),
        ],
        [
          c("YTD vs S&P 500 (pp)", "相对标普 500（百分点）"),
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
    {
      label: c("Revenue growth (YoY)", "营收同比增长"),
      value: v?.revenue_growth,
      directional: true,
    },
    {
      label: c("Earnings growth (YoY)", "盈利同比增长"),
      value: v?.earnings_growth,
      directional: true,
    },
    {
      label: c(
        "Analyst mean target vs source price",
        "分析师平均目标价相对数据源股价",
      ),
      value: targetUpside === null ? null : targetUpside - 1,
      directional: false,
    },
    {
      label: c("EPS growth estimate (next FY)", "下一财年 EPS 增长预估"),
      value: m?.forecast_earnings_growth,
      directional: true,
    },
    {
      label: c("Forward P/E vs trailing P/E", "预期市盈率相对滚动市盈率"),
      value: peRatio === null ? null : peRatio - 1,
      directional: false,
    },
  ].filter((item) => finite(item.value));
  const partial = Boolean(extra.error || m?.unavailable_sources.length);
  if (loading && !overview)
    return <FinancialState loading error={false} empty={false} retry={retry} />;
  return (
    <div className="space-y-4">
      <FinancialState
        loading={false}
        error={error}
        empty={false}
        retry={retry}
      />
      <section className="rounded-3xl border border-border bg-card p-4 sm:p-6">
        <h2 className="text-sm font-medium text-muted-foreground">
          {c("Key indicators", "关键指标")}
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {indicators.map((item) => (
            <p key={item.label} className="flex items-start gap-3 text-sm">
              {item.value! >= 0 ? (
                <ArrowUpRight
                  aria-hidden="true"
                  className={`mt-1 h-4 w-4 shrink-0 ${item.directional ? "text-positive" : "text-muted-foreground"}`}
                />
              ) : (
                <ArrowDownRight
                  aria-hidden="true"
                  className={`mt-1 h-4 w-4 shrink-0 ${item.directional ? "text-negative" : "text-muted-foreground"}`}
                />
              )}
              <span>
                {item.label}{" "}
                <strong className="figure font-semibold">
                  {f.percent(item.value)}
                </strong>
              </span>
            </p>
          ))}
          {finite(m?.ytd_vs_sp500) && (
            <p className="text-sm">
              {m.ytd_vs_sp500 >= 0
                ? c("Outperforming S&P 500 YTD by", "年初至今跑赢标普 500")
                : c(
                    "Underperforming S&P 500 YTD by",
                    "年初至今跑输标普 500",
                  )}{" "}
              <strong
                className={`figure font-semibold ${m.ytd_vs_sp500 >= 0 ? "text-positive" : "text-negative"}`}
              >
                {f.number(Math.abs(m.ytd_vs_sp500) * 100, false)}
              </strong>{" "}
              {c("percentage points", "个百分点")}
            </p>
          )}
        </div>
        {m?.analyzed_at && (
          <p className="mt-4 text-xs text-muted-foreground">
            {c("Metrics fetched at", "指标获取时间")}{" "}
            <time dateTime={m.analyzed_at}>
              {m.analyzed_at.slice(0, 16).replace("T", " ")} UTC
            </time>
          </p>
        )}
        {extra.loading && (
          <ContentSkeleton label={c("Loading additional metrics…", "正在加载补充指标…")} variant="text" rows={2} className="mt-4" />
        )}
        {partial && (
          <div
            role="status"
            className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground"
          >
            <span>
              {c(
                "Some additional sources are unavailable. Available data is shown below.",
                "部分补充数据源暂不可用，下方保留已获取的数据。",
              )}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={extra.refreshing}
              onClick={extra.refresh}
            >
              {c("Retry", "重试")}
            </Button>
          </div>
        )}
        {!extra.loading && !indicators.length && !finite(m?.ytd_vs_sp500) && (
          <p className="mt-4 text-sm text-muted-foreground">
            {c(
              "No key indicators are available from the source.",
              "数据源暂无可用的关键指标。",
            )}
          </p>
        )}
      </section>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((group) => (
          <section
            key={group.title}
            className="min-w-0 rounded-3xl border border-border bg-card p-4 sm:p-6"
          >
            <h2 className="text-sm font-medium text-muted-foreground">
              {group.title}
            </h2>
            <p className="mb-3 mt-2 text-xs leading-5 text-muted-foreground">
              {group.note}
            </p>
            <dl className="divide-y divide-border">
              {group.rows.map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-baseline justify-between gap-4 py-3 text-sm"
                >
                  <dt className="min-w-0 text-muted-foreground">{label}</dt>
                  <dd className="figure shrink-0 text-right font-medium">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        {c(
          `Source: Yahoo Finance · Market values in ${currency}; financials in ${financialCurrency}. Reporting periods vary by metric; — means unavailable. Analyst estimates are not guaranteed returns.`,
          `来源：Yahoo Finance · 行情单位 ${currency}，财务单位 ${financialCurrency}。各指标报告周期可能不同；— 表示暂无数据。分析师预估不代表确定回报。`,
        )}
      </p>
      <details className="text-xs leading-5 text-muted-foreground">
        <summary className="cursor-pointer rounded focus-visible:outline-none ">
          {c("Calculation notes & periods", "计算说明与数据周期")}
        </summary>
        <p className="mt-3">
          {c(
            "ROCE = EBIT / (assets − current liabilities). ROIC = after-tax EBIT / average invested capital (debt + equity − cash). Cash conversion = operating cash flow / net income. Net buyback yield = (repurchases − issuance) / market cap; negative means net issuance. Invalid or nonpositive denominators are omitted. Three year CAGR requires positive endpoints and roughly three years of annual reports.",
            "ROCE = EBIT /（总资产 − 流动负债）；ROIC = 税后 EBIT / 平均投入资本（债务 + 股东权益 − 现金）；现金转化率 = 经营现金流 / 净利润；净回购收益率 =（回购 − 增发）/ 总市值，负值表示净增发。无效或非正分母不计算。三年复合增长率要求正基数和约三年的年度报告。",
          )}
        </p>
        <p className="mt-3">
          {c(
            `Cash flow fiscal year: ${date(m?.cash_period)}. Available price history: ${date(m?.history_start)} – ${date(m?.history_end)}. YTD comparison uses shared trading dates: ${date(m?.ytd_start)} – ${date(m?.ytd_end)}.`,
            `现金流财年：${date(m?.cash_period)}。可用价格历史：${date(m?.history_start)} 至 ${date(m?.history_end)}。年初至今对比使用共同交易日：${date(m?.ytd_start)} 至 ${date(m?.ytd_end)}。`,
          )}
        </p>
      </details>
    </div>
  );
}

export function StockCompanyProfile({
  overview,
  loading,
  error,
  retry,
}: {
  overview?: StockOverview;
  loading: boolean;
  error: boolean;
  retry: () => void;
}) {
  const c = useCopy();
  const f = useFinancialFormat();
  const company = overview?.company;
  let website: string | null = null;
  try {
    const url = new URL(company?.website || "");
    if (["https:", "http:"].includes(url.protocol)) website = url.href;
  } catch {
    /* Missing or invalid source URL. */
  }
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">
        {c("Company profile", "公司资料")}
      </h2>
      <FinancialState
        loading={loading}
        error={error}
        empty={!loading && !error && !company}
        retry={retry}
      />
      {company && (
        <>
          <dl className="grid grid-cols-2 gap-6 rounded-3xl border border-border bg-card p-6 lg:grid-cols-4">
            {[
              [c("Sector", "行业板块"), company.sector],
              [c("Industry", "细分行业"), company.industry],
              [c("Country", "国家"), company.country],
              [c("Employees", "员工人数"), f.number(company.employees, false)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-2 text-sm font-medium">{value || "—"}</dd>
              </div>
            ))}
          </dl>
          {company.business_summary && (
            <p className="w-full max-w-none break-words text-sm leading-7 text-muted-foreground">
              {company.business_summary}
            </p>
          )}
          {website && (
            <a
              href={website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-sm underline underline-offset-4 focus-visible:outline-none "
            >
              {c("Company website", "公司官网")}{" "}
              <ExternalLink
                aria-hidden="true"
                className="ml-1 inline h-3 w-3"
              />
            </a>
          )}
        </>
      )}
    </div>
  );
}
