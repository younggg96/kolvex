"use client";

import {
  Users,
  BarChart3,
  TrendingUp,
  Calendar,
  Briefcase,
  DollarSign,
  PieChart,
  Sparkles,
} from "lucide-react";
import { StatCard } from "@/components/common";
import { formatMoney, formatPercent } from "@/lib/dataromaApi";

// Re-export StatCard from common for backward compatibility
export { StatCard } from "@/components/common";

interface InvestorsStatsProps {
  loading?: boolean;
  investorCount: number;
  holdingCount: number | string;
  popularStockCount: number;
  latestQuarter: string;
  className?: string;
}

export function InvestorsStats({
  loading = false,
  investorCount,
  holdingCount,
  popularStockCount,
  latestQuarter,
  className = "",
}: InvestorsStatsProps) {
  return (
    <div className={`grid grid-cols-2 lg:grid-cols-4 gap-3 ${className}`}>
      <StatCard
        label="Investors"
        value={investorCount}
        icon={Users}
        loading={loading}
      />
      <StatCard
        label="Holdings"
        value={holdingCount}
        icon={BarChart3}
        loading={loading}
      />
      <StatCard
        label="Popular Stocks"
        value={popularStockCount}
        icon={TrendingUp}
        loading={loading}
      />
      <StatCard
        label="Latest Quarter"
        value={latestQuarter}
        icon={Calendar}
        loading={loading}
      />
    </div>
  );
}

interface InvestorDetailStatsProps {
  loading?: boolean;
  positions: number;
  portfolioValue: number | null;
  top5Weight: number;
  newPositions: number;
  className?: string;
}

export function InvestorDetailStats({
  loading = false,
  positions,
  portfolioValue,
  top5Weight,
  newPositions,
  className = "",
}: InvestorDetailStatsProps) {
  return (
    <div className={`grid grid-cols-2 lg:grid-cols-4 gap-3 ${className}`}>
      <StatCard
        label="Positions"
        value={positions}
        icon={Briefcase}
        loading={loading}
      />
      <StatCard
        label="Portfolio Value"
        value={formatMoney(portfolioValue)}
        icon={DollarSign}
        loading={loading}
      />
      <StatCard
        label="Top 5 Weight"
        value={formatPercent(top5Weight)}
        icon={PieChart}
        loading={loading}
      />
      <StatCard
        label="New Positions"
        value={newPositions}
        icon={Sparkles}
        loading={loading}
      />
    </div>
  );
}
