import type { Account } from "./paperTrading";

/** Only this symbol's private lots and executions, never account-wide P&L. */
export function stockPaperTrading(account: Account, symbol: string) {
  const ticker = symbol.trim().toUpperCase();
  const positions = account.state.positions.filter((p) => p.symbol === ticker);
  const orders = account.state.orders.filter(
    (o) => o.symbol === ticker && o.status === "pending",
  );
  const fills = account.state.fills
    .filter((f) => f.symbol === ticker)
    .slice()
    .reverse();
  const mark = account.state.marks[ticker];
  const positionPnl = (p: (typeof positions)[number]) =>
    (Number(mark?.price ?? p.entry_price) - Number(p.entry_price)) *
    p.quantity *
    (p.side === "long" ? 1 : -1);
  return {
    positions,
    orders,
    fills,
    mark,
    positionPnl,
    unrealizedPnl: positions.reduce((total, p) => total + positionPnl(p), 0),
    realizedPnl: fills.reduce(
      (total, f) => total + (f.effect === "close" ? Number(f.realized_pnl) : 0),
      0,
    ),
  };
}
