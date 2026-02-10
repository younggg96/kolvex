import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react-native';
import { GridBackground } from '@/components/common';
import { Button, Input } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, primary } = useTheme();
  const { resetPassword, loading, error } = useAuth();

  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLocalError(null);
    
    if (!email.trim()) {
      setLocalError('Email is required');
      return;
    }

    try {
      await resetPassword(email);
      setIsSubmitted(true);
    } catch (e) {
      // Error is handled by auth state
    }
  };

  const displayError = localError || error;

  if (isSubmitted) {
    return (
      <GridBackground>
        <View style={[styles.container, { paddingTop: insets.top }]}>
          <View style={styles.successContainer}>
            <View style={[styles.successIcon, { backgroundColor: `${primary}20` }]}>
              <CheckCircle size={48} color={primary} />
            </View>
            <Text style={[styles.successTitle, { color: colors.foreground }]}>
              Check your email
            </Text>
            <Text style={[styles.successText, { color: colors.mutedForeground }]}>
              We've sent a password reset link to {email}
            </Text>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onPress={() => router.back()}
              style={{ marginTop: Spacing['3xl'] }}
            >
              Back to Sign In
            </Button>
          </View>
        </View>
      </GridBackground>
    );
  }

  return (
    <GridBackground>
      <KeyboardAvoidingView
        style={[styles.container, { paddingTop: insets.top }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back Button */}
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<ArrowLeft size={20} color={colors.foreground} />}
            onPress={() => router.back()}
            style={styles.backButton}
          >
            Back
          </Button>

          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Forgot Password?
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Enter your email address and we'll send you a link to reset your password.
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Input
              label="Email"
              placeholder="Enter your email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              leftIcon={<Mail size={20} color={colors.mutedForeground} />}
            />

            {displayError && (
              <View style={[styles.errorContainer, { backgroundColor: `${Colors.error}15` }]}>
                <Text style={[styles.errorText, { color: Colors.error }]}>
                  {displayError}
                </Text>
              </View>
            )}

            <Button
              variant="primary"
              size="lg"
              fullWidth
              loading={loading}
              onPress={handleSubmit}
            >
              Send Reset Link
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </GridBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: Spacing['2xl'],
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: Spacing['2xl'],
  },
  header: {
    marginBottom: Spacing['3xl'],
  },
  title: {
    fontSize: FontSize['3xl'],
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSize.base,
    lineHeight: 24,
  },
  form: {
    marginBottom: Spacing['2xl'],
  },
  errorContainer: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  errorText: {
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing['2xl'],
  },
  successIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing['2xl'],
  },
  successTitle: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  successText: {
    fontSize: FontSize.base,
    textAlign: 'center',
    lineHeight: 24,
  },
});
