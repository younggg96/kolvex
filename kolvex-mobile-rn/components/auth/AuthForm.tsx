import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Mail, Lock, User } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Button, Input } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';

type AuthMode = 'login' | 'signup';

const NAME_FIELD_HEIGHT = 88;

interface AuthFormProps {
  onSuccess?: () => void;
  onForgotPassword?: () => void;
}

export function AuthForm({ onSuccess, onForgotPassword }: AuthFormProps) {
  const { colors, isDark, primary } = useTheme();
  const { signIn, signUp, loading, error } = useAuth();

  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Animations
  const slideAnim = useRef(new Animated.Value(0)).current;
  const expandAnim = useRef(new Animated.Value(0)).current;
  const cardEntranceAnim = useRef(new Animated.Value(0)).current;
  const [toggleWidth, setToggleWidth] = useState(0);

  const isLogin = mode === 'login';

  // Card entrance animation on mount
  useEffect(() => {
    Animated.spring(cardEntranceAnim, {
      toValue: 1,
      tension: 40,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [cardEntranceAnim]);

  const handleModeChange = useCallback((newMode: AuthMode) => {
    if (newMode === mode) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLocalError(null);
    setMode(newMode);

    const toSignup = newMode === 'signup';

    // Smooth pill slide
    Animated.spring(slideAnim, {
      toValue: toSignup ? 1 : 0,
      useNativeDriver: false,
      tension: 100,
      friction: 10,
    }).start();

    // Name field expand/collapse
    Animated.timing(expandAnim, {
      toValue: toSignup ? 1 : 0,
      duration: 320,
      useNativeDriver: false,
    }).start();
  }, [mode, slideAnim, expandAnim]);

  const handleSubmit = async () => {
    setLocalError(null);

    if (!email.trim()) {
      setLocalError('Please enter your email');
      return;
    }
    if (!password.trim()) {
      setLocalError('Please enter your password');
      return;
    }
    if (!isLogin && !name.trim()) {
      setLocalError('Please enter your name');
      return;
    }
    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters');
      return;
    }

    try {
      if (isLogin) {
        await signIn(email, password);
      } else {
        await signUp(email, password, name);
      }
      onSuccess?.();
    } catch {
      // Error handled by auth state
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // TODO: Implement Google OAuth
    setTimeout(() => setIsGoogleLoading(false), 2000);
  };

  const displayError = localError || error;

  // Interpolations
  const cardScale = cardEntranceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.95, 1],
  });

  const cardOpacity = cardEntranceAnim;

  const pillTranslateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [4, Math.max(4, toggleWidth / 2 - 2)],
  });

  const nameHeight = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, NAME_FIELD_HEIGHT],
  });

  const nameOpacity = expandAnim.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0, 0, 1],
  });

  const forgotHeight = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [32, 0],
  });

  const forgotOpacity = expandAnim.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [1, 0, 0],
  });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Animated Card with enhanced styling */}
        <Animated.View
          style={[
            styles.cardWrapper,
            {
              opacity: cardOpacity,
              transform: [{ scale: cardScale }],
            },
          ]}
        >
          {/* Card with backdrop blur effect */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: isDark ? 'rgba(10,14,10,0.95)' : 'rgba(255,255,255,0.95)',
                borderColor: isDark ? 'rgba(26,31,26,0.8)' : 'rgba(229,231,235,0.8)',
              },
            ]}
          >
            {/* Top glow gradient */}
            <LinearGradient
              colors={[
                `${primary}08`,
                `${primary}04`,
                'transparent',
              ]}
              style={styles.topGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />

            {/* Toggle Pill */}
            <View
              style={[
                styles.toggleContainer,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.04)',
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.08)',
                },
              ]}
              onLayout={(e) => setToggleWidth(e.nativeEvent.layout.width)}
            >
              <Animated.View
                style={[
                  styles.togglePill,
                  {
                    backgroundColor: primary,
                    width: toggleWidth > 0 ? (toggleWidth / 2) - 8 : '46%',
                    transform: [{ translateX: pillTranslateX }],
                  },
                ]}
              />
              <TouchableOpacity
                style={styles.toggleButton}
                onPress={() => handleModeChange('login')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.toggleText,
                    {
                      color: isLogin
                        ? '#FFFFFF'
                        : isDark
                        ? 'rgba(255,255,255,0.6)'
                        : 'rgba(107,114,128,1)',
                      fontWeight: isLogin ? '700' : '600',
                    },
                  ]}
                >
                  Login
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.toggleButton}
                onPress={() => handleModeChange('signup')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.toggleText,
                    {
                      color: !isLogin
                        ? '#FFFFFF'
                        : isDark
                        ? 'rgba(255,255,255,0.6)'
                        : 'rgba(107,114,128,1)',
                      fontWeight: !isLogin ? '700' : '600',
                    },
                  ]}
                >
                  Sign Up
                </Text>
              </TouchableOpacity>
            </View>

            {/* Form Fields */}

            {/* Name field - animated */}
            <Animated.View style={{ height: nameHeight, opacity: nameOpacity, overflow: 'hidden' }}>
              <Input
                label="Full Name"
                placeholder="Enter your full name"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                leftIcon={<User size={18} color={colors.mutedForeground} />}
                containerStyle={styles.inputSpacing}
              />
            </Animated.View>

            <Input
              label="Email Address"
              placeholder="Enter your email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              leftIcon={<Mail size={18} color={colors.mutedForeground} />}
              containerStyle={styles.inputSpacing}
            />

            <Input
              label="Password"
              placeholder={isLogin ? 'Enter your password' : 'Create a password'}
              value={password}
              onChangeText={setPassword}
              isPassword
              autoCapitalize="none"
              leftIcon={<Lock size={18} color={colors.mutedForeground} />}
              containerStyle={styles.inputSpacing}
            />

            {/* Forgot password - animated */}
            <Animated.View style={{ height: forgotHeight, opacity: forgotOpacity, overflow: 'hidden' }}>
              <TouchableOpacity
                onPress={onForgotPassword}
                style={styles.forgotPassword}
                disabled={!isLogin}
              >
                <Text style={[styles.forgotPasswordText, { color: primary }]}>
                  Forgot password?
                </Text>
              </TouchableOpacity>
            </Animated.View>

            {/* Error */}
            {displayError && (
              <View style={[styles.errorContainer, { backgroundColor: `${Colors.error}12` }]}>
                <Text style={[styles.errorText, { color: Colors.error }]}>
                  {displayError}
                </Text>
              </View>
            )}

            {/* Submit Button with enhanced styling */}
            <Button
              variant="primary"
              size="lg"
              fullWidth
              loading={loading}
              onPress={handleSubmit}
              style={styles.submitButton}
            >
              {isLogin ? 'Login' : 'Create Account'}
            </Button>

            {/* Divider with gradient lines */}
            <View style={styles.dividerContainer}>
              <View style={[styles.dividerLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]} />
              <Text style={[styles.dividerText, { color: isDark ? 'rgba(255,255,255,0.4)' : '#9CA3AF' }]}>
                OR
              </Text>
              <View style={[styles.dividerLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]} />
            </View>

            {/* Social Buttons with enhanced styling */}
            <TouchableOpacity
              style={[
                styles.socialButton,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                },
              ]}
              onPress={handleGoogleSignIn}
              disabled={isGoogleLoading || loading}
              activeOpacity={0.7}
            >
              {isGoogleLoading ? (
                <ActivityIndicator size="small" color={colors.foreground} />
              ) : (
                <>
                  <Image
                    source={{ uri: 'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg' }}
                    style={styles.socialIcon}
                    contentFit="contain"
                  />
                  <Text style={[styles.socialButtonText, { color: colors.foreground }]}>
                    Continue with Google
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Apple Sign In (iOS only) */}
            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={[
                  styles.socialButton,
                  {
                    backgroundColor: isDark ? '#FFFFFF' : '#000000',
                    borderColor: isDark ? '#FFFFFF' : '#000000',
                  },
                ]}
                onPress={() => {}}
                activeOpacity={0.8}
              >
                <Text style={[styles.appleIcon, { color: isDark ? '#000000' : '#FFFFFF' }]}>
                  {'\uF8FF'}
                </Text>
                <Text style={[styles.socialButtonText, { color: isDark ? '#000000' : '#FFFFFF' }]}>
                  Continue with Apple
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing['2xl'],
  },
  
  // Card with enhanced styling
  cardWrapper: {
    // Wrapper for entrance animation
  },
  card: {
    borderRadius: BorderRadius['2xl'],
    borderWidth: 1,
    padding: Spacing['2xl'],
    overflow: 'hidden',
    position: 'relative',
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '60%',
    borderTopLeftRadius: BorderRadius['2xl'],
    borderTopRightRadius: BorderRadius['2xl'],
  },

  // Toggle with enhanced styling
  toggleContainer: {
    flexDirection: 'row',
    borderRadius: BorderRadius.full,
    padding: 6,
    borderWidth: 1,
    marginBottom: Spacing['2xl'],
    position: 'relative',
    // Subtle inner shadow effect
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  togglePill: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    borderRadius: BorderRadius.full,
    shadowColor: '#00C805',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: Spacing.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  toggleText: {
    fontSize: FontSize.sm,
    letterSpacing: 0.2,
  },

  // Form styling
  inputSpacing: {
    marginBottom: Spacing.lg,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  forgotPasswordText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  errorContainer: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: `${Colors.error}20`,
  },
  errorText: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    fontWeight: FontWeight.medium,
  },
  submitButton: {
    marginTop: Spacing.md,
    height: 52,
    shadowColor: '#00C805',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },

  // Enhanced divider
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing['2xl'],
    gap: Spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    letterSpacing: 1,
  },

  // Enhanced social buttons
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  socialIcon: {
    width: 20,
    height: 20,
  },
  socialButtonText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
  },
  appleIcon: {
    fontSize: 20,
    fontWeight: FontWeight.bold,
  },
});
