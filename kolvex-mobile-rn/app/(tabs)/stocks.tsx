import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Search } from 'lucide-react-native';
import { Card, Badge, SentimentBadge, SkeletonStockRow, CompanyLogo } from '@/components/ui';
import { Header } from '@/components/layout';
import { useTheme } from '@/hooks/useTheme';
import { useTrendingStocks } from '@/hooks/useStocks';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import { formatNumber } from '@/lib/utils';
import { stockApi } from '@/lib/api';
import type { TrendingStock } from '@/lib/types';

const FILTERS = ['All', 'Bullish', 'Bearish', 'Most Discussed'];

export default function StocksScreen() {
  const router = useRouter();
  const { colors, primary, isDark } = useTheme();

  const { data: trendingStocks, loading, refresh, error } = useTrendingStocks();

  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchResults, setSearchResults] = useState<unknown[] | null>(null);
  const [searching, setSearching] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  // Search stocks when query changes
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.length >= 2) {
      setSearching(true);
      try {
        const results = await stockApi.search(query);
        setSearchResults(results);
      } catch {
        setSearchResults(null);
      } finally {
        setSearching(false);
      }
    } else {
      setSearchResults(null);
    }
  }, []);

  const stocks = trendingStocks || [];

  // Helper to derive sentiment label from score
  const getSentiment = (score: number | null): 'bullish' | 'bearish' | 'neutral' | null => {
    if (score == null) return null;
    if (score > 20) return 'bullish';
    if (score < -20) return 'bearish';
    return 'neutral';
  };

  const filteredStocks = useMemo(() => {
    let filtered = stocks;

    // Apply search filter
    if (searchQuery && !searchResults) {
      filtered = filtered.filter(stock =>
        stock.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (stock.company_name || '').toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply sentiment filter
    if (activeFilter === 'Bullish') {
      filtered = filtered.filter(s => getSentiment(s.sentiment_score) === 'bullish');
    } else if (activeFilter === 'Bearish') {
      filtered = filtered.filter(s => getSentiment(s.sentiment_score) === 'bearish');
    } else if (activeFilter === 'Most Discussed') {
      filtered = [...filtered].sort((a, b) => (b.mention_count || 0) - (a.mention_count || 0));
    }

    return filtered;
  }, [stocks, searchQuery, activeFilter, searchResults]);

  const renderStockItem = ({ item, index }: { item: TrendingStock; index: number }) => {
    const sentiment = getSentiment(item.sentiment_score);
    return (
      <TouchableOpacity
        style={[
          styles.stockItem,
          { backgroundColor: colors.card, borderColor: colors.border },
          index > 0 && { marginTop: Spacing.sm },
        ]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push(`/stock/${item.ticker}`);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.stockLeft}>
          <CompanyLogo symbol={item.ticker} name={item.company_name || undefined} size="lg" />
          <View style={styles.stockInfo}>
            <View style={styles.stockHeader}>
              <Text style={[styles.stockSymbol, { color: colors.foreground }]}>
                {item.ticker}
              </Text>
              {sentiment && (
                <SentimentBadge sentiment={sentiment} size="sm" />
              )}
            </View>
            <Text style={[styles.stockName, { color: colors.mutedForeground }]} numberOfLines={1}>
              {item.company_name || item.ticker}
            </Text>
          </View>
        </View>
        <View style={styles.stockRight}>
          <Text style={[styles.stockMentions, { color: colors.mutedForeground }]}>
            {item.mention_count} mentions
            {item.unique_authors_count ? ` · ${item.unique_authors_count} KOLs` : ''}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Stocks" showNotification />

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.searchBar, { backgroundColor: isDark ? Colors.dark.inputBackground : Colors.light.inputBackground, borderColor: isDark ? Colors.dark.inputBorder : Colors.light.inputBorder }]}>
          <Search size={18} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search stocks..."
            placeholderTextColor={colors.mutedForeground}
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searching && <ActivityIndicator size="small" color={primary} />}
        </View>
      </View>

      {/* Filter Chips */}
      <View style={styles.filtersContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTERS}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.filtersList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterChip,
                {
                  backgroundColor: activeFilter === item ? primary : colors.card,
                  borderColor: activeFilter === item ? primary : colors.border,
                },
              ]}
              onPress={() => setActiveFilter(item)}
            >
              <Text
                style={[
                  styles.filterText,
                  {
                    color: activeFilter === item ? '#FFFFFF' : colors.foreground,
                  },
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Stocks List */}
      <FlatList
        data={filteredStocks}
        renderItem={renderStockItem}
        keyExtractor={(item) => item.ticker}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={primary}
          />
        }
        ListEmptyComponent={
          loading ? (
            <View>
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonStockRow key={i} style={{ marginBottom: Spacing.sm }} />
              ))}
            </View>
          ) : error ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: Colors.error }]}>{error}</Text>
              <TouchableOpacity onPress={onRefresh} style={[styles.retryBtn, { backgroundColor: primary }]}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                No stocks found
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
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.base,
  },
  filtersContainer: {
    paddingBottom: Spacing.md,
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
    paddingTop: 0,
  },
  stockItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
  },
  stockLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  stockInfo: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  stockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  stockSymbol: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
  },
  stockName: {
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  stockRight: {
    alignItems: 'flex-end',
  },
  stockMentions: {
    fontSize: FontSize.xs,
    marginTop: 2,
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
});
