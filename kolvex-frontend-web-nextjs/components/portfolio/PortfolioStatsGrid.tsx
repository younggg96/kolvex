import {
  TrendingUp,
  TrendingDown,
  Wallet,
  BarChart3,
  Briefcase,
  EyeOff,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatPercent } from "@/lib/snaptradeApi";

interface PortfolioStatsGridProps {
  totalValue: number | string; // "***" if hidden
  totalPnL: number | string; // "***" if hidden
  pnlPercent: number | string; // "***" if hidden
  totalPositions: number | string; // "***" if hidden
  accountsCount: number | string; // "***" if hidden
  /** Number of hidden positions (only shown in public view) */
  hiddenPositionsCount?: number;
  /** Number of hidden accounts (only shown in public view) */
  hiddenAccountsCount?: number;
}

// Helper to check if value is hidden (returns "***")
const isHidden = (value: number | string): value is string =>
  typeof value === "string";

export function PortfolioStatsGrid({
  totalValue,
  totalPnL,
  pnlPercent,
  totalPositions,
  accountsCount,
  hiddenPositionsCount = 0,
  hiddenAccountsCount = 0,
}: PortfolioStatsGridProps) {
  // Get numeric values for styling (default to 0 if hidden)
  const numericPnL = isHidden(totalPnL) ? 0 : totalPnL;
  const numericPnlPercent = isHidden(pnlPercent) ? 0 : pnlPercent;

  return (
    <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
      <Card className="relative overflow-hidden">
        <CardContent className="!p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Total Value
            </p>
            <Wallet className="h-4 w-4 text-muted-foreground/50" />
          </div>
          <p className="text-2xl font-bold mt-2 tabular-nums">
            {isHidden(totalValue) ? totalValue : formatCurrency(totalValue)}
          </p>
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden">
        <CardContent className="!p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Unrealized P&L
            </p>
            {!isHidden(totalPnL) && (
              <div>
                {numericPnL >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
              </div>
            )}
          </div>
          <p
            className={`text-2xl font-bold mt-2 tabular-nums ${
              isHidden(totalPnL)
                ? "text-muted-foreground"
                : numericPnL >= 0
                ? "text-green-600"
                : "text-red-600"
            }`}
          >
            {isHidden(totalPnL)
              ? totalPnL
              : `${numericPnL >= 0 ? "+" : ""}${formatCurrency(numericPnL)}`}
          </p>
          {!isHidden(pnlPercent) && (
            <p
              className={`text-xs mt-1 ${
                numericPnlPercent >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {formatPercent(numericPnlPercent)} all time
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden">
        <CardContent className="!p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Positions
            </p>
            <BarChart3 className="h-4 w-4 text-muted-foreground/50" />
          </div>
          <p className="text-2xl font-bold mt-2 tabular-nums">
            {totalPositions}
          </p>
          {hiddenPositionsCount > 0 && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <EyeOff className="h-3 w-3" />+{hiddenPositionsCount} hidden
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden">
        <CardContent className="!p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Accounts
            </p>
            <Briefcase className="h-4 w-4 text-muted-foreground/50" />
          </div>
          <p className="text-2xl font-bold mt-2 tabular-nums">
            {accountsCount}
          </p>
          {hiddenAccountsCount > 0 && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <EyeOff className="h-3 w-3" />+{hiddenAccountsCount} hidden
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
