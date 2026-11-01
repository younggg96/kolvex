import Link from "next/link";
import CompanyLogo from "@/components/ui/company-logo";
import { marketStockUrl, normalizeStockSymbol } from "@/lib/stockLinks";

/** Shared pill shell — keeps the historic look and min-h-11 touch target. */
const PILL_CLASS =
  "inline-flex min-h-11 max-w-full items-center gap-2 rounded-2xl border border-border bg-card p-1 pr-3 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none ";

/**
 * A consistent stock identity for event, article and opinion tags.
 *
 * The pill is always a link to that symbol's quotes page
 * (`/dashboard/market/<TICKER>`) unless the symbol is not routable, in which
 * case the same visual pill renders as plain text instead of a broken link.
 * Pass `href` to override the destination (e.g. a `?from=` return path); pass
 * `href={null}` to force the non-interactive rendering.
 */
export default function StockBadge({
  symbol,
  href,
}: {
  symbol: string;
  href?: string | null;
}) {
  const ticker = normalizeStockSymbol(symbol);
  const target = href === null ? null : (href ?? marketStockUrl(ticker));

  const content = (
    <>
      <span aria-hidden="true"><CompanyLogo symbol={ticker} size="sm" /></span>
      <span className="figure min-w-0 break-all">{ticker}</span>
    </>
  );

  if (!target) {
    return <span className={PILL_CLASS}>{content}</span>;
  }

  return (
    <Link href={target} className={`${PILL_CLASS}transition-colors hover:border-foreground/25 hover:bg-foreground/[0.06] hover:text-foreground`}>
      {content}
    </Link>
  );
}
