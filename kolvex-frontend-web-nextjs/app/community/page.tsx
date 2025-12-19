"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Users,
  Eye,
  Sparkles,
  ChevronRight,
  Loader2,
  Briefcase,
  Clock,
  TrendingUp,
  ChevronDown,
  UserCheck,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroSection } from "@/components/ui/hero-section";
import { SwitchTab } from "@/components/ui/switch-tab";
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
import { getFollowing } from "@/lib/followApi";
import { useAuth } from "@/hooks/useAuth";
import type { PublicUserSummary } from "@/lib/supabase/database.types";
import { useBreakpoints } from "@/hooks/useBreakpoints";

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

type TabValue = "all" | "following";

export default function CommunityPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabValue>("all");
  const [users, setUsers] = useState<PublicUserSummary[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [sortOption, setSortOption] = useState<SortOption>(SORT_OPTIONS[0]);
  const LIMIT = 12;
  const { isMobile, isTablet } = useBreakpoints();
  // Tab options
  const tabOptions = useMemo(
    () => [
      {
        value: "all",
        label: "All",
        icon: <Globe className="w-3.5 h-3.5" />,
      },
      {
        value: "following",
        label: "Following",
        icon: <UserCheck className="w-3.5 h-3.5" />,
        disabled: !isAuthenticated,
      },
    ],
    [isAuthenticated]
  );

  // Fetch following IDs when authenticated
  useEffect(() => {
    const fetchFollowingIds = async () => {
      if (!user?.id) {
        setFollowingIds(new Set());
        return;
      }
      try {
        const result = await getFollowing(user.id, 1, 1000);
        const ids = new Set(result.users.map((u) => u.user_id));
        setFollowingIds(ids);
      } catch (error) {
        console.error("Failed to fetch following list:", error);
        setFollowingIds(new Set());
      }
    };

    if (!authLoading) {
      fetchFollowingIds();
    }
  }, [user?.id, authLoading]);

  // Filter users based on active tab
  const displayedUsers = useMemo(() => {
    if (activeTab === "following") {
      return users.filter((u) => followingIds.has(u.user_id));
    }
    return users;
  }, [users, activeTab, followingIds]);

  // Calculate displayed total
  const displayedTotal = useMemo(() => {
    if (activeTab === "following") {
      return displayedUsers.length;
    }
    return total;
  }, [activeTab, displayedUsers.length, total]);

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

  // Handle follow/unfollow to update followingIds
  const handleFollowChange = useCallback(
    (userId: string, isFollowing: boolean) => {
      setFollowingIds((prev) => {
        const newSet = new Set(prev);
        if (isFollowing) {
          newSet.add(userId);
        } else {
          newSet.delete(userId);
        }
        return newSet;
      });
    },
    []
  );

  return (
    <DashboardLayout
      showHeader={isMobile || isTablet}
      title="Community Portfolios"
      headerActions={
        <Link href="/dashboard/portfolio">
          <Button
            variant="outline"
            size="xs"
            className="gap-2 whitespace-nowrap"
          >
            <Briefcase className="w-3.5 h-3.5" />
            Manage
          </Button>
        </Link>
      }
    >
      <div className="relative flex-1 overflow-y-auto bg-background-light dark:bg-background-dark h-full">
        <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />
        <HeroSection
          title="Community Portfolios"
          description="Discover and learn from investors who share their portfolios"
          className="lg:block hidden"
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
        <div className="min-w-0 space-y-6 p-4">
          {/* Tab & Sort Controls */}
          <div className="flex items-start sm:items-center justify-between gap-3">
            <SwitchTab
              options={tabOptions}
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as TabValue)}
              size="md"
              className="!w-fit"
            />

            <div className="flex items-center gap-3 w-auto justify-end">
              {!loading && displayedUsers.length > 0 && (
                <p className="text-sm text-muted-foreground whitespace-nowrap">
                  {activeTab === "following"
                    ? `${displayedTotal} following`
                    : `${displayedUsers.length} of ${total}`}
                </p>
              )}
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
          {!loading && displayedUsers.length === 0 && (
            <SectionCard useSectionHeader={false}>
              <EmptyState
                icon={activeTab === "following" ? UserCheck : Users}
                title={
                  activeTab === "following"
                    ? "No Following Portfolios"
                    : "No Public Portfolios Yet"
                }
                description={
                  activeTab === "following"
                    ? "You haven't followed anyone with a public portfolio yet. Discover investors in the All tab and follow them!"
                    : "Be the first to share your portfolio with the community! Enable public sharing in your portfolio settings."
                }
              />
            </SectionCard>
          )}

          {/* User Grid */}
          {!loading && displayedUsers.length > 0 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayedUsers.map((u, index) => (
                  <UserCard
                    key={u.user_id}
                    user={u}
                    rank={index + 1}
                    initialIsFollowing={followingIds.has(u.user_id)}
                    onFollowChange={handleFollowChange}
                  />
                ))}
              </div>

              {/* Load More - only show for "All" tab */}
              {activeTab === "all" && hasMore && (
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
              {((activeTab === "all" && !hasMore) ||
                activeTab === "following") &&
                displayedUsers.length > 0 && (
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
