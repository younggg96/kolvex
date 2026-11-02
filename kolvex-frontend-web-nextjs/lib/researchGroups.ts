import { getPublishedAnalyses, type TradingAnalysis } from "./tradingAnalysisApi";

export const RESEARCH_GROUPS_KEY = "/api/trading-analysis/published/stock-groups";
export const STOCKS_PER_PAGE = 12;

/** Load summaries across task pages before grouping so a stock never splits. */
export async function loadResearchCatalog(signal: AbortSignal) {
  const items = new Map<string, TradingAnalysis>();
  let offset = 0;
  let total = 0;
  do {
    const batch = await getPublishedAnalyses({ limit: 100, offset }, signal);
    total = batch.total;
    if (!batch.items.length && offset < total) throw new Error("Incomplete research catalog");
    for (const item of batch.items) items.set(item.id, item);
    offset += batch.items.length;
  } while (offset < total);
  if (items.size < total) throw new Error("Incomplete research catalog");
  return [...items.values()];
}

export function groupResearchByStock(items: TradingAnalysis[]) {
  const groups = new Map<string, TradingAnalysis[]>();
  for (const item of items) {
    const ticker = item.ticker.trim().toUpperCase();
    const group = groups.get(ticker) ?? [];
    group.push(item);
    groups.set(ticker, group);
  }
  const newest = (a: TradingAnalysis, b: TradingAnalysis) =>
    b.trade_date.localeCompare(a.trade_date) || b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id);
  return [...groups].map(([ticker, tasks]) => ({ ticker, tasks: tasks.sort(newest) }))
    .sort((a, b) => newest(a.tasks[0], b.tasks[0]) || a.ticker.localeCompare(b.ticker));
}
