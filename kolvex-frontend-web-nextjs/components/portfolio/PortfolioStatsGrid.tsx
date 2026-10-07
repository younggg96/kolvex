import { EyeOff } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/portfolioApi";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

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
  /** Total value is already the chart headline */
  showTotalValue?: boolean;
}

const isHidden = (value: number | string): value is string => value === "***";

function Stat({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  note?: React.ReactNode;
  tone?: "positive" | "negative";
}) {
  return (
    <div className="min-w-0 py-4 pr-4 sm:pr-6">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "figure mt-1 truncate text-xl font-semibold",
          tone === "positive" && "text-positive",
          tone === "negative" && "text-negative",
        )}
      >
        {value}
      </dd>
      {note && <dd className="mt-0.5 text-xs text-muted-foreground">{note}</dd>}
    </div>
  );
}

export function PortfolioStatsGrid({
  totalValue,
  totalPnL,
  pnlPercent,
  totalPositions,
  accountsCount,
  hiddenPositionsCount = 0,
  hiddenAccountsCount = 0,
  showTotalValue = false,
}: PortfolioStatsGridProps) {
  const { t } = useTranslation();
  const pnlTone = isHidden(totalPnL) ? undefined : totalPnL >= 0 ? "positive" : "negative";
  const hiddenNote = (count: number) =>
    count > 0 ? (
      <span className="inline-flex items-center gap-1">
        <EyeOff className="h-3 w-3" />+{count} {t("portfolio.stats.hidden")}
      </span>
    ) : undefined;

  return (
    <dl
      className={cn(
        "grid grid-cols-2 border-b border-border",
        showTotalValue ? "sm:grid-cols-4" : "sm:grid-cols-3",
      )}
    >
      {showTotalValue && (
        <Stat
          label={t("portfolio.stats.totalValue")}
          value={isHidden(totalValue) ? totalValue : formatCurrency(totalValue)}
        />
      )}
      <Stat
        label={t("portfolio.stats.unrealizedPnl")}
        tone={pnlTone}
        value={
          isHidden(totalPnL)
            ? totalPnL
            : `${totalPnL >= 0 ? "+" : "−"}${formatCurrency(Math.abs(totalPnL))}`
        }
        note={
          !isHidden(pnlPercent) && (
            <>
              <span className={cn("font-semibold", pnlPercent >= 0 ? "text-positive" : "text-negative")}>
                {formatPercent(pnlPercent)}
              </span>{" "}
              {t("portfolio.stats.allTime")}
            </>
          )
        }
      />
      <Stat
        label={t("portfolio.stats.positions")}
        value={totalPositions}
        note={hiddenNote(hiddenPositionsCount)}
      />
      <Stat
        label={t("portfolio.stats.accounts")}
        value={accountsCount}
        note={hiddenNote(hiddenAccountsCount)}
      />
    </dl>
  );
}
