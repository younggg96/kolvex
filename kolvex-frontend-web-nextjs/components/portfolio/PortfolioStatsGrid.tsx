import {
  TrendingUp,
  TrendingDown,
  Wallet,
  BarChart3,
  Briefcase,
  EyeOff,
} from "lucide-react";
import { StatCard } from "@/components/common";
import { formatCurrency, formatPercent } from "@/lib/snaptradeApi";
import { useTranslation } from "@/lib/i18n";

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
const isHidden = (value: number | string): value is string => value === "***";

export function PortfolioStatsGrid({
  totalValue,
  totalPnL,
  pnlPercent,
  totalPositions,
  accountsCount,
  hiddenPositionsCount = 0,
  hiddenAccountsCount = 0,
}: PortfolioStatsGridProps) {
  const { t } = useTranslation();

  // Get numeric values for styling (default to 0 if hidden)
  const numericPnL = isHidden(totalPnL) ? 0 : totalPnL;
  const numericPnlPercent = isHidden(pnlPercent) ? 0 : pnlPercent;

  // P&L variant based on value
  const pnlVariant = isHidden(totalPnL)
    ? "muted"
    : numericPnL >= 0
    ? "positive"
    : "negative";

  // P&L subtitle with percentage
  const pnlSubtitle = !isHidden(pnlPercent) && (
    <span
      className={numericPnlPercent >= 0 ? "text-green-600" : "text-red-600"}
    >
      {formatPercent(numericPnlPercent)} {t("portfolio.stats.allTime")}
    </span>
  );

  // Positions subtitle for hidden count
  const positionsSubtitle = hiddenPositionsCount > 0 && (
    <span className="flex items-center gap-1">
      <EyeOff className="h-3 w-3" />+{hiddenPositionsCount} {t("portfolio.stats.hidden")}
    </span>
  );

  // Accounts subtitle for hidden count
  const accountsSubtitle = hiddenAccountsCount > 0 && (
    <span className="flex items-center gap-1">
      <EyeOff className="h-3 w-3" />+{hiddenAccountsCount} {t("portfolio.stats.hidden")}
    </span>
  );

  return (
    <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
      <StatCard
        label={t("portfolio.stats.totalValue")}
        value={isHidden(totalValue) ? totalValue : formatCurrency(totalValue)}
        icon={Wallet}
      />

      <StatCard
        label={t("portfolio.stats.unrealizedPnl")}
        value={
          isHidden(totalPnL)
            ? totalPnL
            : `${numericPnL >= 0 ? "+" : ""}${formatCurrency(numericPnL)}`
        }
        icon={numericPnL >= 0 ? TrendingUp : TrendingDown}
        variant={pnlVariant}
        subtitle={pnlSubtitle}
      />

      <StatCard
        label={t("portfolio.stats.positions")}
        value={totalPositions}
        icon={BarChart3}
        subtitle={positionsSubtitle}
      />

      <StatCard
        label={t("portfolio.stats.accounts")}
        value={accountsCount}
        icon={Briefcase}
        subtitle={accountsSubtitle}
      />
    </div>
  );
}
