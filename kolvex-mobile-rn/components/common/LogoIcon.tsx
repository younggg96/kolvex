import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors, BorderRadius, FontSize, FontWeight } from '@/constants/theme';

interface LogoIconProps {
  size?: number;
  style?: ViewStyle;
}

export function LogoIcon({ size = 32, style }: LogoIconProps) {
  const fontSize = size * 0.55;
  const borderRadius = size * 0.25;

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius,
          backgroundColor: Colors.primary,
        },
        style,
      ]}
    >
      <Text style={[styles.text, { fontSize }]}>K</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    // Glow shadow
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  text: {
    color: '#FFFFFF',
    fontWeight: FontWeight.bold,
  },
});
