import Link from "next/link";
import CompanyLogo from "@/components/ui/company-logo";

/** A consistent stock identity for event, article and opinion tags. */
export default function StockBadge({ symbol, href }: { symbol: string; href?: string }) {
  const ticker = symbol.trim().toUpperCase();
  return (
    <Link
      href={href ?? `/dashboard/market/${encodeURIComponent(ticker)}`}
      className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-lg border border-border bg-card p-1 pr-3 text-sm font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <span aria-hidden="true"><CompanyLogo symbol={ticker} size="sm" /></span>
      <span className="figure min-w-0 break-all">{ticker}</span>
    </Link>
  );
}
