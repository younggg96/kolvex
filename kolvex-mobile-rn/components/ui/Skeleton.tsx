import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { BorderRadius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({
  width = '100%',
  height = 20,
  borderRadius = BorderRadius.md,
  style,
}: SkeletonProps) {
  const { colors } = useTheme();
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();

    return () => animation.stop();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.skeleton,
          opacity,
        },
        style,
      ]}
    />
  );
}

// Pre-built skeleton components for common UI patterns
export function SkeletonText({ lines = 1, style }: { lines?: number; style?: ViewStyle }) {
  return (
    <View style={style}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={14}
          width={i === lines - 1 ? '60%' as `${number}%` : '100%' as `${number}%`}
          style={{ marginBottom: i < lines - 1 ? 8 : 0 }}
        />
      ))}
    </View>
  );
}

export function SkeletonCard({ style }: { style?: ViewStyle }) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
        style,
      ]}
    >
      <View style={styles.cardHeader}>
        <Skeleton width={48} height={48} borderRadius={BorderRadius.full} />
        <View style={styles.cardHeaderText}>
          <Skeleton width={120} height={16} style={{ marginBottom: 8 }} />
          <Skeleton width={80} height={12} />
        </View>
      </View>
      <SkeletonText lines={3} style={{ marginTop: 16 }} />
    </View>
  );
}

export function SkeletonStockRow({ style }: { style?: ViewStyle }) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.stockRow,
        { backgroundColor: colors.card, borderBottomColor: colors.border },
        style,
      ]}
    >
      <View style={styles.stockRowLeft}>
        <Skeleton width={40} height={40} borderRadius={BorderRadius.md} />
        <View style={styles.stockRowInfo}>
          <Skeleton width={60} height={16} style={{ marginBottom: 4 }} />
          <Skeleton width={100} height={12} />
        </View>
      </View>
      <View style={styles.stockRowRight}>
        <Skeleton width={70} height={16} style={{ marginBottom: 4 }} />
        <Skeleton width={50} height={14} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    // Base skeleton styles
  },
  card: {
    padding: 16,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardHeaderText: {
    marginLeft: 12,
    flex: 1,
  },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  stockRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stockRowInfo: {
    marginLeft: 12,
  },
  stockRowRight: {
    alignItems: 'flex-end',
  },
});
