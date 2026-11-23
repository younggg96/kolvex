"use client";

import { ShieldAlert, ShieldCheck, AlertTriangle, HelpCircle } from "lucide-react";
import { useCopy } from "@/components/decision/shared";
import type { MarketRegime, ScannerStatus } from "@/lib/tradeOsApi";
import { cn } from "@/lib/utils";

type Copy = ReturnType<typeof useCopy>;

/** Market state label, tone and icon (PRD §6.3). Text always accompanies color. */
export function regimeMeta(regime: MarketRegime | null | undefined, c: Copy) {
  switch (regime) {
    case "risk_on":
      return { label: c("Risk On", "进攻"), tone: "positive" as const, Icon: ShieldCheck };
    case "cautious":
      return { label: c("Cautious", "谨慎"), tone: "warning" as const, Icon: AlertTriangle };
    case "risk_off":
      return { label: c("Risk Off", "防守"), tone: "negative" as const, Icon: ShieldAlert };
    default:
      return { label: c("Unknown", "未知"), tone: "muted" as const, Icon: HelpCircle };
  }
}

const TONE_CLASS = {
  positive: "border-positive/30 bg-positive/10 text-positive",
  warning: "border-warning/30 bg-warning/10 text-warning",
  negative: "border-negative/30 bg-negative/10 text-negative",
  muted: "border-foreground/15 bg-muted text-muted-foreground",
};

export function RegimeBadge({
  regime,
  className,
}: {
  regime: MarketRegime | null | undefined;
  className?: string;
}) {
  const c = useCopy();
  const { label, tone, Icon } = regimeMeta(regime, c);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        TONE_CLASS[tone],
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </span>
  );
}

/** Scanner status labels (PRD §7.7). */
export function statusLabel(status: ScannerStatus, c: Copy): string {
  const map: Record<ScannerStatus, string> = {
    INELIGIBLE: c("Filtered out", "未通过筛选"),
    TREND_VALID: c("Trend OK, waiting", "趋势合格，等回调"),
    PULLBACK_ACTIVE: c("Pulling back", "回调中"),
    SIGNAL_CONFIRMED: c("Signal confirmed", "信号确认"),
    ENTRY_PENDING: c("Waiting for entry", "等待触发"),
    TRIGGERED: c("Triggered", "已触发"),
    EXPIRED: c("Expired", "已过期"),
    INVALIDATED: c("Invalidated", "形态失效"),
    BLOCKED: c("Blocked", "被拦截"),
  };
  return map[status] ?? status;
}

export function statusTone(status: ScannerStatus): keyof typeof TONE_CLASS {
  if (status === "SIGNAL_CONFIRMED" || status === "ENTRY_PENDING" || status === "TRIGGERED")
    return "positive";
  if (status === "BLOCKED") return "negative";
  if (status === "PULLBACK_ACTIVE") return "warning";
  return "muted";
}

export function StatusBadge({ status }: { status: ScannerStatus }) {
  const c = useCopy();
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[0.6875rem] font-semibold",
        TONE_CLASS[statusTone(status)],
      )}
    >
      {statusLabel(status, c)}
    </span>
  );
}

/**
 * Plain-language reasons for reject codes, scanner reasons and checks
 * (PRD §12.8: every rejection needs an explanation a user understands).
 */
