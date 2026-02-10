import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Heart,
  MessageCircle,
  Repeat2,
  ExternalLink,
  Bookmark,
  Eye,
  TrendingUp,
  TrendingDown,
} from 'lucide-react-native';
import { Card, Badge, Avatar, SentimentBadge, PlatformBadge } from '@/components/ui';
import { Header } from '@/components/layout';
import { useTheme } from '@/hooks/useTheme';
import { useKOLPosts } from '@/hooks/useKOLs';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { formatNumber, formatRelativeTime } from '@/lib/utils';
import type { KOLPost, Platform } from '@/lib/types';

const PLATFORM_FILTERS: { label: string; value: Platform | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Twitter', value: 'twitter' },
  { label: '小红书', value: 'xiaohongshu' },
  { label: 'Reddit', value: 'reddit' },
  { label: 'YouTube', value: 'youtube' },
];

function PostCard({ post, onPress }: { post: KOLPost; onPress: () => void }) {
  const router = useRouter();
  const { colors, primary } = useTheme();
  const sentiment = post.sentiment?.value;

  return (
    <Card style={styles.postCard} onPress={onPress}>
      {/* Post Header */}
      <View style={styles.postHeader}>
        <Avatar
          name={post.display_name || post.username}
          source={post.avatar_url || undefined}
          size="md"
        />
        <View style={styles.postHeaderInfo}>
          <View style={styles.postNameRow}>
            <Text style={[styles.postDisplayName, { color: colors.foreground }]} numberOfLines={1}>
              {post.display_name || post.username}
            </Text>
            <PlatformBadge platform={post.platform} size="sm" />
          </View>
          <View style={styles.postMetaRow}>
            <Text style={[styles.postUsername, { color: colors.mutedForeground }]}>
              @{post.username}
            </Text>
            <Text style={[styles.postDot, { color: colors.mutedForeground }]}>·</Text>
            <Text style={[styles.postTime, { color: colors.mutedForeground }]}>
              {formatRelativeTime(post.created_at ? new Date(post.created_at) : new Date())}
            </Text>
          </View>
        </View>
        {sentiment && sentiment !== 'neutral' && (
          <SentimentBadge sentiment={sentiment as 'bullish' | 'bearish' | 'neutral'} size="sm" />
        )}
      </View>

      {/* Post Title (for Xiaohongshu) */}
      {post.title && (
        <Text style={[styles.postTitle, { color: colors.foreground }]} numberOfLines={2}>
          {post.title}
        </Text>
      )}

      {/* Post Content */}
      <Text style={[styles.postContent, { color: colors.foreground }]} numberOfLines={6}>
        {post.content}
      </Text>

      {/* Cover Image (for Xiaohongshu) */}
      {post.cover_url && (
        <Image source={{ uri: post.cover_url }} style={styles.coverImage} resizeMode="cover" />
      )}

      {/* Media */}
      {post.media_urls && post.media_urls.length > 0 && !post.cover_url && (
        <View style={styles.mediaContainer}>
          {post.media_urls.slice(0, 4).map((media, index) => (
            media.url ? (
              <Image
                key={index}
                source={{ uri: media.url }}
                style={[
                  styles.mediaImage,
                  post.media_urls!.length === 1 && styles.mediaSingle,
                ]}
                resizeMode="cover"
              />
            ) : null
          ))}
        </View>
      )}

      {/* Tickers / Stock Tags */}
      {post.tickers && post.tickers.length > 0 && (
        <View style={styles.tickersRow}>
          {post.tickers.slice(0, 5).map((ticker) => (
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

      {/* AI Tags */}
      {post.ai_tags && post.ai_tags.length > 0 && (
        <View style={styles.tagsRow}>
          {post.ai_tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="outline" size="sm">
              {tag}
            </Badge>
          ))}
        </View>
      )}

      {/* Trading Signal */}
      {post.trading_signal?.action && (
        <View style={[styles.tradingSignal, {
          backgroundColor: post.trading_signal.action === 'buy'
            ? `${Colors.success}10`
            : post.trading_signal.action === 'sell'
              ? `${Colors.error}10`
              : `${Colors.warning}10`,
        }]}>
          {post.trading_signal.action === 'buy' ? (
            <TrendingUp size={14} color={Colors.success} />
          ) : post.trading_signal.action === 'sell' ? (
            <TrendingDown size={14} color={Colors.error} />
          ) : null}
          <Text style={[styles.tradingSignalText, {
            color: post.trading_signal.action === 'buy'
              ? Colors.success
              : post.trading_signal.action === 'sell'
                ? Colors.error
                : Colors.warning,
          }]}>
            {post.trading_signal.action.toUpperCase()} Signal
            {post.trading_signal.confidence
              ? ` (${Math.round(post.trading_signal.confidence * 100)}%)`
              : ''}
          </Text>
        </View>
      )}

      {/* Summary */}
      {post.summary && (
        <View style={[styles.summaryContainer, { backgroundColor: colors.muted }]}>
          <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>AI Summary</Text>
          <Text style={[styles.summaryText, { color: colors.foreground }]} numberOfLines={3}>
            {post.summary}
          </Text>
        </View>
      )}

      {/* Engagement Stats */}
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
  );
}

export default function FeedScreen() {
  const router = useRouter();
  const { colors, primary, isDark } = useTheme();

  const [activePlatform, setActivePlatform] = useState<Platform | 'all'>('all');

  const params = useMemo(() => ({
    platform: activePlatform === 'all' ? undefined : activePlatform,
  }), [activePlatform]);

  const { data: posts, loading, loadingMore, hasMore, refresh, loadMore, error } = useKOLPosts(params);

  const handlePostPress = useCallback((post: KOLPost) => {
    if (post.permalink) {
      Linking.openURL(post.permalink);
    }
  }, []);

  const renderPost = useCallback(({ item }: { item: KOLPost }) => (
    <PostCard post={item} onPress={() => handlePostPress(item)} />
  ), [handlePostPress]);

  const renderFooter = useCallback(() => {
    if (!loadingMore) return null;
    return (
      <View style={styles.loadingMore}>
        <Text style={[styles.loadingMoreText, { color: colors.mutedForeground }]}>
          Loading more posts...
        </Text>
      </View>
    );
  }, [loadingMore, colors.mutedForeground]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Social Feed" showNotification />

      {/* Platform Filters */}
      <View style={styles.filtersContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={PLATFORM_FILTERS}
          keyExtractor={(item) => item.value}
          contentContainerStyle={styles.filtersList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterChip,
                {
                  backgroundColor: activePlatform === item.value ? primary : colors.card,
                  borderColor: activePlatform === item.value ? primary : colors.border,
                },
              ]}
              onPress={() => setActivePlatform(item.value)}
            >
              <Text
                style={[
                  styles.filterText,
                  { color: activePlatform === item.value ? '#FFFFFF' : colors.foreground },
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Posts List */}
      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading && posts.length > 0} onRefresh={refresh} tintColor={primary} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Loading posts...
              </Text>
            </View>
          ) : error ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: Colors.error }]}>
                {error}
              </Text>
              <TouchableOpacity onPress={refresh} style={[styles.retryButton, { backgroundColor: primary }]}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                No posts found
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filtersContainer: {
    paddingVertical: Spacing.sm,
  },
  filtersList: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  filterText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  listContent: {
    padding: Spacing.lg,
    paddingTop: Spacing.sm,
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
  postNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  postDisplayName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    flexShrink: 1,
  },
  postMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  postUsername: {
    fontSize: FontSize.xs,
  },
  postDot: {
    fontSize: FontSize.xs,
  },
  postTime: {
    fontSize: FontSize.xs,
  },
  postTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.xs,
    lineHeight: 22,
  },
  postContent: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  coverImage: {
    width: '100%',
    height: 200,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  mediaContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  mediaImage: {
    width: '48%',
    height: 150,
    borderRadius: BorderRadius.md,
  },
  mediaSingle: {
    width: '100%',
    height: 200,
  },
  tickersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  tradingSignal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    alignSelf: 'flex-start',
  },
  tradingSignalText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  summaryContainer: {
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
    paddingTop: Spacing.xs,
  },
  postAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  postActionText: {
    fontSize: FontSize.xs,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing['4xl'],
  },
  emptyText: {
    fontSize: FontSize.base,
  },
  retryButton: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  loadingMore: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  loadingMoreText: {
    fontSize: FontSize.sm,
  },
});
