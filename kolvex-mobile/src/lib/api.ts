import type { Bar, Dashboard, Quote } from "./models";

export const apiURL = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(
  /\/$/,
  "",
);
export const demoMode = !apiURL;
// Deliberately static design fixtures. Never used as fallback for failed live requests.
const fixtures: Record<string, [string, number, number]> = {
  SPY: ["标普 500 ETF", 573.76, 0.82],
  QQQ: ["纳斯达克 100 ETF", 488.03, 1.24],
  DIA: ["道琼斯 ETF", 423.28, -0.16],
  NVDA: ["英伟达", 138.07, 2.34],
  AAPL: ["苹果", 231.41, 0.46],
  MSFT: ["微软", 428.76, 1.12],
  TSLA: ["特斯拉", 248.5, -1.87],
  GOOGL: ["Alphabet", 171.11, 0.73],
  AMZN: ["亚马逊", 188.82, -0.32],
};
async function request<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`${apiURL}${path}`, { signal });
  if (!response.ok)
    throw new Error(
      response.status === 401
        ? "此内容需要登录，当前版本仅支持公开阅读。"
        : `数据暂时无法加载（${response.status}），请重试。`,
    );
  return response.json();
}
export async function quote(
  symbol: string,
  signal: AbortSignal,
): Promise<Quote> {
  if (!demoMode) {
    const result = await request<Quote>(
      `/market/quote/${encodeURIComponent(symbol)}`,
      signal,
    );
    if (
      result.symbol !== symbol ||
      (result.current_price != null && !Number.isFinite(result.current_price))
    )
      throw new Error("报价格式无效，请稍后重试。");
    return result;
  }
  const item = fixtures[symbol];
  if (!item) throw new Error("演示数据中没有这只股票，请配置 API 后查询。");
  const [name, price, change] = item;
  return {
    symbol,
    name,
    current_price: price,
    change_percent: change,
    change: (price * change) / (100 + change),
  };
}
export async function history(
  symbol: string,
  period: string,
  signal: AbortSignal,
): Promise<Bar[]> {
  if (!demoMode) {
    const result = await request<{ data: Bar[] }>(
      `/market/history/${encodeURIComponent(symbol)}?period=${period}&interval=1d`,
      signal,
    );
    if (!Array.isArray(result.data)) throw new Error("历史行情格式无效。");
    return result.data.filter(
      (bar) =>
        typeof bar.date === "string" &&
        typeof bar.close === "number" &&
        Number.isFinite(bar.close),
    );
  }
  const price = fixtures[symbol]?.[1];
  if (!price) return [];
  return Array.from(
    { length: period === "1mo" ? 22 : period === "3mo" ? 65 : 252 },
    (_, i) => ({
      date: new Date(Date.UTC(2024, 0, i + 1)).toISOString().slice(0, 10),
      close:
        price *
        (0.86 +
          i * 0.0005 +
          Math.sin(i * 1.3) * 0.012 +
          Math.cos(i * 0.3) * 0.025),
    }),
  );
}
export async function opinions(signal: AbortSignal): Promise<Dashboard> {
  // No fabricated creator identities or attributed investment opinions.
  if (demoMode) return { latest: [] };
  const result = await request<Dashboard>(
    "/youtube-opinions/dashboard?limit=30",
    signal,
  );
  if (!Array.isArray(result.latest)) throw new Error("观点数据格式无效。");
  return result;
}
