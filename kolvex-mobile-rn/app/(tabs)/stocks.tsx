import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Header } from '@/components/layout';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, FontSize } from '@/constants/theme';

export default function StocksScreen() {
  const { colors, primary } = useTheme();
  const router = useRouter();
  const [symbol, setSymbol] = useState('');
  function openStock() {
    const value = symbol.trim().toUpperCase();
    if (value) router.push(`/stock/${encodeURIComponent(value)}`);
  }
  return <View style={[styles.container, { backgroundColor: colors.background }]}>
    <Header title="Stocks" />
    <View style={styles.content}>
      <Text style={{ color: colors.mutedForeground }}>Enter a stock symbol to view market data.</Text>
      <TextInput accessibilityLabel="Stock symbol" placeholder="AAPL" placeholderTextColor={colors.mutedForeground} value={symbol} onChangeText={setSymbol} autoCapitalize="characters" returnKeyType="search" onSubmitEditing={openStock} style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} />
      <TouchableOpacity accessibilityRole="button" onPress={openStock} disabled={!symbol.trim()} style={[styles.button, { backgroundColor: primary, opacity: symbol.trim() ? 1 : 0.5 }]}><Text style={{ color: '#FFFFFF' }}>View Stock</Text></TouchableOpacity>
    </View>
  </View>;
}
const styles = StyleSheet.create({ container: { flex: 1 }, content: { padding: Spacing.lg, gap: Spacing.lg }, input: { borderWidth: 1, borderRadius: 8, padding: Spacing.md, fontSize: FontSize.base }, button: { padding: Spacing.md, borderRadius: 8, alignItems: 'center' } });
