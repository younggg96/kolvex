export const BENCHMARKS = [
  { symbol: "^GSPC", en: "S&P 500", zh: "标普 500" },
  { symbol: "^IXIC", en: "NASDAQ", zh: "纳斯达克" },
  { symbol: "^DJI", en: "Dow Jones", zh: "道琼斯" },
  { symbol: "^RUT", en: "Russell 2000", zh: "罗素 2000" },
  { symbol: "^VIX", en: "VIX", zh: "VIX" },
] as const;

export type MarketInstrument = {
  symbol: string;
  en: string;
  zh: string;
  unit?: "points" | "percent" | "usd";
  daily?: boolean;
  source?: "fred";
  sourceUrl?: string;
  note?: { en: string; zh: string };
};

/** ETF prices represent the sectors; they are not the underlying index levels. */
export const SECTOR_ETFS: readonly MarketInstrument[] = [
  { symbol: "IXP", en: "Communication services", zh: "通讯服务" },
  { symbol: "XLY", en: "Consumer discretionary", zh: "非必需品消费" },
  { symbol: "XLP", en: "Consumer staples", zh: "必需品消费" },
  { symbol: "XLE", en: "Energy", zh: "能源" },
  { symbol: "KBWB", en: "Banks", zh: "银行" },
  { symbol: "XLU", en: "Utilities", zh: "公共事业" },
  { symbol: "IYR", en: "Real estate / REITs", zh: "房地产 / REITs" },
  { symbol: "XLK", en: "Technology", zh: "科技" },
  { symbol: "XLV", en: "Health care", zh: "医疗" },
  { symbol: "ITA", en: "Aerospace & defense", zh: "国防" },
  { symbol: "IAK", en: "Insurance", zh: "保险" },
  { symbol: "SOXX", en: "Semiconductors", zh: "芯片" },
  { symbol: "IGV", en: "Software", zh: "软件" },
];

export const STYLE_ETFS: readonly MarketInstrument[] = [
  { symbol: "IWD", en: "Russell 1000 value", zh: "罗素1000价值" },
  { symbol: "IWF", en: "Russell 1000 growth", zh: "罗素1000成长" },
  { symbol: "MAGS", en: "Magnificent Seven", zh: "前七大科技", note: { en: "Equal-weight ETF", zh: "等权 ETF" } },
  { symbol: "RSP", en: "S&P 500 equal weight", zh: "标普等权指数", note: { en: "ETF proxy", zh: "ETF 走势" } },
  { symbol: "SPHB", en: "High beta", zh: "高贝塔动能", note: { en: "S&P 500 high beta ETF", zh: "标普500高贝塔 ETF" } },
];

export const CROSS_ASSETS: readonly MarketInstrument[] = [
  { symbol: "DX-Y.NYB", en: "US dollar index", zh: "美元指数", unit: "points", sourceUrl: "https://finance.yahoo.com/quote/DX-Y.NYB/" },
  { symbol: "DGS2", en: "2-year Treasury yield", zh: "2年美债收益率", unit: "percent", daily: true, source: "fred", sourceUrl: "https://fred.stlouisfed.org/series/DGS2" },
  { symbol: "DGS10", en: "10-year Treasury yield", zh: "10年美债收益率", unit: "percent", daily: true, source: "fred", sourceUrl: "https://fred.stlouisfed.org/series/DGS10" },
  { symbol: "TLT", en: "20+ year Treasury bonds", zh: "长期美债 TLT" },
  { symbol: "^MOVE", en: "MOVE bond volatility", zh: "MOVE 债券波动率", unit: "points", daily: true, sourceUrl: "https://finance.yahoo.com/quote/%5EMOVE/" },
  { symbol: "BAMLH0A0HYM2", en: "High-yield bond spread", zh: "垃圾债利差", unit: "percent", daily: true, source: "fred", sourceUrl: "https://fred.stlouisfed.org/series/BAMLH0A0HYM2", note: { en: "ICE BofA OAS · FRED", zh: "ICE BofA 期权调整利差 · FRED" } },
  { symbol: "GC=F", en: "Gold futures", zh: "黄金期货", sourceUrl: "https://finance.yahoo.com/quote/GC%3DF/", note: { en: "USD / troy oz", zh: "美元 / 金衡盎司" } },
  { symbol: "CL=F", en: "WTI crude oil futures", zh: "WTI 原油期货", sourceUrl: "https://finance.yahoo.com/quote/CL%3DF/", note: { en: "USD / barrel", zh: "美元 / 桶" } },
  { symbol: "BTC-USD", en: "Bitcoin", zh: "比特币" },
];

export const MARKET_GROUPS = [
  { key: "indices", en: "Market indices", zh: "市场指数", instruments: BENCHMARKS as readonly MarketInstrument[] },
  { key: "sectors", en: "Sector trends", zh: "板块走势", instruments: SECTOR_ETFS },
  { key: "styles", en: "Investment styles", zh: "投资风格", instruments: STYLE_ETFS },
  { key: "cross-assets", en: "Bonds, commodities & currencies", zh: "债券、商品与汇率", instruments: CROSS_ASSETS },
] as const;
export const MARKET_INSTRUMENTS = MARKET_GROUPS.flatMap(group => [...group.instruments]);
export const MARKET_QUOTE_SYMBOLS = MARKET_INSTRUMENTS.filter(item => item.source !== "fred").map(item => item.symbol);

export const isMarketIndex = (symbol: string) =>
  BENCHMARKS.some((benchmark) => benchmark.symbol === symbol);

export const indexValue = (value: number) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
