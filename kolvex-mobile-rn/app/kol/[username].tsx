import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Users,
  TrendingUp,
  Share2,
  Bell,
  MessageCircle,
  Heart,
  Repeat2,
  ExternalLink,
  Eye,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Card, Badge, Avatar, PlatformBadge, Skeleton, Button, SentimentBadge } from '@/components/ui';
import { Header } from '@/components/layout';
import { useTheme } from '@/hooks/useTheme';
import { useKOLProfile, useKOLUserPosts, useKOLTrackedCheck } from '@/hooks/useKOLs';
import { kolSubscriptionApi } from '@/lib/api';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { formatNumber, formatRelativeTime } from '@/lib/utils';
import type { KOLPost } from '@/lib/types';

export default function KOLDetailScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, primary } = useTheme();

  // API data
  const { data: kol, loading: profileLoading, error: profileError, refresh: refreshProfile } = useKOLProfile(username || '');
  const { data: posts, loading: postsLoading, loadMore, hasMore } = useKOLUserPosts(username || '');
  const { data: trackedCheck, refresh: refreshTracked } = useKOLTrackedCheck(username || '', kol?.platform || 'twitter');

  const [activeTab, setActiveTab] = useState<'posts' | 'about'>('posts');
  const isFollowing = trackedCheck?.is_tracked || false;

  const handleFollow = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!kol) return;
    try {
      if (isFollowing) {
        await kolSubscriptionApi.removeTracked({ username: kol.username, platform: kol.platform });
      } else {
        await kolSubscriptionApi.addTracked(kol.username, kol.platform);
      }
      await refreshTracked();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update subscription');
    }
  }, [isFollowing, kol, refreshTracked]);

  if (profileLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header title={username || 'KOL'} showBack />
        <View style={styles.loadingContainer}>
          <Skeleton width={96} height={96} borderRadius={48} />
          <Skeleton width={150} height={24} style={{ marginTop: 16 }} />
          <Skeleton width={200} height={16} style={{ marginTop: 8 }} />
        </View>
      </View>
    );
  }

  if (profileError || !kol) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header title={username || 'KOL'} showBack />
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: Colors.error }]}>
            {profileError || 'Failed to load profile'}
          </Text>
          <TouchableOpacity onPress={refreshProfile} style={[styles.retryBtn, { backgroundColor: primary }]}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title=""
        showBack
        transparent
        rightAction={
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: colors.muted }]}
            onPress={() => {}}
          >
            <Share2 size={18} color={colors.foreground} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing['2xl'] }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <Avatar
            name={kol.display_name || kol.username}
            source={kol.avatar_url || undefined}
            size="2xl"
          />
          <View style={styles.profileInfo}>
            <View style={styles.nameRow}>
              <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
                {kol.display_name || kol.username}
              </Text>
              {kol.is_verified && (
                <Badge variant="primary" size="sm">Verified</Badge>
              )}
            </View>
            <View style={styles.usernameRow}>
              <Text style={[styles.username, { color: colors.mutedForeground }]}>
                @{kol.username}
              </Text>
              <PlatformBadge platform={kol.platform} size="sm" />
            </View>
          </View>
        </View>

        {/* Bio */}
        {(kol.bio || kol.description) && (
          <Text style={[styles.bio, { color: colors.textSecondary }]}>
            {kol.bio || kol.description}
          </Text>
        )}

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              {formatNumber(kol.followers_count)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
              Followers
            </Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              {formatNumber(kol.following_count)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
              Following
            </Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              {formatNumber(kol.likes_count)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
              Likes
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <Button
            variant={isFollowing ? 'outline' : 'primary'}
            size="md"
            fullWidth
            onPress={handleFollow}
          >
            {isFollowing ? 'Following' : 'Follow'}
          </Button>
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: colors.muted }]}
            onPress={() => {
              if (kol.profile_url) Linking.openURL(kol.profile_url);
            }}
          >
            <ExternalLink size={20} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        {/* Tab Selector */}
        <View style={[styles.tabSelector, { borderColor: colors.border }]}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'posts' && { borderBottomColor: primary, borderBottomWidth: 2 },
            ]}
            onPress={() => setActiveTab('posts')}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === 'posts' ? primary : colors.mutedForeground },
              ]}
            >
              Recent Posts
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'about' && { borderBottomColor: primary, borderBottomWidth: 2 },
            ]}
            onPress={() => setActiveTab('about')}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === 'about' ? primary : colors.mutedForeground },
              ]}
            >
              About
            </Text>
          </TouchableOpacity>
        </View>

        {/* Posts */}
        {activeTab === 'posts' && (
          <View style={styles.postsContainer}>
            {postsLoading && posts.length === 0 ? (
              <Card>
                <Skeleton width="100%" height={80} />
                <Skeleton width="80%" height={14} style={{ marginTop: 8 }} />
              </Card>
            ) : posts.length > 0 ? (
              <>
                {posts.map((post: KOLPost) => (
                  <Card key={post.id} style={styles.postCard}>
                    <View style={styles.postHeader}>
                      <Avatar
                        name={kol.display_name || kol.username}
                        source={kol.avatar_url || undefined}
                        size="sm"
                      />
                      <View style={styles.postHeaderInfo}>
                        <Text style={[styles.postAuthor, { color: colors.foreground }]}>
                          {kol.display_name || kol.username}
                        </Text>
                        <Text style={[styles.postTime, { color: colors.mutedForeground }]}>
                          {formatRelativeTime(post.created_at ? new Date(post.created_at) : new Date())}
                        </Text>
                      </View>
                      {post.sentiment?.value && post.sentiment.value !== 'neutral' && (
                        <SentimentBadge
                          sentiment={post.sentiment.value as 'bullish' | 'bearish' | 'neutral'}
                          size="sm"
                        />
                      )}
                    </View>

                    {post.title && (
                      <Text style={[styles.postTitle, { color: colors.foreground }]} numberOfLines={2}>
                        {post.title}
                      </Text>
                    )}
                    
                    <Text style={[styles.postContent, { color: colors.foreground }]} numberOfLines={5}>
                      {post.content}
                    </Text>
                    
                    {post.tickers && post.tickers.length > 0 && (
                      <View style={styles.postTickers}>
                        {post.tickers.map((ticker) => (
                          <TouchableOpacity
                            key={ticker}
                            onPress={() => router.push(`/stock/${ticker}`)}
                          >
                            <Badge variant="secondary" size="sm">
                              ${ticker}
                            </Badge>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    {post.summary && (
                      <View style={[styles.summaryBox, { backgroundColor: colors.muted }]}>
                        <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>AI Summary</Text>
                        <Text style={[styles.summaryText, { color: colors.foreground }]} numberOfLines={2}>
                          {post.summary}
                        </Text>
                      </View>
                    )}
                    
                    <View style={styles.postActions}>
                      <View style={styles.postAction}>
                        <Heart size={15} color={colors.mutedForeground} />
                        <Text style={[styles.postActionText, { color: colors.mutedForeground }]}>
                          {formatNumber(post.like_count)}
                        </Text>
                      </View>
                      <View style={styles.postAction}>
                        <MessageCircle size={15} color={colors.mutedForeground} />
                        <Text style={[styles.postActionText, { color: colors.mutedForeground }]}>
                          {formatNumber(post.reply_count)}
                        </Text>
                      </View>
                      <View style={styles.postAction}>
                        <Repeat2 size={15} color={colors.mutedForeground} />
                        <Text style={[styles.postActionText, { color: colors.mutedForeground }]}>
                          {formatNumber(post.repost_count)}
                        </Text>
                      </View>
                      {post.views_count > 0 && (
                        <View style={styles.postAction}>
                          <Eye size={15} color={colors.mutedForeground} />
                          <Text style={[styles.postActionText, { color: colors.mutedForeground }]}>
                            {formatNumber(post.views_count)}
                          </Text>
                        </View>
                      )}
                      {post.permalink && (
                        <TouchableOpacity
                          style={styles.postAction}
                          onPress={() => Linking.openURL(post.permalink!)}
                        >
                          <ExternalLink size={15} color={primary} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </Card>
                ))}
                {hasMore && (
                  <TouchableOpacity
                    onPress={loadMore}
                    style={[styles.loadMoreBtn, { borderColor: primary }]}
                  >
                    <Text style={[styles.loadMoreText, { color: primary }]}>Load More</Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <Card>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  No posts yet
                </Text>
              </Card>
            )}
          </View>
        )}

        {activeTab === 'about' && (
          <Card>
            <View style={styles.aboutSection}>
              {kol.location && (
                <View style={styles.aboutRow}>
                  <Text style={[styles.aboutLabel, { color: colors.mutedForeground }]}>Location</Text>
                  <Text style={[styles.aboutValue, { color: colors.foreground }]}>{kol.location}</Text>
                </View>
              )}
              {kol.website && (
                <View style={styles.aboutRow}>
                  <Text style={[styles.aboutLabel, { color: colors.mutedForeground }]}>Website</Text>
                  <TouchableOpacity onPress={() => Linking.openURL(kol.website!)}>
                    <Text style={[styles.aboutValue, { color: primary }]}>{kol.website}</Text>
                  </TouchableOpacity>
                </View>
              )}
              {kol.join_date && (
                <View style={styles.aboutRow}>
                  <Text style={[styles.aboutLabel, { color: colors.mutedForeground }]}>Joined</Text>
                  <Text style={[styles.aboutValue, { color: colors.foreground }]}>{kol.join_date}</Text>
                </View>
              )}
              <View style={styles.aboutRow}>
                <Text style={[styles.aboutLabel, { color: colors.mutedForeground }]}>Platform</Text>
                <PlatformBadge platform={kol.platform} size="sm" />
              </View>
            </View>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    padding: Spacing.lg,
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  errorText: {
    fontSize: FontSize.base,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: FontWeight.medium,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  profileInfo: {
    marginLeft: Spacing.lg,
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  name: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
    flexShrink: 1,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 4,
  },
  username: {
    fontSize: FontSize.base,
  },
  bio: {
    fontSize: FontSize.base,
    lineHeight: 24,
    marginBottom: Spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Spacing.xl,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
  },
  statLabel: {
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabSelector: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    marginBottom: Spacing.lg,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  tabText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
  },
  postsContainer: {
    gap: Spacing.md,
  },
  postCard: {
    padding: Spacing.md,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  postHeaderInfo: {
    marginLeft: Spacing.sm,
    flex: 1,
  },
  postAuthor: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  postTime: {
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  postTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.xs,
  },
  postContent: {
    fontSize: FontSize.base,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  postTickers: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  summaryBox: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  summaryLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    marginBottom: 4,
  },
  summaryText: {
    fontSize: FontSize.sm,
    lineHeight: 18,
  },
  postActions: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  postAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  postActionText: {
    fontSize: FontSize.sm,
  },
  loadMoreBtn: {
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  loadMoreText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: Spacing['2xl'],
  },
  aboutSection: {
    gap: Spacing.md,
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  aboutLabel: {
    fontSize: FontSize.sm,
  },
  aboutValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
});
