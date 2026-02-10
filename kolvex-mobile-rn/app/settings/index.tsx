import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  User,
  Moon,
  Shield,
  Bell,
  ChevronRight,
} from 'lucide-react-native';
import { Card } from '@/components/ui';
import { Header } from '@/components/layout';
import { useTheme } from '@/hooks/useTheme';
import { useUserProfile } from '@/hooks/useUserProfile';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';

interface SettingsItemProps {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onPress: () => void;
}

function SettingsItem({ icon, label, value, onPress }: SettingsItemProps) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[styles.item, { borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.itemIcon, { backgroundColor: colors.muted }]}>
        {icon}
      </View>
      <View style={styles.itemContent}>
        <Text style={[styles.itemLabel, { color: colors.foreground }]}>{label}</Text>
        {value && (
          <Text style={[styles.itemValue, { color: colors.mutedForeground }]}>{value}</Text>
        )}
      </View>
      <ChevronRight size={20} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, primary } = useTheme();
  const { data: profile } = useUserProfile();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Settings" showBack />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing['2xl'] }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
          ACCOUNT
        </Text>
        <Card padding="none">
          <SettingsItem
            icon={<User size={20} color={primary} />}
            label="Edit Profile"
            value={profile?.username || undefined}
            onPress={() => router.push('/settings/profile')}
          />
        </Card>

        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
          PREFERENCES
        </Text>
        <Card padding="none">
          <SettingsItem
            icon={<Moon size={20} color={colors.foreground} />}
            label="Appearance"
            value={profile?.theme || 'System'}
            onPress={() => router.push('/settings/appearance')}
          />
          <SettingsItem
            icon={<Bell size={20} color={colors.foreground} />}
            label="Notifications"
            onPress={() => router.push('/notifications')}
          />
        </Card>

        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
          SECURITY
        </Text>
        <Card padding="none">
          <SettingsItem
            icon={<Shield size={20} color={colors.foreground} />}
            label="Privacy & Security"
            onPress={() => router.push('/settings/privacy')}
          />
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.lg },
  sectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    letterSpacing: 1,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.sm,
    marginTop: Spacing.lg,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
  },
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  itemLabel: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
  },
  itemValue: {
    fontSize: FontSize.sm,
    marginTop: 2,
  },
});
