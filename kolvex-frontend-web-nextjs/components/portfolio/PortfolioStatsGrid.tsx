import { TrendingUp, TrendingDown, Wallet, BarChart3, Briefcase } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatPercent } from "@/lib/snaptradeApi";

interface PortfolioStatsGridProps {
  totalValue: number;
  totalPnL: number;
  pnlPercent: number;
  totalPositions: number;
  accountsCount: number;
}

export function PortfolioStatsGrid({
  totalValue,
  totalPnL,
  pnlPercent,
  totalPositions,
  accountsCount,
}: PortfolioStatsGridProps) {
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
            {formatCurrency(totalValue)}
          </p>
        </CardContent>
      </Card>

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
          <p
            className={`text-xs mt-1 ${
              pnlPercent >= 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            {pnlPercent >= 0 ? "+" : ""}
            {formatPercent(pnlPercent)} all time
          </p>
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
        </CardContent>
      </Card>
    </div>
  );
}

