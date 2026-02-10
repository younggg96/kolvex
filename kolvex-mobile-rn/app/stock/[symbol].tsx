import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Linking,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  TrendingUp,
  TrendingDown,
  Star,
  Share2,
  Bell,
  MessageCircle,
  Users,
  BarChart3,
  Heart,
  ExternalLink,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Card, Badge, SentimentBadge, Avatar, Skeleton, CompanyLogo } from '@/components/ui';
import { Header } from '@/components/layout';
import { useTheme } from '@/hooks/useTheme';
import { useStockOverview, useStockDiscussions, useTrackedStockCheck } from '@/hooks/useStocks';
import { stockApi } from '@/lib/api';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { formatCurrency, formatPercent, formatNumber, formatRelativeTime } from '@/lib/utils';
import type { KOLPost } from '@/lib/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TIME_PERIODS = ['1D', '1W', '1M', '3M', '1Y', 'ALL'];

export default function StockDetailScreen() {
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, primary } = useTheme();

  // API data
  const { data: overview, loading: overviewLoading, error: overviewError, refresh: refreshOverview } = useStockOverview(symbol || '');
  const { data: discussions, loading: discussionsLoading, loadMore, hasMore } = useStockDiscussions(symbol || '');
  const { data: trackedCheck, refresh: refreshTracked } = useTrackedStockCheck(symbol || '');

  const [selectedPeriod, setSelectedPeriod] = useState('1D');
  const [activeTab, setActiveTab] = useState<'overview' | 'discussions'>('overview');

  const stock = overview?.quote;
  const isPositive = (stock?.change || 0) >= 0;
  const isTracked = trackedCheck?.is_tracked || false;

  const handleTrack = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      if (isTracked && trackedCheck?.stock_id) {
        await stockApi.removeTracked(trackedCheck.stock_id);
      } else {
        await stockApi.addTracked(symbol || '');
      }
      await refreshTracked();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update tracked stock');
    }
  }, [isTracked, trackedCheck?.stock_id, symbol, refreshTracked]);

  if (overviewLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header title={symbol || 'Stock'} showBack />
        <View style={styles.loadingContainer}>
          <Skeleton width={120} height={32} />
          <Skeleton width={200} height={48} style={{ marginTop: 16 }} />
          <Skeleton width="100%" height={200} style={{ marginTop: 24 }} />
        </View>
      </View>
    );
  }

  if (overviewError || !stock) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header title={symbol || 'Stock'} showBack />
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: Colors.error }]}>
            {overviewError || 'Failed to load stock data'}
          </Text>
          <TouchableOpacity onPress={refreshOverview} style={[styles.retryBtn, { backgroundColor: primary }]}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title={symbol || 'Stock'}
        showBack
        rightAction={
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.headerButton, { backgroundColor: colors.muted }]}
              onPress={() => {}}
            >
              <Share2 size={18} color={colors.foreground} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerButton, { backgroundColor: isTracked ? `${primary}20` : colors.muted }]}
              onPress={handleTrack}
            >
              <Star size={18} color={isTracked ? primary : colors.foreground} fill={isTracked ? primary : 'transparent'} />
            </TouchableOpacity>
          </View>
        }
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing['2xl'] }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Stock Header */}
        <View style={styles.stockHeader}>
          <View style={styles.stockTitleRow}>
            <CompanyLogo symbol={stock.symbol} name={stock.name} size="xl" />
            <View>
              <Text style={[styles.stockSymbol, { color: colors.foreground }]}>
                {stock.symbol}
              </Text>
              <Text style={[styles.stockName, { color: colors.mutedForeground }]}>
                {stock.name}
              </Text>
            </View>
          </View>
        </View>

        {/* Price Section */}
        <View style={styles.priceSection}>
          <Text style={[styles.price, { color: colors.foreground }]}>
            {formatCurrency(stock.price)}
          </Text>
          <View style={styles.changeRow}>
            {isPositive ? (
              <TrendingUp size={20} color={Colors.success} />
            ) : (
              <TrendingDown size={20} color={Colors.error} />
            )}
            <Text
              style={[
                styles.changeText,
                { color: isPositive ? Colors.success : Colors.error },
              ]}
            >
              {isPositive ? '+' : ''}{formatCurrency(stock.change)} ({formatPercent(stock.changePercent)})
            </Text>
          </View>
        </View>

        {/* Chart Placeholder */}
        <Card style={styles.chartCard}>
          <View style={[styles.chartPlaceholder, { borderColor: colors.border }]}>
            <BarChart3 size={48} color={colors.mutedForeground} />
            <Text style={[styles.chartPlaceholderText, { color: colors.mutedForeground }]}>
              Price Chart
            </Text>
          </View>
          
          {/* Time Period Selector */}
          <View style={styles.periodSelector}>
            {TIME_PERIODS.map((period) => (
              <TouchableOpacity
                key={period}
                style={[
                  styles.periodButton,
                  {
                    backgroundColor: selectedPeriod === period ? primary : 'transparent',
                  },
                ]}
                onPress={() => setSelectedPeriod(period)}
              >
                <Text
                  style={[
                    styles.periodText,
                    {
                      color: selectedPeriod === period ? '#FFFFFF' : colors.mutedForeground,
                    },
                  ]}
                >
                  {period}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Tab Selector */}
        <View style={[styles.tabSelector, { borderColor: colors.border }]}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'overview' && { borderBottomColor: primary, borderBottomWidth: 2 },
            ]}
            onPress={() => setActiveTab('overview')}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === 'overview' ? primary : colors.mutedForeground },
              ]}
            >
              Overview
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'discussions' && { borderBottomColor: primary, borderBottomWidth: 2 },
            ]}
            onPress={() => setActiveTab('discussions')}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === 'discussions' ? primary : colors.mutedForeground },
              ]}
            >
              KOL Discussions
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'overview' ? (
          /* Key Stats */
          <Card>
            <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: Spacing.md }]}>
              Key Statistics
            </Text>
            <View style={styles.statsGrid}>
              {[
                { label: 'Open', value: formatCurrency(stock.open) },
                { label: 'High', value: formatCurrency(stock.high) },
                { label: 'Low', value: formatCurrency(stock.low) },
                { label: 'Prev Close', value: formatCurrency(stock.previousClose) },
                { label: 'Volume', value: formatNumber(stock.volume) },
                { label: 'Avg Volume', value: formatNumber(stock.avgVolume) },
                { label: 'Market Cap', value: formatNumber(stock.marketCap) },
                { label: 'P/E Ratio', value: stock.pe ? stock.pe.toFixed(2) : 'N/A' },
                { label: 'EPS', value: stock.eps ? `$${stock.eps.toFixed(2)}` : 'N/A' },
                { label: 'Beta', value: stock.beta ? stock.beta.toFixed(2) : 'N/A' },
                { label: '52W High', value: formatCurrency(stock.fiftyTwoWeekHigh) },
                { label: '52W Low', value: formatCurrency(stock.fiftyTwoWeekLow) },
              ].map((stat) => (
                <View key={stat.label} style={styles.statRow}>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{stat.label}</Text>
                  <Text style={[styles.statValue, { color: colors.foreground }]}>{stat.value}</Text>
                </View>
              ))}
            </View>
          </Card>
        ) : (
          /* Discussions from KOLs */
          <View style={styles.discussionsContainer}>
            {discussionsLoading && discussions.length === 0 ? (
              <Card>
                <Skeleton width="100%" height={80} />
                <Skeleton width="80%" height={14} style={{ marginTop: 8 }} />
              </Card>
            ) : discussions.length > 0 ? (
              discussions.map((post: KOLPost) => (
                <Card key={post.id} style={styles.discussionCard}>
                  <View style={styles.discussionHeader}>
                    <Avatar
                      name={post.display_name || post.username}
                      source={post.avatar_url || undefined}
                      size="sm"
                    />
                    <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                      <Text style={[styles.discussionUsername, { color: colors.foreground }]}>
                        {post.display_name || post.username}
                      </Text>
                      <Text style={[styles.discussionTime, { color: colors.mutedForeground }]}>
                        {formatRelativeTime(post.created_at ? new Date(post.created_at) : new Date())}
                      </Text>
                    </View>
                    {post.sentiment?.value && (
                      <SentimentBadge
                        sentiment={post.sentiment.value as 'bullish' | 'bearish' | 'neutral'}
                        size="sm"
                      />
                    )}
                  </View>
                  <Text style={[styles.discussionContent, { color: colors.foreground }]} numberOfLines={4}>
                    {post.content}
                  </Text>
                  {post.trading_signal?.action && (
                    <Badge
                      variant={post.trading_signal.action === 'buy' ? 'success' : post.trading_signal.action === 'sell' ? 'error' : 'warning'}
                      size="sm"
                      style={{ alignSelf: 'flex-start', marginBottom: Spacing.sm }}
                    >
                      {post.trading_signal.action.toUpperCase()}
                    </Badge>
                  )}
                  <View style={styles.discussionFooter}>
                    <View style={styles.discussionStat}>
                      <Heart size={14} color={colors.mutedForeground} />
                      <Text style={[styles.discussionStatText, { color: colors.mutedForeground }]}>
                        {formatNumber(post.like_count)}
                      </Text>
                    </View>
                    <View style={styles.discussionStat}>
                      <MessageCircle size={14} color={colors.mutedForeground} />
                      <Text style={[styles.discussionStatText, { color: colors.mutedForeground }]}>
                        {formatNumber(post.reply_count)}
                      </Text>
                    </View>
                    {post.permalink && (
                      <TouchableOpacity
                        style={styles.discussionStat}
                        onPress={() => Linking.openURL(post.permalink!)}
                      >
                        <ExternalLink size={14} color={primary} />
                      </TouchableOpacity>
                    )}
                  </View>
                </Card>
              ))
            ) : (
              <Card>
                <Text style={[styles.emptyText, { color: colors.mutedForeground, textAlign: 'center', padding: Spacing.lg }]}>
                  No discussions found for {symbol}
                </Text>
              </Card>
            )}
            {hasMore && discussions.length > 0 && (
              <TouchableOpacity
                onPress={loadMore}
                style={[styles.loadMoreBtn, { borderColor: primary }]}
              >
                <Text style={[styles.loadMoreText, { color: primary }]}>Load More</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      {/* Bottom Action Bar */}
      <View
        style={[
          styles.actionBar,
          { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom || Spacing.md },
        ]}
      >
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: `${primary}15`, borderColor: primary }]}
          onPress={() => router.push(`/chat?stock=${symbol}`)}
        >
          <MessageCircle size={20} color={primary} />
          <Text style={[styles.actionButtonText, { color: primary }]}>
            Ask AI
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: primary }]}
          onPress={() => {}}
        >
          <Bell size={20} color="#FFFFFF" />
          <Text style={[styles.actionButtonText, { color: '#FFFFFF' }]}>
            Set Alert
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
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
  retryText: {
    color: '#FFFFFF',
    fontWeight: FontWeight.medium,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  stockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  stockTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  stockSymbol: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
  },
  stockName: {
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  priceSection: {
    marginBottom: Spacing.xl,
  },
  price: {
    fontSize: FontSize['4xl'],
    fontWeight: FontWeight.bold,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  changeText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
  },
  chartCard: {
    marginBottom: Spacing.lg,
  },
  chartPlaceholder: {
    height: 200,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartPlaceholderText: {
    fontSize: FontSize.sm,
    marginTop: Spacing.sm,
  },
  periodSelector: {
    flexDirection: 'row',
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  periodButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  periodText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
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
  statsGrid: {
    gap: Spacing.md,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  statLabel: {
    fontSize: FontSize.sm,
  },
  statValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  discussionsContainer: {
    gap: Spacing.md,
  },
  discussionCard: {
    padding: Spacing.md,
  },
  discussionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  discussionUsername: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  discussionTime: {
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  discussionContent: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  discussionFooter: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  discussionStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  discussionStatText: {
    fontSize: FontSize.xs,
  },
  emptyText: {
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
  actionBar: {
    flexDirection: 'row',
    padding: Spacing.lg,
    gap: Spacing.md,
    borderTopWidth: 1,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  actionButtonText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
  },
});
