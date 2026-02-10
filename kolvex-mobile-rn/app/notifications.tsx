import React, { useCallback } from 'react';
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
import { Bell, BellOff, Check, CheckCheck, Trash2 } from 'lucide-react-native';
import { Card, Badge } from '@/components/ui';
import { Header } from '@/components/layout';
import { useTheme } from '@/hooks/useTheme';
import { useNotifications } from '@/hooks/useUserProfile';
import { notificationApi } from '@/lib/api';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { formatRelativeTime } from '@/lib/utils';
import type { Notification } from '@/lib/types';

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, primary } = useTheme();
  const { data: notifData, loading, refresh } = useNotifications();

  const notifications = notifData?.notifications || [];
  const unreadCount = notifData?.unread_count || 0;

  const handleMarkAsRead = useCallback(async (id: string) => {
    try {
      await notificationApi.markAsRead(id);
      await refresh();
    } catch (err) {
      Alert.alert('Error', 'Failed to mark as read');
    }
  }, [refresh]);

  const handleMarkAllAsRead = useCallback(async () => {
    try {
      await notificationApi.markAllAsRead();
      await refresh();
    } catch (err) {
      Alert.alert('Error', 'Failed to mark all as read');
    }
  }, [refresh]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await notificationApi.deleteNotification(id);
      await refresh();
    } catch (err) {
      Alert.alert('Error', 'Failed to delete notification');
    }
  }, [refresh]);

  const renderNotification = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[
        styles.notifItem,
        { backgroundColor: item.is_read ? colors.card : `${primary}08`, borderColor: colors.border },
      ]}
      onPress={() => {
        if (!item.is_read) handleMarkAsRead(item.id);
      }}
      activeOpacity={0.7}
    >
      <View style={styles.notifContent}>
        <View style={styles.notifHeader}>
          <View style={[styles.notifDot, { backgroundColor: item.is_read ? 'transparent' : primary }]} />
          <Text style={[styles.notifTitle, { color: colors.foreground }]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={[styles.notifTime, { color: colors.mutedForeground }]}>
            {formatRelativeTime(item.created_at)}
          </Text>
        </View>
        <Text style={[styles.notifMessage, { color: colors.mutedForeground }]} numberOfLines={2}>
          {item.message}
        </Text>
        {item.type && (
          <Badge variant="secondary" size="sm" style={{ alignSelf: 'flex-start', marginTop: Spacing.xs }}>
            {item.type}
          </Badge>
        )}
      </View>
      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={() => handleDelete(item.id)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Trash2 size={16} color={colors.mutedForeground} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title="Notifications"
        showBack
        rightAction={
          unreadCount > 0 ? (
            <TouchableOpacity
              style={[styles.markAllBtn, { backgroundColor: colors.muted }]}
              onPress={handleMarkAllAsRead}
            >
              <CheckCheck size={18} color={primary} />
            </TouchableOpacity>
          ) : undefined
        }
      />

      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + Spacing.lg }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading && notifications.length > 0} onRefresh={refresh} tintColor={primary} />
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Loading...</Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <BellOff size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No notifications</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                You're all caught up! Check back later.
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
  markAllBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifItem: {
    flexDirection: 'row',
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
  },
  notifContent: { flex: 1 },
  notifHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: 4,
  },
  notifDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  notifTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    flex: 1,
  },
  notifTime: {
    fontSize: FontSize.xs,
  },
  notifMessage: {
    fontSize: FontSize.sm,
    lineHeight: 18,
    marginLeft: 20,
  },
  deleteBtn: {
    padding: Spacing.sm,
    alignSelf: 'flex-start',
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
  },
});
