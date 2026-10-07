import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Header } from '@/components/layout';
import { Card } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import { useStockOverview } from '@/hooks/useStocks';
import { Spacing, FontSize } from '@/constants/theme';
import { formatCurrency, formatPercent, formatNumber } from '@/lib/utils';

export default function StockDetailScreen() {
  const { symbol = '' } = useLocalSearchParams<{ symbol: string }>();
  const router = useRouter();
  const { colors, primary } = useTheme();
  const { data, loading, error, refresh } = useStockOverview(symbol);
  const quote = data?.quote;
  return <View style={[styles.container, { backgroundColor: colors.background }]}>
    <Header title={symbol || 'Stock'} showBack />
    <ScrollView contentContainerStyle={styles.content}>
      {loading ? <Text style={{ color: colors.foreground }}>Loading…</Text> : error || !quote ? <View><Text style={{ color: colors.foreground }}>{error || 'No market data available.'}</Text><TouchableOpacity onPress={refresh}><Text style={{ color: primary }}>Retry</Text></TouchableOpacity></View> : <>
        <Text style={[styles.title, { color: colors.foreground }]}>{quote.name || symbol}</Text>
        <Text style={[styles.price, { color: colors.foreground }]}>{formatCurrency(quote.price)}</Text>
        <Text style={{ color: colors.foreground }}>{formatCurrency(quote.change)} ({formatPercent(quote.changePercent)})</Text>
        <Card><View style={styles.metrics}>{[['Open', formatCurrency(quote.open)], ['High', formatCurrency(quote.high)], ['Low', formatCurrency(quote.low)], ['Volume', formatNumber(quote.volume)], ['Market Cap', formatNumber(quote.marketCap)]].map(([label, value]) => <View key={label} style={styles.row}><Text style={{ color: colors.mutedForeground }}>{label}</Text><Text style={{ color: colors.foreground }}>{value}</Text></View>)}</View></Card>
        {data?.company?.description && <Card><Text style={{ color: colors.foreground }}>{data.company.description}</Text></Card>}
        <TouchableOpacity accessibilityRole="button" style={[styles.button, { backgroundColor: primary }]} onPress={() => router.push(`/(tabs)/chat?stock=${encodeURIComponent(symbol)}`)}><Text style={{ color: '#FFFFFF' }}>Ask AI</Text></TouchableOpacity>
      </>}
    </ScrollView>
  </View>;
}
const styles = StyleSheet.create({ container: { flex: 1 }, content: { padding: Spacing.lg, gap: Spacing.lg }, title: { fontSize: FontSize.xl, fontWeight: '600' }, price: { fontSize: FontSize['3xl'], fontWeight: '700' }, metrics: { gap: Spacing.md }, row: { flexDirection: 'row', justifyContent: 'space-between' }, button: { padding: Spacing.md, borderRadius: 8, alignItems: 'center' } });
