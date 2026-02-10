import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Star, Trash2, Plus } from 'lucide-react-native';
import { Card, CompanyLogo } from '@/components/ui';
import { Header } from '@/components/layout';
import { useTheme } from '@/hooks/useTheme';
import { useTrackedStocks } from '@/hooks/useStocks';
import { stockApi } from '@/lib/api';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import type { TrackedStock } from '@/lib/types';

export default function TrackedStocksScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, primary } = useTheme();
  const { data: trackedStocks, loading, refresh } = useTrackedStocks();
  const [refreshing, setRefreshing] = useState(false);

  const stocks = trackedStocks || [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleRemove = useCallback(async (stock: TrackedStock) => {
    Alert.alert(
      'Remove Stock',
      `Stop tracking ${stock.symbol}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await stockApi.removeTracked(stock.id);
              await refresh();
            } catch (err) {
              Alert.alert('Error', 'Failed to remove stock');
            }
          },
        },
      ]
    );
  }, [refresh]);

  const renderItem = ({ item }: { item: TrackedStock }) => (
    <TouchableOpacity
      style={[styles.stockItem, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push(`/stock/${item.symbol}`)}
      activeOpacity={0.7}
    >
      <CompanyLogo symbol={item.symbol} name={item.name || undefined} size="lg" />
      <View style={styles.stockInfo}>
        <Text style={[styles.stockSymbol, { color: colors.foreground }]}>{item.symbol}</Text>
        {item.name && (
          <Text style={[styles.stockName, { color: colors.mutedForeground }]} numberOfLines={1}>
            {item.name}
          </Text>
        )}
        {item.notes && (
          <Text style={[styles.stockNotes, { color: colors.mutedForeground }]} numberOfLines={1}>
            {item.notes}
          </Text>
        )}
      </View>
      {item.target_price != null && (
        <Text style={[styles.targetPrice, { color: primary }]}>
          Target: ${item.target_price.toFixed(2)}
        </Text>
      )}
      <TouchableOpacity
        style={styles.removeBtn}
        onPress={() => handleRemove(item)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Trash2 size={18} color={Colors.error} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Tracked Stocks" showBack />

      <FlatList
        data={stocks}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + Spacing.lg }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Loading...</Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Star size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No tracked stocks</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Start tracking stocks from the Stocks tab to see them here.
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { padding: Spacing.lg, gap: Spacing.sm },
  stockItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    gap: Spacing.md,
  },
  stockInfo: { flex: 1 },
  stockSymbol: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
  },
  stockName: {
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  stockNotes: {
    fontSize: FontSize.xs,
    marginTop: 2,
    fontStyle: 'italic',
  },
  targetPrice: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  removeBtn: {
    padding: Spacing.sm,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing['4xl'],
    gap: Spacing.md,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
  },
  emptyText: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
});
