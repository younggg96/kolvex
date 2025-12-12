"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Users,
  Eye,
  Sparkles,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Briefcase,
  Trophy,
  Medal,
  Crown,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { HeroSection } from "@/components/ui/hero-section";
import DashboardLayout from "@/components/layout/DashboardLayout";
import SectionCard from "@/components/layout/SectionCard";
import { EmptyState } from "@/components/common/EmptyState";
import CompanyLogo from "@/components/stock/CompanyLogo";
import {
  getPublicUsers,
  formatCurrency,
  formatPercent,
} from "@/lib/snaptradeApi";
import type { PublicUserSummary } from "@/lib/supabase/database.types";

function UserCardSkeleton() {
  return (
    <div className="bg-white dark:bg-card-dark border border-border-light dark:border-border-dark rounded-xl p-4 animate-pulse">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-white/10" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-24 bg-gray-200 dark:bg-white/10 rounded" />
          <div className="h-3 w-16 bg-gray-200 dark:bg-white/10 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="h-16 bg-gray-100 dark:bg-white/5 rounded-lg" />
        <div className="h-16 bg-gray-100 dark:bg-white/5 rounded-lg" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-20 bg-gray-200 dark:bg-white/10 rounded" />
        <div className="flex gap-2">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-6 w-12 bg-gray-200 dark:bg-white/10 rounded-full"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-full flex items-center justify-center shadow-lg shadow-yellow-500/30">
        <Crown className="w-3.5 h-3.5 text-white" />
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-br from-gray-300 to-gray-400 rounded-full flex items-center justify-center shadow-lg">
        <Medal className="w-3.5 h-3.5 text-white" />
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-br from-amber-600 to-amber-700 rounded-full flex items-center justify-center shadow-lg">
        <Trophy className="w-3.5 h-3.5 text-white" />
      </div>
    );
  }
  return null;
}

