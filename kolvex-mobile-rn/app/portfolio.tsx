import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Briefcase, ExternalLink, Link2 } from 'lucide-react-native';
import { Card, Button } from '@/components/ui';
import { Header } from '@/components/layout';
import { useTheme } from '@/hooks/useTheme';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';

export default function PortfolioScreen() {
  const insets = useSafeAreaInsets();
  const { colors, primary } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Portfolio" showBack />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing['2xl'] }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.emptyState}>
          <View style={[styles.iconCircle, { backgroundColor: `${primary}15` }]}>
            <Briefcase size={48} color={primary} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Connect Your Portfolio
          </Text>
          <Text style={[styles.description, { color: colors.mutedForeground }]}>
            Link your brokerage account via SnapTrade to see your holdings, P&L analysis, and AI-powered insights.
          </Text>
        </View>

        <Card style={styles.featureCard}>
          <Text style={[styles.featureTitle, { color: colors.foreground }]}>Features</Text>
          {[
            'Real-time portfolio tracking',
            'P&L analysis with charts',
            'AI-powered stock recommendations',
            'KOL sentiment overlay',
          ].map((feature) => (
            <View key={feature} style={styles.featureRow}>
              <View style={[styles.featureDot, { backgroundColor: primary }]} />
              <Text style={[styles.featureText, { color: colors.foreground }]}>{feature}</Text>
            </View>
          ))}
        </Card>

        <Button
          variant="primary"
          size="lg"
          fullWidth
          onPress={() => {
            // TODO: Implement SnapTrade connection
          }}
        >
          Connect Brokerage
        </Button>

        <Text style={[styles.note, { color: colors.mutedForeground }]}>
          Powered by SnapTrade. Your credentials are encrypted and never stored on our servers.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.lg },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing['2xl'],
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  description: {
    fontSize: FontSize.base,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  featureCard: {
    marginBottom: Spacing.xl,
  },
  featureTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.md,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  featureDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  featureText: {
    fontSize: FontSize.sm,
  },
  note: {
    fontSize: FontSize.xs,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
});
