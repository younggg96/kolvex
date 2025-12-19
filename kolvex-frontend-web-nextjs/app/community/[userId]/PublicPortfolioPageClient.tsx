"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Calendar, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PortfolioHoldings from "@/components/portfolio/PortfolioHoldings";
import {
  PublicPortfolioSkeleton,
  PublicPortfolioNotFound,
  FollowButton,
} from "@/components/community";
import { getPublicHoldings } from "@/lib/snaptradeApi";
import { getUserProfile, type UserProfile } from "@/lib/api/users";
import { getFollowStatus } from "@/lib/followApi";
import type { FollowStatus } from "@/lib/supabase/database.types";
import { Card } from "@/components/ui/card";

interface PublicPortfolioPageClientProps {
  userId: string;
}

export function PublicPortfolioPageClient({
  userId,
}: PublicPortfolioPageClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [hasHoldings, setHasHoldings] = useState<boolean | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [followStatus, setFollowStatus] = useState<FollowStatus | null>(null);

  const handleBack = useCallback(() => {
    router.push("/community");
  }, [router]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [holdingsData, profileData, followData] = await Promise.all([
        getPublicHoldings(userId),
        getUserProfile(userId),
        getFollowStatus(userId).catch(() => null),
      ]);

      setHasHoldings(!!holdingsData);
      setUserProfile(profileData);
      setLastSyncedAt(holdingsData?.last_synced_at ?? null);
      setFollowStatus(followData);
    } catch (error) {
      console.error("Failed to load data:", error);
      setHasHoldings(false);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const displayName =
    userProfile?.full_name || userProfile?.username || "Investor";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleFollowChange = (isFollowing: boolean) => {
    setFollowStatus((prev) =>
      prev
        ? {
            ...prev,
            is_following: isFollowing,
            followers_count: isFollowing
              ? prev.followers_count + 1
              : Math.max(0, prev.followers_count - 1),
          }
        : null
    );
  };

  // Loading state
  if (loading) {
    return <PublicPortfolioSkeleton />;
  }

  // Not found state
  if (!hasHoldings) {
    return <PublicPortfolioNotFound onBack={handleBack} />;
  }

  return (
    <DashboardLayout
      title={`${displayName}'s Portfolio`}
      hasSidebarTrigger={false}
      headerLeftAction={
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          onClick={handleBack}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
      }
    >
      <div className="relative flex-1 overflow-y-auto bg-background-light dark:bg-background-dark">
        <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />
        <div className="relative p-4 min-w-0 space-y-3">
          {/* User Profile Header */}
          <Card>
            <div className="flex items-start justify-between p-4">
              <div className="flex items-center gap-4">
                <Avatar className="w-12 h-12 ring-2 ring-primary/20">
                  {userProfile?.avatar_url ? (
                    <AvatarImage
                      src={userProfile.avatar_url}
                      alt={displayName}
                    />
                  ) : null}
                  <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/40 text-primary font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h1 className="text-lg font-bold">{displayName}</h1>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {followStatus && (
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {followStatus.followers_count} followers
                      </span>
                    )}
                    {lastSyncedAt && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Updated {new Date(lastSyncedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <FollowButton
                userId={userId}
                initialIsFollowing={followStatus?.is_following ?? false}
                onFollowChange={handleFollowChange}
              />
            </div>
          </Card>

          {/* Holdings - reuse the same component */}
          <PortfolioHoldings userId={userId} isOwner={false} />
        </div>
      </div>
    </DashboardLayout>
  );
}
