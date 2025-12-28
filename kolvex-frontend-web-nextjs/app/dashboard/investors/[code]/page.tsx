"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import SectionCard from "@/components/layout/SectionCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/EmptyState";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InvestorDetailHeroSection, StatCard } from "@/components/investors";
import {
  getInvestor,
  getInvestorHoldings,
  formatMoney,
  formatPercent,
  formatShares,
  getChangeTypeColor,
  getChangeTypeLabel,
  type SuperInvestor,
  type Holding,
} from "@/lib/dataromaApi";

export default function InvestorDetailPage() {
  const params = useParams();
  const code = params.code as string;

  const [investor, setInvestor] = useState<SuperInvestor | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [summary, setSummary] = useState<{
    total_positions: number;
    total_market_value: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!code) return;
      setLoading(true);
      setError(null);
      try {
        const [investorData, holdingsData] = await Promise.all([
          getInvestor(code),
          getInvestorHoldings(code),
        ]);
        setInvestor(investorData);
        setHoldings(holdingsData.holdings);
        setSummary(holdingsData.summary);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [code]);

  const backButton = (
    <Button variant="ghost" size="sm" asChild className="-ml-2">
      <Link href="/dashboard/investors">
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back
      </Link>
    </Button>
  );

  if (error) {
    return (
      <DashboardLayout
        title="Investor Details"
        headerClassName="lg:hidden"
        headerLeftAction={backButton}
      >
        <div className="relative flex-1 overflow-y-auto bg-background-light dark:bg-background-dark">
          <div className="p-4">
            <ErrorState
              title="Failed to load investor"
              message={error}
              retry={() => window.location.reload()}
            />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Calculate stats
  const positions = investor?.stock_count || summary?.total_positions || 0;
  const portfolioValue =
    investor?.portfolio_value || summary?.total_market_value || null;
  const top5Weight = holdings
    .slice(0, 5)
    .reduce((sum, h) => sum + (h.portfolio_percent || 0), 0);
  const newPositions = holdings.filter(
    (h) => h.change_type === "new" || h.change_type === "buy"
  ).length;

  return (
    <DashboardLayout
      title={investor?.name || "Investor Details"}
      headerClassName="lg:hidden"
      headerLeftAction={backButton}
    >
      <div className="relative flex-1 overflow-y-auto bg-background-light dark:bg-background-dark">
        <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />

        {/* Hero Section - Desktop Only */}
        <InvestorDetailHeroSection
          className="hidden lg:block"
          investor={investor}
          loading={loading}
        />

        {/* Main Content */}
        <div className="relative p-4 min-w-0 space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Positions" value={loading ? null : positions} />
            <StatCard
              label="Portfolio Value"
              value={loading ? null : formatMoney(portfolioValue)}
            />
            <div className="hidden lg:block">
              <StatCard
                label="Top 5 Weight"
                value={loading ? null : formatPercent(top5Weight)}
              />
            </div>
            <div className="hidden lg:block">
              <StatCard
                label="New Positions"
                value={loading ? null : newPositions}
              />
            </div>
          </div>

          {/* Holdings Table */}
          <SectionCard
            title="Holdings"
            useSectionHeader
            padding="sm"
            contentClassName="px-3 pb-3"
          >
            {loading ? (
              <div className="space-y-2">
                {[...Array(10)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : holdings.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                No holdings data available
              </div>
            ) : (
              <div className="overflow-x-auto -mx-3 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
                <Table className="min-w-[800px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[70px] pl-3 sticky left-0 bg-card-light dark:bg-card-dark z-10">
                        Stock
                      </TableHead>
                      <TableHead className="min-w-[120px]">Company</TableHead>
                      <TableHead className="text-right min-w-[80px]">
                        Weight
                      </TableHead>
                      <TableHead className="text-center min-w-[80px]">
                        Activity
                      </TableHead>
                      <TableHead className="text-right min-w-[90px]">
                        Shares
                      </TableHead>
                      <TableHead className="text-right min-w-[80px]">
                        Reported
                      </TableHead>
                      <TableHead className="text-right min-w-[80px]">
                        Current
                      </TableHead>
                      <TableHead className="text-right min-w-[80px]">
                        Change
                      </TableHead>
                      <TableHead className="text-right pr-3 min-w-[100px]">
                        Value
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {holdings.map((holding) => (
                      <TableRow key={holding.id}>
                        <TableCell className="pl-3 sticky left-0 bg-card-light dark:bg-card-dark z-10">
                          <Link
                            href={`/dashboard/stock/${holding.ticker}`}
                            className="font-semibold text-sm hover:text-primary transition-colors"
                          >
                            {holding.ticker}
                          </Link>
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate text-sm">
                          {holding.company_name || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div
                              className="h-1.5 bg-primary rounded-full"
                              style={{
                                width: `${Math.min(
                                  (holding.portfolio_percent || 0) * 2,
                                  60
                                )}px`,
                              }}
                            />
                            <span className="text-sm">
                              {formatPercent(holding.portfolio_percent)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {holding.change_type &&
                          holding.change_type !== "unchanged" ? (
                            <Badge
                              size="xs"
                              className={`text-xs ${getChangeTypeColor(
                                holding.change_type
                              )}`}
                            >
                              {getChangeTypeLabel(holding.change_type)}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">
                              -
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatShares(holding.shares)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {holding.reported_price
                            ? `$${holding.reported_price.toFixed(2)}`
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {holding.current_price
                            ? `$${holding.current_price.toFixed(2)}`
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {holding.price_change_percent !== null ? (
                            <span
                              className={`text-sm ${
                                holding.price_change_percent >= 0
                                  ? "text-emerald-500"
                                  : "text-red-500"
                              }`}
                            >
                              {holding.price_change_percent >= 0 ? (
                                <TrendingUp className="h-3 w-3 inline mr-1" />
                              ) : (
                                <TrendingDown className="h-3 w-3 inline mr-1" />
                              )}
                              {formatPercent(
                                holding.price_change_percent,
                                true
                              )}
                            </span>
                          ) : (
                            <span className="text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm pr-3">
                          {formatMoney(holding.market_value)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </DashboardLayout>
  );
}
