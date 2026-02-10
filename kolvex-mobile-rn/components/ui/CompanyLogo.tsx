import React, { useState } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { BorderRadius, FontWeight } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

const FMP_IMAGE_BASE_URL = 'https://financialmodelingprep.com/image-stock';

export type CompanyLogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface CompanyLogoProps {
  /** Stock ticker symbol */
  symbol: string;
  /** Company name for accessibility */
  name?: string;
  /** Size variant */
  size?: CompanyLogoSize;
  /** Shape: square corners, rounded, or circle */
  shape?: 'square' | 'rounded' | 'circle';
  /** Additional container styles */
  style?: ViewStyle;
}

const SIZES: Record<CompanyLogoSize, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 48,
  xl: 64,
};

const FONT_SIZES: Record<CompanyLogoSize, number> = {
  xs: 9,
  sm: 11,
  md: 13,
  lg: 16,
  xl: 22,
};

export function CompanyLogo({
  symbol,
  name,
  size = 'md',
  shape = 'rounded',
  style,
}: CompanyLogoProps) {
  const { colors, isDark } = useTheme();
  const [hasError, setHasError] = useState(false);

  const dimension = SIZES[size];
  const fontSize = FONT_SIZES[size];
  const logoUrl = `${FMP_IMAGE_BASE_URL}/${symbol.toUpperCase()}.png`;

  const borderRadius =
    shape === 'circle'
      ? dimension / 2
      : shape === 'rounded'
        ? BorderRadius.lg
        : 0;

  const containerStyle: ViewStyle = {
    width: dimension,
    height: dimension,
    borderRadius,
    backgroundColor: isDark ? colors.muted : '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...style,
  };

  if (hasError) {
    return (
      <View style={[styles.container, styles.fallback, containerStyle]}>
        <Text
          style={[
            styles.fallbackText,
            { fontSize, color: colors.mutedForeground },
          ]}
        >
          {symbol.toUpperCase().slice(0, 4)}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, containerStyle]}>
      <Image
        source={{ uri: logoUrl }}
        style={[styles.image, { width: dimension - 2, height: dimension - 2 }]}
        contentFit="contain"
        transition={200}
        onError={() => setHasError(true)}
        accessibilityLabel={name || symbol}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    // dimensions applied inline
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    fontWeight: FontWeight.semibold,
    letterSpacing: -0.5,
  },
});
