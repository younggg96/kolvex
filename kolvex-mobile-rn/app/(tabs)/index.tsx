import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Search,
  Briefcase,
  MessageCircle,
  Newspaper,
} from 'lucide-react-native';
import { Card, Badge, Avatar, Skeleton, SkeletonStockRow, CompanyLogo } from '@/components/ui';
import { LogoHeader } from '@/components/layout';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useTrendingStocks } from '@/hooks/useStocks';
import { useKOLProfiles, useKOLPosts } from '@/hooks/useKOLs';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { formatNumber, formatRelativeTime } from '@/lib/utils';
import type { TrendingStock, KOLProfile, KOLPost } from '@/lib/types';

export default function HomeScreen() {
  const router = useRouter();
  const { colors, primary, isDark } = useTheme();
  const { user } = useAuth();

  // API data
  const { data: trendingStocks, loading: stocksLoading, refresh: refreshStocks } = useTrendingStocks();
  const { data: kolProfiles, loading: kolsLoading, refresh: refreshKols } = useKOLProfiles();
  const { data: recentPosts, loading: postsLoading, refresh: refreshPosts } = useKOLPosts({ pageSize: 5 });

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshStocks(), refreshKols(), refreshPosts()]);
    setRefreshing(false);
  }, [refreshStocks, refreshKols, refreshPosts]);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const topKols = kolProfiles?.profiles?.slice(0, 5) || [];
  const topStocks = trendingStocks?.slice(0, 5) || [];
  const feedPosts = recentPosts?.slice(0, 3) || [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LogoHeader
        greeting={greeting()}
        username={user?.user_metadata?.username || 'Investor'}
        rightAction={
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/search')}
          >
            <Search size={20} color={colors.foreground} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />
        }
      >
        {/* Trending Stocks */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Trending Stocks
            </Text>
            <TouchableOpacity style={styles.seeAll} onPress={() => router.push('/stocks')}>
              <Text style={[styles.seeAllText, { color: primary }]}>See All</Text>
              <ChevronRight size={16} color={primary} />
            </TouchableOpacity>
          </View>

          <Card padding="none">
            {stocksLoading && topStocks.length === 0
              ? Array.from({ length: 3 }).map((_, i) => <SkeletonStockRow key={i} />)
              : topStocks.map((stock, index) => {
                  const sentiment = stock.sentiment_score != null
                    ? stock.sentiment_score > 20 ? 'bullish' : stock.sentiment_score < -20 ? 'bearish' : 'neutral'
                    : null;
                  return (
                  <TouchableOpacity
                    key={stock.ticker}
                    style={[
                      styles.stockRow,
                      index < topStocks.length - 1 && {
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border,
                      },
                    ]}
                    onPress={() => router.push(`/stock/${stock.ticker}`)}
                    activeOpacity={0.6}
                  >
                    <View style={styles.stockInfo}>
                      <CompanyLogo symbol={stock.ticker} name={stock.company_name || undefined} size="md" />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.stockSymbol, { color: colors.foreground }]}>
                          {stock.ticker}
                        </Text>
                        <Text style={[styles.stockName, { color: colors.mutedForeground }]} numberOfLines={1}>
                          {stock.company_name || stock.ticker}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.stockRight}>
                      <View style={styles.mentionRow}>
                        <Text style={[styles.mentionText, { color: colors.mutedForeground }]}>
                          {stock.mention_count} mentions
                        </Text>
                        {sentiment && (
                          <Badge
                            variant={sentiment === 'bullish' ? 'success' : sentiment === 'bearish' ? 'error' : 'default'}
                            size="sm"
                          >
                            {sentiment}
                          </Badge>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                  );
                })}
            {!stocksLoading && topStocks.length === 0 && (
              <View style={styles.emptyRow}>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No trending stocks</Text>
              </View>
            )}
          </Card>
        </View>

        {/* Top KOLs */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Top KOLs
            </Text>
            <TouchableOpacity style={styles.seeAll} onPress={() => router.push('/kols')}>
              <Text style={[styles.seeAllText, { color: primary }]}>See All</Text>
              <ChevronRight size={16} color={primary} />
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kolsScroll}>
            {kolsLoading && topKols.length === 0
              ? Array.from({ length: 3 }).map((_, i) => (
                  <View key={i} style={[styles.kolCard, { backgroundColor: colors.card }]}>
                    <Skeleton width={56} height={56} borderRadius={28} />
                    <Skeleton width={80} height={14} style={{ marginTop: 8 }} />
                    <Skeleton width={60} height={12} style={{ marginTop: 4 }} />
                  </View>
                ))
              : topKols.map((kol) => (
                  <Card
                    key={kol.username}
                    style={styles.kolCard}
                    onPress={() => router.push(`/kol/${kol.username}`)}
                  >
                    <Avatar
                      name={kol.display_name || kol.username}
                      source={kol.avatar_url || undefined}
                      size="xl"
                    />
                    <Text style={[styles.kolName, { color: colors.foreground }]} numberOfLines={1}>
                      {kol.display_name || kol.username}
                    </Text>
                    <Text style={[styles.kolFollowers, { color: colors.mutedForeground }]}>
                      {formatNumber(kol.followers_count)} followers
                    </Text>
                    <Badge variant="primary" size="sm" style={{ marginTop: 8 }}>
                      {kol.platform}
                    </Badge>
                  </Card>
                ))}
          </ScrollView>
        </View>

        {/* Recent Social Feed */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Latest Posts
            </Text>
            <TouchableOpacity style={styles.seeAll} onPress={() => router.push('/feed')}>
              <Text style={[styles.seeAllText, { color: primary }]}>See All</Text>
              <ChevronRight size={16} color={primary} />
            </TouchableOpacity>
          </View>

          {postsLoading && feedPosts.length === 0 ? (
            <Card>
              <Skeleton width="100%" height={60} />
              <Skeleton width="80%" height={14} style={{ marginTop: 8 }} />
            </Card>
          ) : feedPosts.length > 0 ? (
            feedPosts.map((post) => (
              <Card key={post.id} style={styles.postCard}>
                <View style={styles.postHeader}>
                  <Avatar
                    name={post.display_name || post.username}
                    source={post.avatar_url || undefined}
                    size="sm"
                  />
                  <View style={styles.postHeaderInfo}>
                    <Text style={[styles.postAuthor, { color: colors.foreground }]}>
                      {post.display_name || post.username}
                    </Text>
                    <Text style={[styles.postTime, { color: colors.mutedForeground }]}>
                      {formatRelativeTime(post.created_at ? new Date(post.created_at) : new Date())}
                    </Text>
                  </View>
                  {post.sentiment?.value && post.sentiment.value !== 'neutral' && (
                    <Badge
                      variant={post.sentiment.value === 'bullish' ? 'success' : 'error'}
                      size="sm"
                    >
                      {post.sentiment.value}
                    </Badge>
                  )}
                </View>
                <Text style={[styles.postContent, { color: colors.foreground }]} numberOfLines={3}>
                  {post.content}
                </Text>
                {post.tickers && post.tickers.length > 0 && (
                  <View style={styles.postTickers}>
                    {post.tickers.slice(0, 3).map((ticker) => (
                      <TouchableOpacity key={ticker} onPress={() => router.push(`/stock/${ticker}`)}>
                        <Badge variant="secondary" size="sm">${ticker}</Badge>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </Card>
            ))
          ) : (
            <Card>
              <Text style={[styles.emptyText, { color: colors.mutedForeground, textAlign: 'center', padding: Spacing.lg }]}>
                No posts yet
              </Text>
            </Card>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: Spacing.md }]}>
            Quick Actions
          </Text>
          <View style={styles.quickActions}>
            {[
              { icon: Newspaper, label: 'Social Feed', color: Colors.info, route: '/feed' },
              { icon: MessageCircle, label: 'AI Analysis', color: primary, route: '/chat' },
            ].map((action) => (
              <Card
                key={action.label}
                style={styles.quickAction}
                onPress={() => router.push(action.route)}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: `${action.color}15` }]}>
                  <action.icon size={24} color={action.color} />
                </View>
                <Text style={[styles.quickActionText, { color: colors.foreground }]}>
                  {action.label}
                </Text>
              </Card>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  actionButton: { padding: 6 },
  scrollView: { flex: 1 },
  scrollContent: { padding: Spacing.lg, paddingBottom: Spacing['4xl'] },

  // Section
  section: { marginBottom: Spacing.xl },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  seeAll: { flexDirection: 'row', alignItems: 'center' },
  seeAllText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },

  // Stock Row
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  stockInfo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
  stockSymbol: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  stockName: { fontSize: FontSize.sm, maxWidth: 120 },
  stockRight: { alignItems: 'flex-end' },
  mentionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  mentionText: { fontSize: FontSize.xs },
  emptyRow: { padding: Spacing.lg, alignItems: 'center' },
  emptyText: { fontSize: FontSize.sm },

  // KOLs
  kolsScroll: { paddingRight: Spacing.lg, gap: Spacing.md },
  kolCard: { width: 140, alignItems: 'center', padding: Spacing.lg },
  kolName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  kolFollowers: { fontSize: FontSize.xs, marginTop: 4 },

  // Posts
  postCard: { padding: Spacing.md, marginBottom: Spacing.sm },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  postHeaderInfo: { marginLeft: Spacing.sm, flex: 1 },
  postAuthor: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  postTime: { fontSize: FontSize.xs, marginTop: 2 },
  postContent: { fontSize: FontSize.sm, lineHeight: 20, marginBottom: Spacing.sm },
  postTickers: { flexDirection: 'row', gap: Spacing.xs },

  // Quick Actions
  quickActions: { flexDirection: 'row', gap: Spacing.md },
  quickAction: { flex: 1, alignItems: 'center', padding: Spacing.lg },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  quickActionText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
});
