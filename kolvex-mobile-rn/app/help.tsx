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
import {
  HelpCircle,
  MessageCircle,
  Mail,
  ExternalLink,
  ChevronRight,
  FileText,
  Shield,
} from 'lucide-react-native';
import { Card } from '@/components/ui';
import { Header } from '@/components/layout';
import { useTheme } from '@/hooks/useTheme';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';

const FAQ = [
  {
    question: 'What is Kolvex?',
    answer: 'Kolvex is an AI-powered investment platform that tracks KOL (Key Opinion Leader) sentiment across social media to help you make informed investment decisions.',
  },
  {
    question: 'How does sentiment analysis work?',
    answer: 'We use AI to analyze posts from KOLs across Twitter, Reddit, YouTube, and Xiaohongshu, extracting bullish, bearish, or neutral sentiment for specific stocks.',
  },
  {
    question: 'Is my portfolio data secure?',
    answer: 'Yes. Kolvex uses read-only Robinhood and IBKR connections, and stores only the data needed for your portfolio features.',
  },
  {
    question: 'How do I track a stock?',
    answer: 'Navigate to any stock detail page and tap the star icon to add it to your tracked stocks. You can also set price alerts.',
  },
];

export default function HelpScreen() {
  const insets = useSafeAreaInsets();
  const { colors, primary } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Help Center" showBack />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing['2xl'] }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Contact */}
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>CONTACT US</Text>
        <Card padding="none">
          <TouchableOpacity
            style={[styles.contactItem, { borderBottomColor: colors.border }]}
            onPress={() => Linking.openURL('mailto:kolvex.ai@gmail.com')}
          >
            <View style={[styles.contactIcon, { backgroundColor: `${primary}15` }]}>
              <Mail size={20} color={primary} />
            </View>
            <View style={styles.contactContent}>
              <Text style={[styles.contactLabel, { color: colors.foreground }]}>Email Support</Text>
              <Text style={[styles.contactValue, { color: colors.mutedForeground }]}>kolvex.ai@gmail.com</Text>
            </View>
            <ExternalLink size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </Card>

        {/* FAQ */}
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
          FREQUENTLY ASKED QUESTIONS
        </Text>
        {FAQ.map((item, index) => (
          <Card key={index} style={styles.faqCard}>
            <View style={styles.faqHeader}>
              <HelpCircle size={18} color={primary} />
              <Text style={[styles.faqQuestion, { color: colors.foreground }]}>
                {item.question}
              </Text>
            </View>
            <Text style={[styles.faqAnswer, { color: colors.mutedForeground }]}>
              {item.answer}
            </Text>
          </Card>
        ))}

        {/* Legal */}
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>LEGAL</Text>
        <Card padding="none">
          <TouchableOpacity
            style={[styles.contactItem, { borderBottomColor: colors.border }]}
            onPress={() => {}}
          >
            <View style={[styles.contactIcon, { backgroundColor: colors.muted }]}>
              <FileText size={20} color={colors.foreground} />
            </View>
            <Text style={[styles.contactLabel, { color: colors.foreground, flex: 1 }]}>Terms of Service</Text>
            <ChevronRight size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.contactItem, { borderBottomWidth: 0 }]}
            onPress={() => {}}
          >
            <View style={[styles.contactIcon, { backgroundColor: colors.muted }]}>
              <Shield size={20} color={colors.foreground} />
            </View>
            <Text style={[styles.contactLabel, { color: colors.foreground, flex: 1 }]}>Privacy Policy</Text>
            <ChevronRight size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </Card>

        <Text style={[styles.version, { color: colors.mutedForeground }]}>
          Kolvex v1.0.0
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.lg },
  sectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    letterSpacing: 1,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.sm,
    marginTop: Spacing.lg,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    gap: Spacing.md,
  },
  contactIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactContent: { flex: 1 },
  contactLabel: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
  },
  contactValue: {
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  faqCard: {
    marginBottom: Spacing.sm,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  faqQuestion: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    flex: 1,
  },
  faqAnswer: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    marginLeft: 26,
  },
  version: {
    fontSize: FontSize.xs,
    textAlign: 'center',
    marginTop: Spacing.xl,
  },
});
