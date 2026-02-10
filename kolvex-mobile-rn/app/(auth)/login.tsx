import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthForm } from '@/components/auth';
import { GridBackground } from '@/components/common';
import { useTheme } from '@/hooks/useTheme';
import { FontSize, FontWeight, Spacing } from '@/constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PARTICLE_COUNT = 10;

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, primary, isDark } = useTheme();

  // Floating particles animation
  const particleAnims = useRef(
    Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      translateY: new Animated.Value(0),
      translateX: new Animated.Value(0),
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0.8),
      startLeft: SCREEN_WIDTH * (0.08 + i * 0.09),
      delay: i * 350,
      duration: 7000 + (i % 5) * 900,
      drift: (i % 2 === 0 ? 1 : -1) * (10 + (i % 4) * 6),
    }))
  ).current;

  // Title entrance animation
  const titleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Title entrance
    Animated.timing(titleAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    // Staggered particle animations
    particleAnims.forEach((anim) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(anim.delay),
          Animated.parallel([
            Animated.timing(anim.opacity, {
              toValue: 1,
              duration: 700,
              useNativeDriver: true,
            }),
            Animated.timing(anim.translateY, {
              toValue: -SCREEN_HEIGHT * 0.75,
              duration: anim.duration,
              useNativeDriver: true,
            }),
            Animated.timing(anim.translateX, {
              toValue: anim.drift,
              duration: anim.duration,
              useNativeDriver: true,
            }),
            Animated.timing(anim.scale, {
              toValue: 1.25,
              duration: anim.duration,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(anim.opacity, {
              toValue: 0,
              duration: 700,
              useNativeDriver: true,
            }),
            Animated.timing(anim.translateY, {
              toValue: -SCREEN_HEIGHT * 0.9,
              duration: 700,
              useNativeDriver: true,
            }),
            Animated.timing(anim.translateX, {
              toValue: anim.drift * 1.4,
              duration: 700,
              useNativeDriver: true,
            }),
            Animated.timing(anim.scale, {
              toValue: 0.6,
              duration: 700,
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(anim.translateX, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(anim.translateY, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(anim.scale, {
            toValue: 0.8,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      ).start();
    });
  }, [titleAnim, particleAnims]);

  const handleSuccess = () => {
    router.replace('/(tabs)');
  };

  const handleForgotPassword = () => {
    router.push('/(auth)/forgot-password');
  };

  const titleTranslateY = titleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [30, 0],
  });

  const titleOpacity = titleAnim;

  return (
    <GridBackground>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Floating Particles */}
        {particleAnims.map((anim, i) => (
          <Animated.View
            key={i}
            style={[
              styles.particle,
              {
                left: anim.startLeft,
                bottom: '14%',
                backgroundColor: `${primary}60`,
                opacity: anim.opacity,
                transform: [
                  { translateY: anim.translateY },
                  { translateX: anim.translateX },
                  { scale: anim.scale },
                ],
              },
            ]}
          />
        ))}

        {/* Top Glow */}
        <LinearGradient
          colors={[
            isDark ? 'rgba(0,200,5,0.08)' : 'rgba(0,200,5,0.06)',
            'transparent',
          ]}
          style={styles.topGlow}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />

        {/* Content Container */}
        <View style={styles.content}>
          {/* Animated Title Section */}
          <Animated.View
            style={[
              styles.titleSection,
              {
                opacity: titleOpacity,
                transform: [{ translateY: titleTranslateY }],
              },
            ]}
          >
            {/* Main Title */}
            <View style={styles.titleContainer}>
              <Text style={[styles.title, { color: colors.foreground }]}>
                Welcome Back
              </Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                Login to access your investment dashboard
              </Text>
            </View>
          </Animated.View>

          {/* Auth Form */}
          <View style={styles.formContainer}>
            <AuthForm
              onSuccess={handleSuccess}
              onForgotPassword={handleForgotPassword}
            />
          </View>
        </View>
      </View>
    </GridBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },

  // Floating particles
  particle: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
  },

  // Top glow
  topGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
  },

  // Title section
  titleSection: {
    alignItems: 'center',
    marginTop: Spacing['2xl'],
    marginBottom: Spacing.xl,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: Spacing.xl,
    gap: 6,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    position: 'relative',
    zIndex: 1,
  },
  badgePing: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    opacity: 0.75,
    // Note: Can't easily do CSS-like animate-ping in RN, but the dot is visible
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },
  titleContainer: {
    marginTop: Spacing['xl'],
    alignItems: 'center',
  },
  title: {
    fontSize: FontSize['4xl'],
    fontWeight: FontWeight.extrabold,
    letterSpacing: -1.5,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.base,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: Spacing.md,
  },

  // Form
  formContainer: {
    flex: 1,
    width: '100%',
  },

  // Bottom fade
  bottomFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    pointerEvents: 'none',
  },
});
