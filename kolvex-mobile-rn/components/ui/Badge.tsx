import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Colors, BorderRadius, FontSize, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

export type BadgeVariant = 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'outline';
export type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  style,
  textStyle,
}: BadgeProps) {
  const { colors } = useTheme();

  const getVariantStyles = (): { container: ViewStyle; text: TextStyle } => {
    switch (variant) {
      case 'primary':
        return {
          container: { backgroundColor: `${Colors.primary}20` },
          text: { color: Colors.primary },
        };
      case 'secondary':
        return {
          container: { backgroundColor: colors.secondary },
          text: { color: colors.secondaryForeground },
        };
      case 'success':
        return {
          container: { backgroundColor: `${Colors.success}20` },
          text: { color: Colors.success },
        };
      case 'warning':
        return {
          container: { backgroundColor: `${Colors.warning}20` },
          text: { color: Colors.warning },
        };
      case 'error':
        return {
          container: { backgroundColor: `${Colors.error}20` },
          text: { color: Colors.error },
        };
      case 'outline':
        return {
          container: {
            backgroundColor: 'transparent',
            borderWidth: 1,
            borderColor: colors.border,
          },
          text: { color: colors.foreground },
        };
      default:
        return {
          container: { backgroundColor: colors.muted },
          text: { color: colors.mutedForeground },
        };
    }
  };

  const getSizeStyles = (): { container: ViewStyle; text: TextStyle } => {
    switch (size) {
      case 'sm':
        return {
          container: {
            paddingVertical: 2,
            paddingHorizontal: Spacing.sm,
            borderRadius: BorderRadius.sm,
          },
          text: { fontSize: FontSize.xs },
        };
      case 'lg':
        return {
          container: {
            paddingVertical: Spacing.sm,
            paddingHorizontal: Spacing.md,
            borderRadius: BorderRadius.lg,
          },
          text: { fontSize: FontSize.base },
        };
      default: // md
        return {
          container: {
            paddingVertical: Spacing.xs,
            paddingHorizontal: Spacing.sm,
            borderRadius: BorderRadius.md,
          },
          text: { fontSize: FontSize.sm },
        };
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  return (
    <View
      style={[
        styles.container,
        sizeStyles.container,
        variantStyles.container,
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          sizeStyles.text,
          variantStyles.text,
          textStyle,
        ]}
      >
        {children}
      </Text>
    </View>
  );
}

// Specialized Sentiment Badge
interface SentimentBadgeProps {
  sentiment: 'bullish' | 'bearish' | 'neutral';
  size?: BadgeSize;
  style?: ViewStyle;
}

export function SentimentBadge({ sentiment, size = 'md', style }: SentimentBadgeProps) {
  const getVariant = (): BadgeVariant => {
    switch (sentiment) {
      case 'bullish':
        return 'success';
      case 'bearish':
        return 'error';
      default:
        return 'default';
    }
  };

  const getLabel = (): string => {
    switch (sentiment) {
      case 'bullish':
        return 'Bullish';
      case 'bearish':
        return 'Bearish';
      default:
        return 'Neutral';
    }
  };

  return (
    <Badge variant={getVariant()} size={size} style={style}>
      {getLabel()}
    </Badge>
  );
}

// Platform Badge
interface PlatformBadgeProps {
  platform: 'twitter' | 'reddit' | 'youtube' | 'xiaohongshu';
  size?: BadgeSize;
  style?: ViewStyle;
}

export function PlatformBadge({ platform, size = 'sm', style }: PlatformBadgeProps) {
  const getPlatformInfo = (): { label: string; color: string } => {
    switch (platform) {
      case 'twitter':
        return { label: 'Twitter', color: '#1DA1F2' };
      case 'reddit':
        return { label: 'Reddit', color: '#FF4500' };
      case 'youtube':
        return { label: 'YouTube', color: '#FF0000' };
      case 'xiaohongshu':
        return { label: '小红书', color: '#FE2C55' };
      default:
        return { label: platform, color: '#6B7280' };
    }
  };

  const { label, color } = getPlatformInfo();

  const sizeStyles = {
    sm: { paddingVertical: 2, paddingHorizontal: Spacing.sm, fontSize: FontSize.xs },
    md: { paddingVertical: Spacing.xs, paddingHorizontal: Spacing.sm, fontSize: FontSize.sm },
    lg: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, fontSize: FontSize.base },
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: `${color}20`,
          paddingVertical: sizeStyles[size].paddingVertical,
          paddingHorizontal: sizeStyles[size].paddingHorizontal,
          borderRadius: BorderRadius.md,
        },
        style,
      ]}
    >
      <Text style={[styles.text, { color, fontSize: sizeStyles[size].fontSize }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
  },
  text: {
    fontWeight: '500',
  },
});
