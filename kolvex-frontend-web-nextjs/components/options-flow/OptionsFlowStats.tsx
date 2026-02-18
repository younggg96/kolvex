"use client";

import {
  Activity,
  DollarSign,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import { StatCard } from "@/components/common";
import { useTranslation } from "@/lib/i18n";
import type { UnusualActivityItem } from "@/lib/optionsFlowApi";

interface OptionsFlowStatsCardsProps {
  data: UnusualActivityItem[];
  total: number;
  loading?: boolean;
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

export function OptionsFlowStatsCards({
  data,
  total,
  loading,
}: OptionsFlowStatsCardsProps) {
  const { t } = useTranslation();

  const callCount = data.filter((d) => d.option_type === "call").length;
  const putCount = data.filter((d) => d.option_type === "put").length;
  const totalPremium = data.reduce((sum, d) => sum + (d.premium || 0), 0);
  const avgVolOi =
    data.length > 0
      ? data.reduce((sum, d) => sum + (d.vol_oi_ratio || 0), 0) / data.length
      : 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard
        label={t("optionsFlow.statsTotal")}
        value={loading ? null : total.toLocaleString()}
        icon={Activity}
        loading={loading}
        subtitle={
          data.length > 0
            ? `${callCount} calls / ${putCount} puts`
            : undefined
        }
      />
      <StatCard
        label={t("optionsFlow.statsPremium")}
        value={loading ? null : formatCurrency(totalPremium)}
        icon={DollarSign}
        loading={loading}
      />
      <StatCard
        label={t("optionsFlow.statsCallPut")}
        value={
          loading
            ? null
            : putCount > 0
              ? (callCount / putCount).toFixed(2)
              : callCount > 0
                ? `${callCount}`
                : "—"
        }
        icon={TrendingUp}
        loading={loading}
        subtitle={
          callCount > 0 || putCount > 0
            ? callCount > putCount
              ? t("optionsFlow.bullish")
              : t("optionsFlow.bearish")
            : undefined
        }
      />
      <StatCard
        label={t("optionsFlow.statsVolOi")}
        value={loading ? null : `${avgVolOi.toFixed(1)}x`}
        icon={BarChart3}
        loading={loading}
      />
    </div>
  );
}
