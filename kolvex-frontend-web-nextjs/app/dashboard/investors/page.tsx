"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { TrendingUp, Search, RefreshCw } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import SectionCard from "@/components/layout/SectionCard";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/EmptyState";
import { InvestorsHeroSection, StatCard } from "@/components/investors";
import {
  getInvestors,
  getPopularStocks,
  getSyncStatus,
  triggerSyncAll,
  formatMoney,
  type SuperInvestor,
  type PopularStock,
  type SyncStatus,
} from "@/lib/dataromaApi";

export default function InvestorsPage() {
  const [investors, setInvestors] = useState<SuperInvestor[]>([]);
  const [popularStocks, setPopularStocks] = useState<PopularStock[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [investorsRes, popularRes, statusRes] = await Promise.all([
        getInvestors({ limit: 100, is_active: true }),
        getPopularStocks({ limit: 10, min_holders: 2 }),
        getSyncStatus(),
      ]);
      setInvestors(investorsRes.data);
      setPopularStocks(popularRes);
      setSyncStatus(statusRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      await triggerSyncAll();
      const pollStatus = setInterval(async () => {
        const status = await getSyncStatus();
        setSyncStatus(status);
        if (!status.all.is_running) {
          clearInterval(pollStatus);
          setSyncing(false);
          loadData();
        }
      }, 2000);
    } catch (err) {
      setSyncing(false);
      setError(err instanceof Error ? err.message : "Sync failed");
    }
  }

  const filteredInvestors = investors.filter(
    (inv) =>
      inv.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (error) {
    return (
      <DashboardLayout title="Superinvestors" headerClassName="lg:hidden">
        <div className="relative flex-1 overflow-y-auto bg-background-light dark:bg-background-dark">
          <div className="p-4">
            <ErrorState
              title="Failed to load investors"
              message={error}
              retry={loadData}
            />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Superinvestors" headerClassName="lg:hidden">
      <div className="relative flex-1 overflow-y-auto bg-background-light dark:bg-background-dark">
        <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />

        {/* Hero Section - Desktop Only */}
        <InvestorsHeroSection
          className="hidden lg:block"
          syncing={syncing}
          onSync={handleSync}
        />

        {/* Main Content */}
        <div className="relative p-4 min-w-0 space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label="Investors"
              value={loading ? null : investors.length}
            />
            <StatCard
              label="Holdings"
              value={
                loading
                  ? null
                  : syncStatus?.database.holding_count?.toLocaleString() || 0
              }
            />
            <div className="hidden lg:block">
              <StatCard
                label="Popular Stocks"
                value={loading ? null : popularStocks.length}
              />
            </div>
            <div className="hidden lg:block">
              <StatCard
                label="Latest Quarter"
                value={
                  loading ? null : syncStatus?.database.latest_quarter || "-"
                }
              />
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            {/* Investors List */}
            <div className="lg:col-span-2">
              <SectionCard
                title="Investors and Holdings"
                useSectionHeader
                padding="sm"
                contentClassName="px-3 pb-3"
                sectionHeaderAction={
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search investors..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-9"
                    />
                  </div>
                }
              >
                {loading ? (
                  <div className="space-y-2">
                    {[...Array(8)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full rounded-lg" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredInvestors.map((investor) => (
                      <Link
                        key={investor.id}
                        href={`/dashboard/investors/${investor.code}`}
                        className="block"
                      >
                        <div className="flex items-center justify-between p-3 rounded-lg border border-border-light dark:border-border-dark hover:bg-muted/50 transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-sm truncate">
                                {investor.name}
                              </h3>
                              {/* <Badge variant="outline" size="xs">
                                {investor.code}
                              </Badge> */}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              {investor.stock_count && (
                                <span>{investor.stock_count} stocks</span>
                              )}
                              {investor.portfolio_value && (
                                <span>
                                  {formatMoney(investor.portfolio_value)}
                                </span>
                              )}
                              {investor.period && (
                                <span className="hidden sm:inline">
                                  {investor.period}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                    {filteredInvestors.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        No investors found
                      </div>
                    )}
                  </div>
                )}
              </SectionCard>
            </div>

            {/* Popular Stocks */}
            <div className="space-y-4">
              <SectionCard
                title="Popular Holdings"
                useSectionHeader
                padding="sm"
                contentClassName="px-3 pb-3"
              >
                {loading ? (
                  <div className="space-y-2">
                    {[...Array(6)].map((_, i) => (
                      <Skeleton key={i} className="h-14 w-full rounded-lg" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {popularStocks.map((stock, index) => (
                      <Link
                        key={stock.ticker}
                        href={`/dashboard/stock/${stock.ticker}`}
                        className="block"
                      >
                        <div className="flex items-center gap-3 p-3 rounded-lg border border-border-light dark:border-border-dark hover:bg-muted/50 transition-colors">
                          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary font-bold text-xs">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm">
                                {stock.ticker}
                              </span>
                              <Badge
                                variant="secondary"
                                className="text-xs"
                                size="xs"
                              >
                                {stock.holder_count} holders
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {stock.company_name || "-"}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-medium">
                              {formatMoney(stock.total_market_value)}
                            </p>
                          </div>
                        </div>
                      </Link>
                    ))}
                    {popularStocks.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        No data available
                      </div>
                    )}
                  </div>
                )}
              </SectionCard>

              {/* Sync Status */}
              {syncStatus?.all.is_running && (
                <SectionCard padding="sm" contentClassName="p-3">
                  <div className="flex items-center gap-3">
                    <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                    <div>
                      <p className="font-medium text-sm">Syncing...</p>
                      {syncStatus.all.progress && (
                        <p className="text-xs text-muted-foreground">
                          {syncStatus.all.progress.stage}:{" "}
                          {syncStatus.all.progress.current}/
                          {syncStatus.all.progress.total}
                        </p>
                      )}
                    </div>
                  </div>
                </SectionCard>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
