import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  User,
  Settings,
  Bell,
  Shield,
  CreditCard,
  HelpCircle,
  LogOut,
  ChevronRight,
  Moon,
  Briefcase,
  Star,
  Share2,
} from 'lucide-react-native';
import { Card, Avatar, Badge } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useUserProfile, useUnreadNotificationCount } from '@/hooks/useUserProfile';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  value?: string;
  badge?: string;
  onPress: () => void;
  danger?: boolean;
}

function MenuItem({ icon, label, value, badge, onPress, danger }: MenuItemProps) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      style={[styles.menuItem, { borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.menuIconContainer, { backgroundColor: danger ? `${Colors.error}15` : colors.muted }]}>
        {icon}
      </View>
      <View style={styles.menuContent}>
        <Text style={[styles.menuLabel, { color: danger ? Colors.error : colors.foreground }]}>
          {label}
        </Text>
        {value && (
          <Text style={[styles.menuValue, { color: colors.mutedForeground }]}>
            {value}
          </Text>
        )}
      </View>
      {badge && <Badge variant="primary" size="sm">{badge}</Badge>}
      <ChevronRight size={20} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, primary } = useTheme();
  const { user, signOut } = useAuth();

  // Fetch real profile and notification data
  const { data: profile, loading: profileLoading } = useUserProfile();
  const { data: unreadCount } = useUnreadNotificationCount();

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (error) {
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          },
        },
      ]
    );
  };

  const displayName = profile?.display_name || profile?.username || user?.user_metadata?.username || 'Investor';
  const email = profile?.email || user?.email || 'No email';
  const trackedStocksCount = profile?.tracked_stocks_count || 0;
  const trackedKolsCount = profile?.tracked_kols_count || 0;
  const activeAlertsCount = profile?.active_alerts_count || 0;
  const notifBadge = unreadCount?.count ? String(unreadCount.count) : undefined;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing['2xl'] }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <TouchableOpacity style={styles.profileInfo}>
          <Avatar
            name={displayName}
            source={profile?.avatar_url || undefined}
            size="2xl"
          />
          <View style={styles.profileText}>
            <Text style={[styles.profileName, { color: colors.foreground }]}>
              {displayName}
            </Text>
            <Text style={[styles.profileEmail, { color: colors.mutedForeground }]}>
              {email}
            </Text>
            <View style={styles.membershipBadge}>
              <Badge variant="primary" size="sm">Free Plan</Badge>
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.editButton, { borderColor: colors.border }]}
          onPress={() => router.push('/settings/profile')}
        >
          <Text style={[styles.editButtonText, { color: primary }]}>
            Edit Profile
          </Text>
        </TouchableOpacity>
      </View>

      {/* Stats Card */}
      <Card style={styles.statsCard}>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              {trackedStocksCount}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Tracked Stocks</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              {trackedKolsCount}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Following KOLs</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              {activeAlertsCount}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Alerts Active</Text>
          </View>
        </View>
      </Card>

      {/* Menu Sections */}
      <View style={styles.menuSection}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
          Account
        </Text>
        <Card padding="none">
          <MenuItem
            icon={<Briefcase size={20} color={primary} />}
            label="Portfolio"
            onPress={() => router.push('/portfolio')}
          />
          <MenuItem
            icon={<Star size={20} color={Colors.warning} />}
            label="Tracked Stocks"
            value={`${trackedStocksCount} stocks`}
            onPress={() => router.push('/tracked-stocks')}
          />
          <MenuItem
            icon={<Bell size={20} color={Colors.info} />}
            label="Notifications"
            badge={notifBadge}
            onPress={() => router.push('/notifications')}
          />
        </Card>
      </View>

      <View style={styles.menuSection}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
          Settings
        </Text>
        <Card padding="none">
          <MenuItem
            icon={<Settings size={20} color={colors.foreground} />}
            label="General Settings"
            onPress={() => router.push('/settings')}
          />
          <MenuItem
            icon={<Moon size={20} color={colors.foreground} />}
            label="Appearance"
            value={profile?.theme || 'System'}
            onPress={() => router.push('/settings/appearance')}
          />
          <MenuItem
            icon={<Shield size={20} color={colors.foreground} />}
            label="Privacy & Security"
            onPress={() => router.push('/settings/privacy')}
          />
        </Card>
      </View>

      <View style={styles.menuSection}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
          Subscription
        </Text>
        <Card padding="none">
          <MenuItem
            icon={<CreditCard size={20} color={primary} />}
            label="Upgrade to Pro"
            badge="Save 40%"
            onPress={() => router.push('/subscription')}
          />
        </Card>
      </View>

      <View style={styles.menuSection}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
          Support
        </Text>
        <Card padding="none">
          <MenuItem
            icon={<HelpCircle size={20} color={colors.foreground} />}
            label="Help Center"
            onPress={() => router.push('/help')}
          />
          <MenuItem
            icon={<Share2 size={20} color={colors.foreground} />}
            label="Share Kolvex"
            onPress={() => {}}
          />
        </Card>
      </View>

      {/* Sign Out */}
      <View style={styles.menuSection}>
        <Card padding="none">
          <MenuItem
            icon={<LogOut size={20} color={Colors.error} />}
            label="Sign Out"
            onPress={handleSignOut}
            danger
          />
        </Card>
      </View>

      {/* Version */}
      <Text style={[styles.version, { color: colors.mutedForeground }]}>
        Kolvex v1.0.0
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  profileText: {
    marginLeft: Spacing.lg,
    flex: 1,
  },
  profileName: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
  },
  profileEmail: {
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  membershipBadge: {
    marginTop: Spacing.sm,
  },
  editButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  editButtonText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  statsCard: {
    marginBottom: Spacing.xl,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
  },
  statLabel: {
    fontSize: FontSize.xs,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
  },
  menuSection: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
  },
  menuIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  menuLabel: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
  },
  menuValue: {
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  version: {
    fontSize: FontSize.xs,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
});
