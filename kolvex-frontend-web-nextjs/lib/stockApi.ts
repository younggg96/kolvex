// Stock API types and utilities

export interface StockQuote {
  symbol: string;
  name?: string;
  price: number;
  change: number;
  changePercent: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
  previousClose?: number;
  marketCap?: number;
  peRatio?: number;
  eps?: number;
  dividend?: number;
  dividendYield?: number;
  updatedAt?: string;
}

export interface MarketIndex {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  updatedAt?: string;
}

export interface ChartData {
  time: string;
  value: number;
  volume?: number;
}

export interface ChartDataPoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Format price for display
 */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

/**
 * Format change percent for display
 */
export function formatChangePercent(percent: number): string {
  const sign = percent >= 0 ? "+" : "";
  return `${sign}${percent.toFixed(2)}%`;
}

/**
 * Get color class based on change
 */
export function getChangeColor(change: number): string {
  if (change > 0) return "text-green-500";
  if (change < 0) return "text-red-500";
  return "text-gray-500";
}

/**
 * Format volume for display
 */
export function formatVolume(volume: number): string {
  if (volume >= 1e9) {
    return (volume / 1e9).toFixed(2) + "B";
  }
  if (volume >= 1e6) {
    return (volume / 1e6).toFixed(2) + "M";
  }
  if (volume >= 1e3) {
    return (volume / 1e3).toFixed(2) + "K";
  }
  return volume.toString();
}

/**
 * Format market cap for display
 */
export function formatMarketCap(marketCap: number): string {
  if (marketCap >= 1e12) {
    return "$" + (marketCap / 1e12).toFixed(2) + "T";
  }
  if (marketCap >= 1e9) {
    return "$" + (marketCap / 1e9).toFixed(2) + "B";
  }
  if (marketCap >= 1e6) {
    return "$" + (marketCap / 1e6).toFixed(2) + "M";
  }
  return "$" + marketCap.toFixed(0);
}

