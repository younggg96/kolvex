"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Eye,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Briefcase,
  Users,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import CompanyLogo from "@/components/ui/company-logo";
import { formatCurrency, formatPercent } from "@/lib/snaptradeApi";
import type { PublicUserSummary } from "@/lib/supabase/database.types";
import { RankBadge } from "./RankBadge";
import { FollowButton } from "./FollowButton";
import { getFollowStatus } from "@/lib/followApi";

interface UserCardProps {
  user: PublicUserSummary;
  rank: number;
  initialIsFollowing?: boolean;
}

export function UserCard({ user, rank, initialIsFollowing }: UserCardProps) {
  const router = useRouter();
  const isProfit = (user.total_pnl ?? 0) >= 0;
  const displayName = user.full_name || user.username || "Investor";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Check if values are hidden (null)
  const hasPnl = user.total_pnl !== null;
  const hasPnlPercent = user.pnl_percent !== null;

  // Follow state
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing ?? false);
  const [followersCount, setFollowersCount] = useState(0);

  // Fetch follow status on mount if not provided
  useEffect(() => {
    if (initialIsFollowing === undefined) {
      getFollowStatus(user.user_id)
        .then((status) => {
          setIsFollowing(status.is_following);
          setFollowersCount(status.followers_count);
        })
        .catch(() => {
          // Ignore errors - user might not be logged in
        });
    }
  }, [user.user_id, initialIsFollowing]);

  const handleFollowChange = (newIsFollowing: boolean) => {
    setIsFollowing(newIsFollowing);
    setFollowersCount((prev) =>
      newIsFollowing ? prev + 1 : Math.max(0, prev - 1)
    );
  };

  return (
    <div className="group bg-white dark:bg-card-dark border border-border-light dark:border-border-dark rounded-lg p-4 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30 dark:hover:border-primary/30 transition-all duration-300">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar className="w-8 h-8 ring-2 ring-primary/20 group-hover:ring-primary/40 transition-all">
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
            <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-primary transition-colors text-sm">
              {displayName}
            </h3>
            {followersCount > 0 && (
              <div className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-white/40">
                <Users className="w-3 h-3" />
                <span>{followersCount} followers</span>
              </div>
            )}
          </div>
        </div>
        {/* Last Synced */}
        {user.last_synced_at && (
          <p className="text-xs text-gray-400 dark:text-white/30">
            Updated {new Date(user.last_synced_at).toLocaleDateString()}
          </p>
        )}
      </div>
      {/* Stats */}
      {(user.total_value !== null || user.total_pnl !== null) && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          {user.total_value !== null && (
            <div className="bg-gray-50 dark:bg-white/5 rounded-lg p-3">
              <p className="text-[10px] text-gray-500 dark:text-white/50 uppercase tracking-wider mb-1 font-medium">
                Portfolio Value
              </p>
              <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">
                {formatCurrency(user.total_value)}
              </p>
            </div>
          )}
          {user.total_pnl !== null && (
            <div
              className={`rounded-lg p-3 ${
                hasPnl
                  ? isProfit
                    ? "bg-green-50 dark:bg-green-500/10"
                    : "bg-red-50 dark:bg-red-500/10"
                  : "bg-gray-50 dark:bg-white/5"
              }`}
            >
              <p className="text-[10px] text-gray-500 dark:text-white/50 uppercase tracking-wider mb-1 font-medium">
                Total P&L
              </p>
              {hasPnl ? (
                <>
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
                  {hasPnlPercent && (
                    <p
                      className={`text-[10px] ${
                        isProfit
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {formatPercent(user.pnl_percent!)}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-lg font-bold text-gray-400 dark:text-white/40 tabular-nums">
                  —
                </p>
              )}
            </div>
          )}
        </div>
      )}
      {/* Positions Count */}
      {user.positions_count !== null && (
        <div className="flex items-center gap-2 mb-3">
          <Briefcase className="w-3.5 h-3.5 text-gray-400 dark:text-white/40" />
          <span className="text-xs text-gray-500 dark:text-white/50">
            {`${user.positions_count} positions`}
          </span>
        </div>
      )}
      {/* Top Holdings */}
      {user.top_positions.length > 0 && (
        <div>
          <p className="text-[10px] text-gray-500 dark:text-white/50 uppercase tracking-wider mb-2 font-medium">
            Top Positions
          </p>
          <div className="flex flex-wrap gap-1.5">
            {user.top_positions.slice(0, 5).map((pos, i) => (
              <div
                key={i}
                className="cursor-pointer flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-white/5 rounded-full group/chip hover:bg-primary/60 dark:hover:bg-primary/50 dark:hover:border-primary transition-colors"
                onClick={() => router.push(`/dashboard/stock/${pos.symbol}`)}
              >
                <CompanyLogo symbol={pos.symbol} name={pos.symbol} size="xs" />
                <span className="text-xs font-medium text-gray-700 dark:text-white/80">
                  {pos.symbol}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Follow and View Button */}
      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/5">
        <div className="flex items-center gap-2">
          <FollowButton
            userId={user.user_id}
            initialIsFollowing={isFollowing}
            onFollowChange={handleFollowChange}
            size="sm"
          />
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-1 text-gray-400 dark:text-white/40 group-hover:text-primary transition-colors border-border-light dark:border-border-dark group-hover:border-primary dark:group-hover:border-primary/60 group-hover:!bg-primary/10"
            onClick={() => router.push(`/community/${user.user_id}`)}
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="text-xs">View</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Button>
        </div>
      </div>
    </div>
  );
}
