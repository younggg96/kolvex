import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Bell } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  showNotification?: boolean;
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
  transparent?: boolean;
  style?: ViewStyle;
  onBackPress?: () => void;
}

/**
 * Header matching web's components/layout/Header.tsx style
 * h-[48px] lg:h-[56px] bg-white dark:bg-background-dark border-b
 */
export function Header({
  title,
  showBack = false,
  showNotification = false,
  leftAction,
  rightAction,
  transparent = false,
  style,
  onBackPress,
}: HeaderProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      router.back();
    }
  };

  return (
    <>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={transparent ? 'transparent' : isDark ? Colors.dark.background : '#FFFFFF'}
        translucent={transparent}
      />
      <View
        style={[
          styles.container,
          {
            paddingTop: insets.top,
            backgroundColor: transparent
              ? 'transparent'
              : isDark
              ? Colors.dark.background
              : '#FFFFFF',
            borderBottomColor: transparent ? 'transparent' : colors.border,
          },
          style,
        ]}
      >
        <View style={styles.inner}>
          {/* Left Section */}
          <View style={styles.leftSection}>
            {showBack ? (
              <TouchableOpacity
                style={styles.backButton}
                onPress={handleBack}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <ChevronLeft size={24} color={colors.foreground} />
              </TouchableOpacity>
            ) : leftAction ? (
              leftAction
            ) : null}
          </View>

          {/* Title */}
          {title && (
            <View style={styles.titleContainer}>
              <Text
                style={[styles.title, { color: isDark ? '#FFFFFF' : '#111827' }]}
                numberOfLines={1}
              >
                {title}
              </Text>
            </View>
          )}

          {/* Right Section */}
          <View style={styles.rightSection}>
            {showNotification ? (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => router.push('/notifications')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Bell size={20} color={colors.foreground} />
              </TouchableOpacity>
            ) : rightAction ? (
              rightAction
            ) : null}
          </View>
        </View>
      </View>
    </>
  );
}

// Logo Header for main tab screens
interface LogoHeaderProps {
  greeting?: string;
  username?: string;
  showNotification?: boolean;
  rightAction?: React.ReactNode;
  style?: ViewStyle;
}

export function LogoHeader({
  greeting,
  username,
  showNotification = true,
  rightAction,
  style,
}: LogoHeaderProps) {
  const { colors, primary, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top,
          backgroundColor: isDark ? Colors.dark.background : '#FFFFFF',
          borderBottomColor: colors.border,
        },
        style,
      ]}
    >
      <View style={styles.inner}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <View style={[styles.logoIcon, { backgroundColor: primary }]}>
            <Text style={styles.logoText}>K</Text>
          </View>
          {greeting ? (
            <View>
              <Text style={[styles.greetingText, { color: colors.mutedForeground }]}>
                {greeting}
              </Text>
              <Text style={[styles.usernameText, { color: colors.foreground }]}>
                {username || 'Investor'}
              </Text>
            </View>
          ) : (
            <Text style={[styles.logoName, { color: colors.foreground }]}>
              Kolvex
            </Text>
          )}
        </View>

        {/* Right Actions */}
        <View style={styles.rightSection}>
          {showNotification && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/notifications')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Bell size={20} color={colors.foreground} />
            </TouchableOpacity>
          )}
          {rightAction}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    height: 48,
  },
  leftSection: {
    flex: 1,
    alignItems: 'flex-start',
  },
  titleContainer: {
    flex: 2,
    alignItems: 'center',
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
  },
  rightSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
  },
  backButton: {
    padding: 4,
  },
  actionButton: {
    padding: 6,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  logoIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    // Glow
    shadowColor: '#00C805',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  logoName: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
  },
  greetingText: {
    fontSize: FontSize.xs,
  },
  usernameText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
  },
});
