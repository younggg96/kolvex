import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, Animated, Easing } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const GRID_SIZE = 45; // Slightly larger for better performance

// Pre-calculate count to ensure full coverage during pan
const COLS = Math.ceil(SCREEN_W / GRID_SIZE) + 4;
const ROWS = Math.ceil(SCREEN_H / GRID_SIZE) + 4;

interface GridBackgroundProps {
  children: React.ReactNode;
}

/**
 * Kolvex Signature Grid Background
 * Optimized with Native Driver for 60FPS performance
 */
export function GridBackground({ children }: GridBackgroundProps) {
  const { colors } = useTheme();
  const panAnim = useRef(new Animated.Value(0)).current;

  const lineColor = 'rgba(34, 197, 94, 0.3)';

  useEffect(() => {
    // Continuous diagonal pan towards bottom-right at 45°
    const animation = Animated.loop(
      Animated.timing(panAnim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [panAnim]);

  // Move +GRID_SIZE on both axes → 45° towards bottom-right
  // Loops seamlessly because the grid repeats every GRID_SIZE
  const translate = panAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, GRID_SIZE],
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Animated Grid Layer */}
      <Animated.View
        style={[
          styles.gridWrapper,
          {
            transform: [{ translateX: translate }, { translateY: translate }],
          },
        ]}
      >
        {/* Render Lines using static arrays to avoid re-renders */}
        {Array.from({ length: COLS }).map((_, i) => (
          <View
            key={`v${i}`}
            style={[styles.verticalLine, { left: i * GRID_SIZE, backgroundColor: lineColor }]}
          />
        ))}
        {Array.from({ length: ROWS }).map((_, i) => (
          <View
            key={`h${i}`}
            style={[styles.horizontalLine, { top: i * GRID_SIZE, backgroundColor: lineColor }]}
          />
        ))}
      </Animated.View>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  gridWrapper: {
    position: 'absolute',
    // Start slightly outside to hide line pop-in
    top: -GRID_SIZE * 2,
    left: -GRID_SIZE * 2,
    width: (COLS + 2) * GRID_SIZE,
    height: (ROWS + 2) * GRID_SIZE,
  },
  verticalLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth, // Use hairlineWidth for crispness
  },
  horizontalLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
  content: {
    flex: 1,
    zIndex: 1,
  },
});