function UserCard({ user, rank }: { user: PublicUserSummary; rank: number }) {
  const router = useRouter();
  const isProfit = user.total_pnl >= 0;
  const displayName = user.full_name || user.username || "Investor";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className="group bg-white dark:bg-card-dark border border-border-light dark:border-border-dark rounded-xl p-4 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30 dark:hover:border-primary/30 transition-all duration-300 cursor-pointer"
      onClick={() => router.push(`/portfolio/${user.user_id}`)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar className="w-12 h-12 ring-2 ring-primary/20 group-hover:ring-primary/40 transition-all">
              {user.avatar_url ? (
                <AvatarImage src={user.avatar_url} alt={displayName} />
              ) : null}
              <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/40 text-primary font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <RankBadge rank={rank} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-primary transition-colors">
              {displayName}
            </h3>
            {user.username && user.full_name && (
              <p className="text-xs text-gray-500 dark:text-white/50">
                @{user.username}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 text-gray-400 dark:text-white/40 group-hover:text-primary transition-colors">
          <Eye className="w-3.5 h-3.5" />
          <span className="text-xs">View</span>
          <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-gray-50 dark:bg-white/5 rounded-lg p-3">
          <p className="text-[10px] text-gray-500 dark:text-white/50 uppercase tracking-wider mb-1 font-medium">
            Portfolio Value
          </p>
          <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">
            {formatCurrency(user.total_value)}
          </p>
        </div>
        <div
          className={`rounded-lg p-3 ${
            isProfit
              ? "bg-green-50 dark:bg-green-500/10"
              : "bg-red-50 dark:bg-red-500/10"
          }`}
        >
          <p className="text-[10px] text-gray-500 dark:text-white/50 uppercase tracking-wider mb-1 font-medium">
            Total P&L
          </p>
          <div className="flex items-center gap-1">
            {isProfit ? (
              <ArrowUpRight className="w-4 h-4 text-green-600 dark:text-green-400" />
            ) : (
              <ArrowDownRight className="w-4 h-4 text-red-600 dark:text-red-400" />
            )}
            <p
              className={`text-lg font-bold tabular-nums ${
                isProfit
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {formatCurrency(Math.abs(user.total_pnl))}
            </p>
          </div>
          <p
            className={`text-[10px] ${
              isProfit
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {formatPercent(user.pnl_percent)}
          </p>
        </div>
      </div>

      {/* Positions Count */}
      <div className="flex items-center gap-2 mb-3">
        <Briefcase className="w-3.5 h-3.5 text-gray-400 dark:text-white/40" />
        <span className="text-xs text-gray-500 dark:text-white/50">
          {user.positions_count} positions
        </span>
      </div>

      {/* Top Holdings */}
      {user.top_positions.length > 0 && (
        <div>
          <p className="text-[10px] text-gray-500 dark:text-white/50 uppercase tracking-wider mb-2 font-medium">
            Top Holdings
          </p>
          <div className="flex flex-wrap gap-1.5">
            {user.top_positions.slice(0, 5).map((pos, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 dark:bg-white/5 rounded-full group/chip hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
              >
                <CompanyLogo
                  symbol={pos.symbol}
                  name={pos.symbol}
                  size="xs"
                  shape="rounded"
                />
                <span className="text-xs font-medium text-gray-700 dark:text-white/80">
                  {pos.symbol}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Last Synced */}
      {user.last_synced_at && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/5">
          <p className="text-[10px] text-gray-400 dark:text-white/30">
            Updated {new Date(user.last_synced_at).toLocaleDateString()}
          </p>
        </div>
      )}
    </div>
  );
}

export default function CommunityPage() {
  const [users, setUsers] = useState<PublicUserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const LIMIT = 12;

  const fetchUsers = useCallback(
    async (reset: boolean = false) => {
      try {
        if (reset) {
          setLoading(true);
        } else {
          setLoadingMore(true);
        }

        const currentOffset = reset ? 0 : users.length;
        const result = await getPublicUsers(LIMIT, currentOffset);

        if (reset) {
          setUsers(result.users);
        } else {
          setUsers((prev) => [...prev, ...result.users]);
        }

        setTotal(result.total);
        setHasMore(result.users.length === LIMIT);
      } catch (error) {
        console.error("Failed to fetch public users:", error);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [users.length]
  );

  useEffect(() => {
    fetchUsers(true);
  }, []);

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      fetchUsers(false);
    }
  };

  // Sort users by P&L percentage for ranking
  const sortedUsers = [...users].sort((a, b) => b.pnl_percent - a.pnl_percent);

  return (
    <DashboardLayout showHeader={false}>
      <div className="relative flex-1 overflow-y-auto bg-background-light dark:bg-background-dark h-full">
        <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />
        <div className="p-4 min-w-0 space-y-6">
          {/* Hero Section */}
          <div className="relative">
            <HeroSection
              title="Community Portfolios"
              description="Discover and learn from investors who share their holdings"
              features={[
                {
                  icon: Sparkles,
                  label: `${total} Public Portfolios`,
                  iconClassName: "w-3.5 h-3.5 text-primary",
                },
                {
                  icon: Eye,
                  label: "Transparent & Real-time Tracking",
                  iconClassName: "w-3.5 h-3.5 text-blue-600 dark:text-blue-400",
                },
              ]}
              actions={
                <Link href="/dashboard/portfolio">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 whitespace-nowrap"
                  >
                    <Briefcase className="w-3.5 h-3.5" />
                    Manage Portfolio
                  </Button>
                </Link>
              }
            />
          </div>

          {/* Loading State */}
          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(9)].map((_, i) => (
                <UserCardSkeleton key={i} />
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loading && users.length === 0 && (
            <SectionCard useSectionHeader={false}>
              <EmptyState
                icon={Users}
                title="No Public Portfolios Yet"
                description="Be the first to share your portfolio with the community! Enable public sharing in your portfolio settings."
              />
            </SectionCard>
          )}

          {/* User Grid */}
          {!loading && users.length > 0 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sortedUsers.map((user, index) => (
                  <UserCard key={user.user_id} user={user} rank={index + 1} />
                ))}
              </div>

              {/* Load More */}
              {hasMore && (
                <div className="flex justify-center pt-4">
                  <Button
                    variant="outline"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="gap-2"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        Load More
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* End of list */}
              {!hasMore && users.length > 0 && (
                <div className="text-center py-4 text-sm text-gray-400 dark:text-white/40">
                  You&apos;ve reached the end of the list
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
