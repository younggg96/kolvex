import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sun, Moon, Smartphone, Check } from 'lucide-react-native';
import { Card } from '@/components/ui';
import { Header } from '@/components/layout';
import { useTheme, ThemePreference } from '@/hooks/useTheme';
import { userApi } from '@/lib/api';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';

const THEME_OPTIONS: { value: ThemePreference; label: string; description: string; icon: typeof Sun }[] = [
  {
    value: 'LIGHT',
    label: 'Light',
    description: 'Always use light theme',
    icon: Sun,
  },
  {
    value: 'DARK',
    label: 'Dark',
    description: 'Always use dark theme',
    icon: Moon,
  },
  {
    value: 'SYSTEM',
    label: 'System',
    description: 'Follow system appearance',
    icon: Smartphone,
  },
];

export default function AppearanceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, primary, isDark, themePreference, setThemePreference } = useTheme();
  const [saving, setSaving] = useState(false);

  const handleSelectTheme = async (theme: ThemePreference) => {
    // Apply immediately via context (instant UI switch)
    setThemePreference(theme);

    // Also save to backend (non-blocking)
    setSaving(true);
    try {
      await userApi.updateTheme(theme);
    } catch {
      // Silently fail backend save — local preference is already applied
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Appearance" showBack />

      <View style={[styles.content, { paddingBottom: insets.bottom + Spacing['2xl'] }]}>
        {/* Theme Options */}
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
          THEME
        </Text>
        <Card padding="none">
          {THEME_OPTIONS.map((option, index) => {
            const isSelected = themePreference === option.value;
            const IconComp = option.icon;
            return (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.option,
                  { borderBottomColor: colors.border },
                  index === THEME_OPTIONS.length - 1 && { borderBottomWidth: 0 },
                ]}
                onPress={() => handleSelectTheme(option.value)}
                activeOpacity={0.7}
                disabled={saving}
              >
                <View style={[styles.optionIcon, { backgroundColor: isSelected ? `${primary}15` : colors.muted }]}>
                  <IconComp size={20} color={isSelected ? primary : colors.foreground} />
                </View>
                <View style={styles.optionContent}>
                  <Text style={[styles.optionLabel, { color: colors.foreground }]}>
                    {option.label}
                  </Text>
                  <Text style={[styles.optionDescription, { color: colors.mutedForeground }]}>
                    {option.description}
                  </Text>
                </View>
                {isSelected && <Check size={20} color={primary} />}
              </TouchableOpacity>
            );
          })}
        </Card>

        {/* Preview */}
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground, marginTop: Spacing.xl }]}>
          CURRENT
        </Text>
        <Card>
          <Text style={[styles.previewText, { color: colors.foreground }]}>
            Active theme: {isDark ? 'Dark' : 'Light'}
          </Text>
          <Text style={[styles.previewSubtext, { color: colors.mutedForeground }]}>
            {themePreference === 'SYSTEM'
              ? 'Following your device system setting'
              : `Manually set to ${themePreference.toLowerCase()}`}
          </Text>
        </Card>

        <Text style={[styles.note, { color: colors.mutedForeground }]}>
          Theme changes apply instantly. Your preference is also synced to your account.
        </Text>
      </View>
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
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  optionLabel: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
  },
  optionDescription: {
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  previewText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
  },
  previewSubtext: {
    fontSize: FontSize.sm,
    marginTop: 4,
  },
  note: {
    fontSize: FontSize.xs,
    lineHeight: 18,
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.sm,
  },
});
