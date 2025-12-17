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
import type { PrivacySettings } from "@/lib/supabase/database.types";

interface PortfolioStatsGridProps {
  totalValue: number;
  totalPnL: number;
  pnlPercent: number;
  totalPositions: number;
  accountsCount: number;
  /** Privacy settings for public view (undefined = show all) */
  privacySettings?: PrivacySettings;
  /** Number of hidden positions (only shown in public view) */
  hiddenPositionsCount?: number;
  /** Number of hidden accounts (only shown in public view) */
  hiddenAccountsCount?: number;
}

export function PortfolioStatsGrid({
  totalValue,
  totalPnL,
  pnlPercent,
  totalPositions,
  accountsCount,
  privacySettings,
  hiddenPositionsCount = 0,
  hiddenAccountsCount = 0,
}: PortfolioStatsGridProps) {
  // Determine what to show based on privacy settings
  const showTotalValue = privacySettings?.show_total_value !== false;
  const showTotalPnL = privacySettings?.show_total_pnl !== false;
  const showPnlPercent = privacySettings?.show_pnl_percent !== false;
  const showPositionsCount = privacySettings?.show_positions_count !== false;
  // Accounts card is always shown (accounts visibility is controlled individually)
  const showAccountsCount = true;

  // Count visible cards for grid layout
  const visibleCards = [
    showTotalValue,
    showTotalPnL,
    showPositionsCount,
    showAccountsCount,
  ].filter(Boolean).length;

  // Don't render if no cards are visible
  if (visibleCards === 0) return null;

  // Dynamic grid class based on visible cards
  const gridClass =
    visibleCards <= 2
      ? "grid-cols-2"
      : visibleCards === 3
      ? "grid-cols-3"
      : "grid-cols-2 lg:grid-cols-4";

  return (
    <div className={`grid gap-2 ${gridClass}`}>
      {showTotalValue && (
        <Card className="relative overflow-hidden">
          <CardContent className="!p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Total Value
              </p>
              <Wallet className="h-4 w-4 text-muted-foreground/50" />
            </div>
            <p className="text-2xl font-bold mt-2 tabular-nums">
              {formatCurrency(totalValue)}
            </p>
          </CardContent>
        </Card>
      )}

      {showTotalPnL && (
        <Card
          className={`relative overflow-hidden ${
            totalPnL >= 0 ? "bg-green-500" : "bg-red-500"
          }`}
        >
          <CardContent className="!p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Unrealized P&L
              </p>
              {totalPnL >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
            </div>
            <p
              className={`text-2xl font-bold mt-2 tabular-nums ${
                totalPnL >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {totalPnL >= 0 ? "+" : ""}
              {formatCurrency(totalPnL)}
            </p>
            {showPnlPercent && (
              <p
                className={`text-xs mt-1 ${
                  pnlPercent >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {formatPercent(pnlPercent)} all time
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {showPositionsCount && (
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
      )}

      {showAccountsCount && (
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
      )}
    </div>
  );
}