export function reasonText(code: string | null | undefined, c: Copy): string | null {
  if (!code) return null;
  const map: Record<string, string> = {
    // Risk engine reject codes
    MARKET_RISK_OFF: c(
      "Market is Risk Off: no new long entries.",
      "市场处于防守状态，禁止新开多仓。",
    ),
    STALE_MARKET_DATA: c(
      "Market data is missing or stale, so new entries are paused.",
      "行情数据缺失或过期，暂停新开仓。",
    ),
    DRAWDOWN_LIMIT: c("Account drawdown is over its limit.", "账户回撤超过限制。"),
    WEEKLY_LOSS_LIMIT: c(
      "Down 2% or more this week: no new entries until next week.",
      "本周已亏损 2% 以上，下周前不再开新仓。",
    ),
    MONTHLY_LOSS_LIMIT: c(
      "Down 5% or more this month: no new entries until next month.",
      "本月已亏损 5% 以上，下月前不再开新仓。",
    ),
    CONSECUTIVE_LOSSES: c(
      "3 losing trades in a row: review them before trading again.",
      "已连续亏损 3 笔，复盘后才能继续开仓。",
    ),
    SINGLE_POSITION_LIMIT: c(
      "Size is above the per-trade risk or 10% position limit.",
      "股数超过单笔风险或 10% 单股仓位上限。",
    ),
    SECTOR_EXPOSURE_LIMIT: c(
      "This sector would exceed 20% of the account.",
      "该行业合计仓位会超过账户 20%。",
    ),
    TOTAL_OPEN_RISK_LIMIT: c(
      "Total open risk or position count is already at the limit for this market state.",
      "合计止损风险或持仓数量已达当前市场状态的上限。",
    ),
    INSUFFICIENT_CASH: c("Not enough cash for this size.", "可用现金不足以买入该数量。"),
    INVALID_STOP: c("Stop must be 2.5%–10% below entry.", "止损必须在入场价下方 2.5%–10% 之间。"),
    EARNINGS_BLACKOUT: c("Earnings within the next 5 trading days.", "未来 5 个交易日内有财报。"),
    EVENT_DATA_UNAVAILABLE: c(
      "Next earnings date can't be confirmed, so the signal isn't treated as safe.",
      "无法确认下一次财报日期，不按无风险处理。",
    ),
    DUPLICATE_POSITION: c("You already hold or plan this symbol.", "该股票已有持仓或待执行计划。"),
    LEVERAGED_PRODUCT: c("Leveraged or inverse fund: not traded.", "杠杆或反向产品，不交易。"),
    DAILY_LOSS_LIMIT: c("Daily loss limit reached.", "已触及单日亏损上限。"),
    // Scanner filter reasons
    INSUFFICIENT_DATA: c("Less than 200 days of price history.", "历史行情不足 200 个交易日。"),
    LIQUIDITY_FILTER: c(
      "Under $10 or under $20M average daily dollar volume.",
      "股价低于 $10 或日均成交额低于 2000 万美元。",
    ),
    TREND_FILTER: c(
      "Trend filter failed (EMA20 > SMA50 > SMA200, close > SMA50).",
      "趋势不合格（需 EMA20 > SMA50 > SMA200 且收盘 > SMA50）。",
    ),
    RS_DATA_UNAVAILABLE: c(
      "SPY data missing, relative strength unknown.",
      "缺少 SPY 数据，无法计算相对强度。",
    ),
    RS20_NOT_POSITIVE: c("Weaker than SPY over 20 days.", "近 20 日弱于 SPY。"),
    DATA_FETCH_FAILED: c("Price data could not be loaded.", "行情数据加载失败。"),
    // Setup state reasons
    CLOSE_BELOW_SMA50: c("Closed below SMA50 during the pullback.", "回调期间收盘跌破 SMA50。"),
    PULLBACK_TOO_DEEP: c("Pullback deeper than 10%.", "回调深度超过 10%。"),
    PULLBACK_WINDOW_PASSED: c(
      "No confirmation within 10 days of the high.",
      "高点后 10 天内未出现确认 K 线。",
    ),
    ENTRY_WINDOW_PASSED: c("Entry not triggered within 2 days.", "信号后 2 个交易日内未触发入场。"),
    GAP_ABOVE_ENTRY: c(
      "Opened more than 0.5R above entry: skipped.",
      "开盘跳空超过入场价 0.5R，放弃。",
    ),
    STOP_TOUCHED_BEFORE_ENTRY: c("Hit the stop before triggering.", "触发前先触及止损。"),
    STOP_AND_ENTRY_SAME_BAR: c(
      "Entry and stop on the same day: treated as a loss.",
      "同一天触及入场和止损，按不利情况处理。",
    ),
    INSUFFICIENT_INDICATOR_HISTORY: c("Not enough history for indicators.", "指标所需历史不足。"),
    MAX_POSITIONS: c("Already at the max number of positions.", "持仓数已满。"),
    INVALID_STOP_AFTER_GAP: c(
      "After the gap the stop was outside 2.5%–10%.",
      "跳空后止损距离不在 2.5%–10% 之间。",
    ),
    SIZE_BELOW_ONE_SHARE: c("Limits allowed less than one share.", "各项上限下连 1 股都买不了。"),
    NOT_TRIGGERED: c("Entry never triggered.", "未触发入场。"),
    ENTRY_TRIGGERED: c("Price reached the entry trigger.", "价格已触及入场价。"),
  };
  return map[code] ?? code;
}

/** One-line version for dense lists; reasonText() holds the full sentence for tooltips. */
export function reasonShort(code: string | null | undefined, c: Copy): string | null {
  if (!code) return null;
  const short: Record<string, string> = {
    LIQUIDITY_FILTER: c("Low liquidity", "流动性不足"),
    TREND_FILTER: c("Trend not valid", "趋势不合格"),
    RS20_NOT_POSITIVE: c("Weaker than SPY", "弱于 SPY"),
    RS_DATA_UNAVAILABLE: c("No SPY data", "缺少 SPY 数据"),
    INSUFFICIENT_DATA: c("Under 200 days of history", "历史不足 200 天"),
    DATA_FETCH_FAILED: c("Price data failed", "行情加载失败"),
    MARKET_RISK_OFF: c("Market Risk Off", "市场防守"),
    STALE_MARKET_DATA: c("Market data stale", "市场数据过期"),
    EARNINGS_BLACKOUT: c("Earnings soon", "财报临近"),
    LEVERAGED_PRODUCT: c("Leveraged / inverse", "杠杆 / 反向产品"),
    EVENT_DATA_UNAVAILABLE: c("Earnings date unknown", "财报日期未知"),
  };
  return short[code] ?? reasonText(code, c);
}

/** "+2.00R" style (PRD §18.3). */
export function formatR(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(2)}R`;
}
