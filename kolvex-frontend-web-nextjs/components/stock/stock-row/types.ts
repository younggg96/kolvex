import type { MouseEvent } from "react";

// ============================================================
// Types
// ============================================================

/** 统一的 TopAuthor 类型 - 兼容两种 API 格式 */
export interface StockRowAuthor {
  platform?: string;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  tweetCount: number;
  sentiment?: string | null;
}

/** StockRow 组件的变体模式 */
export type StockRowVariant = "trending" | "tracking";

/** StockRow Props */
export interface StockRowProps {
  /** 变体模式: trending (发现) | tracking (已追踪) */
  variant: StockRowVariant;

  // === 通用字段 ===
  /** 股票代码 */
  ticker: string;
  /** 公司名称 */
  companyName?: string;
  /** KOL 作者列表 */
  topAuthors?: StockRowAuthor[];

  // === Trending 模式字段 ===
  /** 提及次数 */
  mentionCount?: number;
  /** 独立作者数 */
  uniqueAuthors?: number;
  /** 情感分数 (-100 ~ 100) */
  sentimentScore?: number;
  /** 热度分数 */
  trendingScore?: number;
  /** 是否已添加到追踪列表 */
  isTracked?: boolean;
  /** 追踪记录的 ID（用于取消追踪） */
  stockId?: string;
  /** 追踪/取消追踪后的回调 */
  onTrackChange?: (tracked: boolean, stockId?: string) => void;

  // === Tracking 模式字段 ===
  /** 当前价格 */
  price?: number;
  /** 涨跌幅百分比 */
  changePercent?: number;
  /** Sparkline 数据 */
  sparklineData?: number[];
  /** 是否正在取消追踪 */
  isUntracking?: boolean;
  /** 取消追踪回调 */
  onUntrack?: (e: MouseEvent) => void;
}
