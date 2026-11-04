import type { Account, Fill } from "./paperTrading";

/** Private ledger view. Publication eligibility still belongs to the server. */
export function paperTradingReviews(account: Account) {
  const active = new Map(account.state.positions.map((p) => [p.id, p]));
  const groups = new Map<string, Fill[]>();
  for (const fill of account.state.fills) {
    const fills = groups.get(fill.position_id) ?? [];
    fills.push(fill);
    groups.set(fill.position_id, fills);
  }
  return [...groups.entries()]
    .map(([id, entries]) => {
      const fills = [...entries].sort((a, b) => a.at.localeCompare(b.at));
      const opening = fills.find((f) => f.effect === "open") ?? fills[0];
      const closing = fills.filter((f) => f.effect === "close");
      const position = active.get(id);
      const mark = position ? account.state.marks[position.symbol] : undefined;
      const completed = !position && closing.length > 0;
      return {
        id,
        symbol: opening.symbol,
        side: opening.side,
        fills,
        completed,
        openedAt: opening.at,
        lastAt: fills[fills.length - 1].at,
        thesis: opening.note || position?.note || "",
        remaining: position?.quantity ?? 0,
        realizedPnl: closing.reduce(
          (sum, f) => sum + Number(f.realized_pnl),
          0,
        ),
        unrealizedPnl: position
          ? (Number(mark?.price ?? position.entry_price) -
              Number(position.entry_price)) *
            position.quantity *
            (position.side === "long" ? 1 : -1)
          : 0,
        markAt: mark?.at,
        fees: fills.reduce((sum, f) => sum + Number(f.fee), 0),
      };
    })
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}
