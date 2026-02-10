import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Crown, Check, Zap } from 'lucide-react-native';
import { Card, Button, Badge } from '@/components/ui';
import { Header } from '@/components/layout';
import { useTheme } from '@/hooks/useTheme';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: '/month',
    current: true,
    features: [
      'Basic stock tracking (5 stocks)',
      'KOL feed access',
      'AI chat (limited)',
      'Basic sentiment analysis',
    ],
  },
  {
    name: 'Pro',
    price: '$9.99',
    period: '/month',
    badge: 'Popular',
    features: [
      'Unlimited stock tracking',
      'Full KOL analytics',
      'Unlimited AI chat',
      'Advanced sentiment analysis',
      'Price alerts',
      'Portfolio integration',
      'Priority support',
    ],
  },
];

export default function SubscriptionScreen() {
  const insets = useSafeAreaInsets();
  const { colors, primary } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Subscription" showBack />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing['2xl'] }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Crown size={40} color={Colors.warning} />
          <Text style={[styles.title, { color: colors.foreground }]}>
            Upgrade to Pro
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Unlock the full power of Kolvex
          </Text>
        </View>

        {PLANS.map((plan) => (
          <Card
            key={plan.name}
            style={[
              styles.planCard,
              !plan.current && { borderColor: primary, borderWidth: 2 },
            ]}
          >
            <View style={styles.planHeader}>
              <View>
                <View style={styles.planNameRow}>
                  <Text style={[styles.planName, { color: colors.foreground }]}>{plan.name}</Text>
                  {plan.badge && (
                    <Badge variant="primary" size="sm">{plan.badge}</Badge>
                  )}
                </View>
                <View style={styles.priceRow}>
                  <Text style={[styles.price, { color: colors.foreground }]}>{plan.price}</Text>
                  <Text style={[styles.period, { color: colors.mutedForeground }]}>{plan.period}</Text>
                </View>
              </View>
            </View>

            <View style={styles.features}>
              {plan.features.map((feature) => (
                <View key={feature} style={styles.featureRow}>
                  <Check size={16} color={plan.current ? colors.mutedForeground : Colors.success} />
                  <Text style={[styles.featureText, { color: colors.foreground }]}>{feature}</Text>
                </View>
              ))}
            </View>

            {plan.current ? (
              <View style={[styles.currentBadge, { backgroundColor: colors.muted }]}>
                <Text style={[styles.currentText, { color: colors.mutedForeground }]}>Current Plan</Text>
              </View>
            ) : (
              <Button variant="primary" size="lg" fullWidth onPress={() => {}}>
                Upgrade to {plan.name}
              </Button>
            )}
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.lg },
  header: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  title: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
  },
  subtitle: {
    fontSize: FontSize.base,
  },
  planCard: {
    marginBottom: Spacing.lg,
  },
  planHeader: {
    marginBottom: Spacing.lg,
  },
  planNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  planName: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  price: {
    fontSize: FontSize['3xl'],
    fontWeight: FontWeight.bold,
  },
  period: {
    fontSize: FontSize.base,
    marginLeft: 2,
  },
  features: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  featureText: {
    fontSize: FontSize.sm,
    flex: 1,
  },
  currentBadge: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  currentText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
});
