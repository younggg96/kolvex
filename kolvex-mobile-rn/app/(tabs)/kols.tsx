import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Search, Users, TrendingUp } from 'lucide-react-native';
import { Badge, Avatar, PlatformBadge } from '@/components/ui';
import { Header } from '@/components/layout';
import { useTheme } from '@/hooks/useTheme';
import { useKOLProfiles } from '@/hooks/useKOLs';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { formatNumber } from '@/lib/utils';
import type { KOLProfile, Platform } from '@/lib/types';

const PLATFORMS: { label: string; value: Platform | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Twitter', value: 'twitter' },
  { label: 'Reddit', value: 'reddit' },
  { label: 'YouTube', value: 'youtube' },
  { label: '小红书', value: 'xiaohongshu' },
];

export default function KOLsScreen() {
  const router = useRouter();
  const { colors, primary, isDark } = useTheme();

  const [searchQuery, setSearchQuery] = useState('');
  const [activePlatform, setActivePlatform] = useState<Platform | 'all'>('all');
  const [refreshing, setRefreshing] = useState(false);

  const platformFilter = activePlatform === 'all' ? undefined : activePlatform;
  const { data: profilesData, loading, refresh, error } = useKOLProfiles(platformFilter);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const filteredKOLs = useMemo(() => {
    const profiles = profilesData?.profiles || [];
    if (!searchQuery) return profiles;
    return profiles.filter(kol =>
      kol.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (kol.display_name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [profilesData?.profiles, searchQuery]);

  const renderKOLItem = ({ item }: { item: KOLProfile }) => (
    <TouchableOpacity
      style={[styles.kolCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push(`/kol/${item.username}`)}
      activeOpacity={0.7}
    >
      <View style={styles.kolHeader}>
        <Avatar
          name={item.display_name || item.username}
          source={item.avatar_url || undefined}
          size="lg"
        />
        <View style={styles.kolInfo}>
          <View style={styles.kolNameRow}>
            <Text style={[styles.kolName, { color: colors.foreground }]} numberOfLines={1}>
              {item.display_name || item.username}
            </Text>
            <PlatformBadge platform={item.platform} size="sm" />
            {item.is_verified && (
              <Badge variant="primary" size="sm">Verified</Badge>
            )}
          </View>
          <Text style={[styles.kolUsername, { color: colors.mutedForeground }]}>
            @{item.username}
          </Text>
        </View>
      </View>

      {(item.bio || item.description) && (
        <Text style={[styles.kolBio, { color: colors.textSecondary }]} numberOfLines={2}>
          {item.bio || item.description}
        </Text>
      )}

      <View style={styles.kolStats}>
        <View style={styles.kolStat}>
          <Users size={16} color={colors.mutedForeground} />
          <Text style={[styles.kolStatText, { color: colors.foreground }]}>
            {formatNumber(item.followers_count)}
          </Text>
        </View>
        <View style={styles.kolStat}>
          <TrendingUp size={16} color={colors.mutedForeground} />
          <Text style={[styles.kolStatText, { color: colors.foreground }]}>
            {formatNumber(item.following_count)} following
          </Text>
        </View>
      </View>

      {item.location && (
        <Text style={[styles.kolLocation, { color: colors.mutedForeground }]}>
          {item.location}
        </Text>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="KOLs" showNotification />

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.searchBar, { backgroundColor: isDark ? Colors.dark.inputBackground : Colors.light.inputBackground, borderColor: isDark ? Colors.dark.inputBorder : Colors.light.inputBorder }]}>
          <Search size={18} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search KOLs..."
            placeholderTextColor={colors.mutedForeground}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Platform Filters */}
      <View style={styles.filtersContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={PLATFORMS}
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

      {/* KOLs List */}
      <FlatList
        data={filteredKOLs}
        renderItem={renderKOLItem}
        keyExtractor={(item) => `${item.platform}-${item.username}`}
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
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Loading KOLs...
              </Text>
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
                No KOLs found
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
    gap: Spacing.md,
  },
  kolCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
  },
  kolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  kolInfo: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  kolNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  kolName: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    flexShrink: 1,
  },
  kolUsername: {
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  kolBio: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  kolStats: {
    flexDirection: 'row',
    gap: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  kolStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  kolStatText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  kolLocation: {
    fontSize: FontSize.xs,
    marginTop: Spacing.xs,
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
