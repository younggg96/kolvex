import { ListCard, ListRows, listFeedRowClass } from "@/components/ui/list-card";
import { ReadingText } from "@/components/public/ReadingElements";
import type { PublicCongressTrade } from "@/lib/publicContent";
import { cn } from "@/lib/utils";

const DIRECTION: Record<PublicCongressTrade["direction"], [string, string]> = {
  buy: ["Buy", "买入"],
  sell: ["Sell", "卖出"],
  exchange: ["Exchange", "换股"],
  other: ["Other", "其他"],
};
const CHAMBER = { house: ["House", "众议院"], senate: ["Senate", "参议院"] } as const;

/** Official filing links only: HTTPS and a government or disclosure host is not enforced, but the scheme is. */
function filingUrl(url: string | null) {
  try {
    return url && new URL(url).protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

/** Server-rendered list so every disclosure is in the cached HTML. */
export function CongressTradeList({ trades }: { trades: PublicCongressTrade[] }) {
  return (
    <ListCard>
      <ListRows aria-label="国会议员股票交易披露">
        {trades.map((trade) => {
          const [dirEn, dirZh] = DIRECTION[trade.direction];
          const chamber = trade.chamber ? CHAMBER[trade.chamber] : null;
          const source = filingUrl(trade.source_url);
          return (
            <li key={trade.id} className={cn(listFeedRowClass, "min-w-0 space-y-1")}>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="text-[0.9375rem] font-semibold">{trade.member_name}</h3>
                {chamber && (
                  <span className="text-xs text-muted-foreground">
                    <ReadingText en={chamber[0]} zh={chamber[1]} />
                  </span>
                )}
                <span className="text-sm font-medium">
                  <ReadingText en={dirEn} zh={dirZh} />
                </span>
                {trade.ticker && <span className="text-sm font-semibold">{trade.ticker}</span>}
                {trade.amount_range && (
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {trade.amount_range}
                  </span>
                )}
              </div>
              {trade.asset_name && (
                <p className="break-words text-sm text-muted-foreground">{trade.asset_name}</p>
              )}
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums text-muted-foreground">
                <span>
                  <ReadingText en="Traded" zh="交易日" /> {trade.trade_date}
                </span>
                <span>
                  <ReadingText en="Filed" zh="披露日" /> {trade.filed_date}
                </span>
                {source && (
                  <a
                    href={source}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="rounded-sm underline underline-offset-2 hover:text-foreground"
                  >
                    <ReadingText en="Filing" zh="披露原文" />
                  </a>
                )}
              </p>
            </li>
          );
        })}
      </ListRows>
    </ListCard>
  );
}

/** Counts over the rows shown, so the summary can never claim more than the page lists. */
export function congressSummary(trades: PublicCongressTrade[]) {
  const top = (values: (string | null)[]) => {
    const counts = new Map<string, number>();
    values.forEach((value) => value && counts.set(value, (counts.get(value) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  };
  return {
    total: trades.length,
    buys: trades.filter((trade) => trade.direction === "buy").length,
    sells: trades.filter((trade) => trade.direction === "sell").length,
    members: top(trades.map((trade) => trade.member_name)),
    tickers: top(trades.map((trade) => trade.ticker)),
    newest: trades[0]?.filed_date ?? null,
  };
}
