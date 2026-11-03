import { PaperApiError } from "./paperTrading";

const errorMessages: Record<string, [string, string]> = {
  paper_backend_outdated: [
    "The backend has not loaded paper trading yet. Restart or update the backend, then retry.",
    "后端尚未加载虚拟交易接口，请重启或更新后端后重试。",
  ],
  invalid_order: [
    "Order validation failed. Check the values and try again.",
    "订单校验未通过，请检查填写的数值后重试。",
  ],
  unauthorized: [
    "Sign in again to access your virtual account.",
    "登录已过期，请重新登录后访问虚拟账户。",
  ],
  paper_storage_unavailable: [
    "Virtual account storage is unavailable. Apply the paper trading migration and check backend configuration.",
    "虚拟账户存储暂不可用，请检查后端配置并应用虚拟交易数据库迁移。",
  ],
  insufficient_funds: [
    "Insufficient available funds, including collateral, fees and slippage.",
    "可用资金不足以覆盖本金、抵押、费用与滑点。",
  ],
  market_closed_or_stale: [
    "Market is closed or the quote is stale. Refresh during regular hours, or place a pending order.",
    "当前休市或报价过期。请在常规交易时段刷新，或使用挂单。",
  ],
  quote_unavailable: [
    "Quote unavailable. Check the symbol and refresh.",
    "暂时无法获取行情，请检查股票代码并刷新。",
  ],
  quote_time_unavailable: [
    "Quote timestamp is missing. This symbol cannot be traded until a timestamp is available.",
    "行情缺少时间戳，暂时不能交易此股票。",
  ],
  unsupported_security: [
    "Only USD stocks and ETFs are supported.",
    "目前仅支持美元股票和 ETF。",
  ],
  account_conflict: [
    "Your account changed in another session. Retry the same action.",
    "账户已被其他会话更新，请重试同一操作。",
  ],
  quantity_reserved: [
    "Shares are reserved by pending close orders. Cancel those orders first.",
    "股数已被平仓挂单冻结，请先撤销相关挂单。",
  ],
  position_unavailable: [
    "Position is no longer available. Refresh the account.",
    "该持仓已发生变化或已关闭，请刷新账户。",
  ],
  position_still_open: [
    "Fully close the position before publishing its review.",
    "请完全平仓后再发布复盘。",
  ],
  order_not_pending: [
    "Order has already filled or been cancelled. Refresh the account.",
    "订单已经成交或撤销，请刷新账户。",
  ],
  invalid_stop_loss: [
    "Stop loss is on the wrong side of the reference price.",
    "止损价必须位于参考价格的亏损方向。",
  ],
  invalid_take_profit: [
    "Take profit is on the wrong side of the reference price.",
    "止盈价必须位于参考价格的盈利方向。",
  ],
  bracket_crossed: [
    "Price has moved beyond your bracket. Review stop loss and take profit.",
    "价格已越过止损或止盈价，请重新检查计划。",
  ],
  account_capacity: [
    "This account has reached the simulation capacity. Existing positions can still be closed.",
    "账户已达到模拟容量上限，请先管理现有持仓。",
  ],
  invalid_number: ["Enter valid positive prices.", "请输入有效的正数价格。"],
};

export function paperErrorCopy(
  value: unknown,
  context: "read" | "order" = "read",
): [string, string] {
  const code = value instanceof PaperApiError ? value.code : "";
  return (
    errorMessages[code] ??
    (context === "order"
      ? [
          "Request failed. Check your connection and retry the same action. An order may already have been accepted.",
          "请求失败。请检查网络并重试同一操作，订单可能已经被接收。",
        ]
      : [
          "Could not load data. Check your connection and try again.",
          "暂时无法加载数据，请检查网络后重试。",
        ])
  );
}
