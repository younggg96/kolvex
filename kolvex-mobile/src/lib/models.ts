export type Quote = {
  symbol: string;
  name?: string;
  currency?: string | null;
  current_price: number | null;
  change: number | null;
  change_percent: number | null;
  open?: number | null;
  day_high?: number | null;
  day_low?: number | null;
  volume?: number | null;
};
export type Bar = { date: string; close: number | null };
export type Opinion = {
  id: string;
  ticker: string;
  channel_title?: string;
  summary?: string;
  thesis?: string;
  sentiment: "bullish" | "bearish" | "neutral" | "mixed";
  opinion_date: string;
  video_url?: string;
};
export type Dashboard = {
  latest: Opinion[];
  pagination?: {
    total: number;
    has_more: boolean;
    offset: number;
    limit: number;
  };
};
export const symbols = ["NVDA", "AAPL", "MSFT", "TSLA", "GOOGL", "AMZN"];
export const companyNames: Record<string, string> = {
  NVDA: "英伟达 Nvidia",
  AAPL: "苹果 Apple",
  MSFT: "微软 Microsoft",
  TSLA: "特斯拉 Tesla",
  GOOGL: "谷歌 Alphabet",
  AMZN: "亚马逊 Amazon",
};
export const benchmarks = ["SPY", "QQQ", "DIA"];
export function isSymbol(value: string) {
  return /^[A-Z^][A-Z0-9.^=\-]{0,19}$/.test(value);
}
export function number(value: number | null | undefined, digits = 2) {
  return value == null || !Number.isFinite(value)
    ? "—"
    : value.toLocaleString("zh-CN", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });
}
export function percent(value: number | null | undefined) {
  return value == null || !Number.isFinite(value)
    ? "—"
    : `${value > 0 ? "+" : ""}${number(value)}%`;
}
