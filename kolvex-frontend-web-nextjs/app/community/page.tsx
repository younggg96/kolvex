"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Users,
  Eye,
  Sparkles,
  ChevronRight,
  Loader2,
  Briefcase,
  ArrowUpDown,
  Clock,
  TrendingUp,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroSection } from "@/components/ui/hero-section";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import DashboardLayout from "@/components/layout/DashboardLayout";
import SectionCard from "@/components/layout/SectionCard";
import { EmptyState } from "@/components/common/EmptyState";
import { UserCard, UserCardSkeleton } from "@/components/community";
import {
  getPublicUsers,
  type PublicUsersSortBy,
  type SortOrder,
} from "@/lib/snaptradeApi";
import type { PublicUserSummary } from "@/lib/supabase/database.types";

type SortOption = {
  value: PublicUsersSortBy;
  order: SortOrder;
  label: string;
  icon: typeof Clock;
};

const SORT_OPTIONS: SortOption[] = [
  { value: "updated", order: "desc", label: "Recently Updated", icon: Clock },
  {
    value: "pnl_percent",
    order: "desc",
    label: "Top Performers",
    icon: TrendingUp,
  },
  {
    value: "pnl_percent",
    order: "asc",
    label: "Worst Performers",
    icon: TrendingUp,
  },
];

export default function CommunityPage() {
  const [users, setUsers] = useState<PublicUserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [sortOption, setSortOption] = useState<SortOption>(SORT_OPTIONS[0]);
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
        const result = await getPublicUsers(
          LIMIT,
          currentOffset,
          sortOption.value,
          sortOption.order
        );

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
    [users.length, sortOption]
  );

  // Initial fetch and refetch when sort changes
  useEffect(() => {
    fetchUsers(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortOption]);

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      fetchUsers(false);
    }
  };

  const handleSortChange = (option: SortOption) => {
    if (
      option.value !== sortOption.value ||
      option.order !== sortOption.order
    ) {
      setSortOption(option);
      setUsers([]); // Reset users when sort changes
    }
  };

  return (
    <DashboardLayout showHeader={false}>
      <div className="relative flex-1 overflow-y-auto bg-background-light dark:bg-background-dark h-full">
        <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />
        <div className="p-4 min-w-0 space-y-6">
          {/* Hero Section */}
          <div className="relative">
            <HeroSection
              title="Community Portfolios"
              description="Discover and learn from investors who share their portfolios"
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
                    Manage My Portfolio
                  </Button>
                </Link>
              }
            />
          </div>

          {/* Sort Controls */}
          {!loading && users.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {users.length} of {total} portfolios
              </p>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    {sortOption.label}
                    <ChevronDown className="w-3.5 h-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {SORT_OPTIONS.map((option, index) => (
                    <DropdownMenuItem
                      key={index}
                      onClick={() => handleSortChange(option)}
                      className={`gap-2 ${
                        sortOption.value === option.value &&
                        sortOption.order === option.order
                          ? "bg-accent"
                          : ""
                      }`}
                    >
                      <option.icon className="w-4 h-4" />
                      {option.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

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
                {users.map((user, index) => (
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
