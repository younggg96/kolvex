import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { BorderRadius, FontSize } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

interface AvatarProps {
  source?: string | null;
  name?: string;
  size?: AvatarSize;
  style?: ViewStyle;
}

const SIZES: Record<AvatarSize, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 48,
  xl: 64,
  '2xl': 96,
};

const FONT_SIZES: Record<AvatarSize, number> = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 18,
  xl: 24,
  '2xl': 36,
};

export function Avatar({ source, name, size = 'md', style }: AvatarProps) {
  const { colors, primary } = useTheme();
  const dimension = SIZES[size];
  const fontSize = FONT_SIZES[size];

  const getInitials = (name?: string): string => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length === 1) {
      return parts[0].charAt(0).toUpperCase();
    }
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
  };

  const containerStyle: ViewStyle = {
    width: dimension,
    height: dimension,
    borderRadius: dimension / 2,
    backgroundColor: source ? 'transparent' : `${primary}20`,
    ...style,
  };

  if (source) {
    return (
      <View style={[styles.container, containerStyle]}>
        <Image
          source={{ uri: source }}
          style={[
            styles.image,
            { width: dimension, height: dimension, borderRadius: dimension / 2 },
          ]}
          contentFit="cover"
          transition={200}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, styles.fallback, containerStyle]}>
      <Text style={[styles.initials, { fontSize, color: primary }]}>
        {getInitials(name)}
      </Text>
    </View>
  );
}

interface AvatarGroupProps {
  avatars: Array<{ source?: string; name?: string }>;
  max?: number;
  size?: AvatarSize;
  style?: ViewStyle;
}

export function AvatarGroup({ avatars, max = 4, size = 'sm', style }: AvatarGroupProps) {
  const { colors, primary } = useTheme();
  const dimension = SIZES[size];
  const displayAvatars = avatars.slice(0, max);
  const remaining = avatars.length - max;

  return (
    <View style={[styles.group, style]}>
      {displayAvatars.map((avatar, index) => (
        <View
          key={index}
          style={[
            styles.groupItem,
            {
              marginLeft: index === 0 ? 0 : -dimension / 3,
              zIndex: displayAvatars.length - index,
            },
          ]}
        >
          <Avatar {...avatar} size={size} style={{ borderWidth: 2, borderColor: colors.card }} />
        </View>
      ))}
      {remaining > 0 && (
        <View
          style={[
            styles.groupItem,
            styles.remaining,
            {
              marginLeft: -dimension / 3,
              width: dimension,
              height: dimension,
              borderRadius: dimension / 2,
              backgroundColor: colors.muted,
              borderWidth: 2,
              borderColor: colors.card,
            },
          ]}
        >
          <Text style={[styles.remainingText, { color: colors.mutedForeground, fontSize: FONT_SIZES[size] - 2 }]}>
            +{remaining}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  image: {
    // Image styles applied inline
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontWeight: '600',
  },
  group: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupItem: {
    // Individual avatar in group
  },
  remaining: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  remainingText: {
    fontWeight: '600',
  },
});
