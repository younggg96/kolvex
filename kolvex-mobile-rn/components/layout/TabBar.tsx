import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  Home,
  TrendingUp,
  Users,
  MessageCircle,
  User,
  type LucideIcon,
} from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { Colors, FontSize, Spacing } from '@/constants/theme';

interface TabBarProps {
  state: {
    index: number;
    routes: Array<{ key: string; name: string }>;
  };
  descriptors: Record<string, unknown>;
  navigation: {
    emit: (event: { type: string; target: string; canPreventDefault: boolean }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
}

interface TabConfig {
  icon: LucideIcon;
  label: string;
}

const TAB_CONFIG: Record<string, TabConfig> = {
  index: { icon: Home, label: 'Home' },
  stocks: { icon: TrendingUp, label: 'Stocks' },
  kols: { icon: Users, label: 'KOLs' },
  chat: { icon: MessageCircle, label: 'AI Chat' },
  profile: { icon: User, label: 'Profile' },
};

export function TabBar({ state, descriptors, navigation }: TabBarProps) {
  const { colors, primary } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          paddingBottom: insets.bottom || Spacing.sm,
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const config = TAB_CONFIG[route.name] || { icon: Home, label: route.name };
        const Icon = config.icon;

        const onPress = () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const onLongPress = () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
            canPreventDefault: false,
          });
        };

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={config.label}
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.tab}
          >
            <View
              style={[
                styles.iconContainer,
                isFocused && { backgroundColor: `${primary}20` },
              ]}
            >
              <Icon
                size={22}
                color={isFocused ? primary : colors.mutedForeground}
                strokeWidth={isFocused ? 2.5 : 2}
              />
            </View>
            <Text
              style={[
                styles.label,
                {
                  color: isFocused ? primary : colors.mutedForeground,
                  fontWeight: isFocused ? '600' : '500',
                },
              ]}
            >
              {config.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: Spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  iconContainer: {
    width: 48,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  label: {
    fontSize: FontSize.xs,
    marginTop: 2,
  },
});
