export const BENCHMARKS = [
  { symbol: "^GSPC", en: "S&P 500", zh: "标普 500" },
  { symbol: "^IXIC", en: "NASDAQ", zh: "纳斯达克" },
  { symbol: "^DJI", en: "Dow Jones", zh: "道琼斯" },
  { symbol: "^RUT", en: "Russell 2000", zh: "罗素 2000" },
  { symbol: "^VIX", en: "VIX", zh: "VIX" },
] as const;

export const isMarketIndex = (symbol: string) =>
  BENCHMARKS.some((benchmark) => benchmark.symbol === symbol);

export const indexValue = (value: number) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
