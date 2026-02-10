/**
 * Kolvex Design System - Theme Constants
 * Source of truth: web tailwind.config.ts + app/globals.css
 */

const WEB_TOKENS = {
  primary: '#00c805',
  primaryForeground: '#ffffff',
  secondary: '#f1f5f9',
  secondaryForeground: '#0f172a',
  destructive: '#ef4444',
  destructiveForeground: '#ffffff',
  light: {
    background: '#f7f8fa',
    foreground: '#171717',
    card: '#ffffff',
    border: '#e5e7eb',
    muted: '#f1f5f9',
    mutedForeground: '#64748b',
  },
  dark: {
    background: '#0a0e0f',
    foreground: '#e5e7eb',
    card: '#1a1d1f',
    border: '#2a2d2f',
    muted: '#1e2124',
    mutedForeground: '#9ca3af',
  },
} as const;

export const Colors = {
  // Brand + semantic (directly aligned with web tokens)
  primary: WEB_TOKENS.primary,
  primaryLight: '#33d337',
  primaryDark: '#00a004',
  primaryForeground: WEB_TOKENS.primaryForeground,
  success: WEB_TOKENS.primary,
  error: WEB_TOKENS.destructive,
  warning: '#f59e0b',
  info: '#3b82f6',
  bullish: WEB_TOKENS.primary,
  bearish: WEB_TOKENS.destructive,
  neutral: '#6b7280',

  // Extra semantic aliases used by components
  destructive: WEB_TOKENS.destructive,
  destructiveForeground: WEB_TOKENS.destructiveForeground,

  // Light theme
  light: {
    background: WEB_TOKENS.light.background,
    foreground: WEB_TOKENS.light.foreground,
    card: WEB_TOKENS.light.card,
    cardForeground: WEB_TOKENS.light.foreground,
    border: WEB_TOKENS.light.border,
    muted: WEB_TOKENS.light.muted,
    mutedForeground: WEB_TOKENS.light.mutedForeground,
    secondary: WEB_TOKENS.secondary,
    secondaryForeground: WEB_TOKENS.secondaryForeground,
    text: WEB_TOKENS.light.foreground,
    textSecondary: '#4b5563',
    textMuted: '#9ca3af',
    skeleton: WEB_TOKENS.light.border,
    inputBackground: '#f9fafb',
    inputBorder: '#d1d5db',
    inputBorderFocus: WEB_TOKENS.primary,
  },

  // Dark theme
  dark: {
    background: WEB_TOKENS.dark.background,
    foreground: WEB_TOKENS.dark.foreground,
    card: WEB_TOKENS.dark.card,
    cardForeground: WEB_TOKENS.dark.foreground,
    border: WEB_TOKENS.dark.border,
    muted: WEB_TOKENS.dark.muted,
    mutedForeground: WEB_TOKENS.dark.mutedForeground,
    secondary: WEB_TOKENS.dark.muted,
    secondaryForeground: WEB_TOKENS.dark.foreground,
    text: WEB_TOKENS.dark.foreground,
    textSecondary: WEB_TOKENS.dark.mutedForeground,
    textMuted: '#6b7280',
    skeleton: WEB_TOKENS.dark.border,
    inputBackground: 'rgba(0,0,0,0.3)',
    inputBorder: 'rgba(255,255,255,0.1)',
    inputBorderFocus: WEB_TOKENS.primary,
  },
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
  '6xl': 64,
};

export const FontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
  '5xl': 48,
};

export const FontWeight = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};

export const BorderRadius = {
  none: 0,
  sm: 2,
  md: 6,
  lg: 8,
  xl: 12,
  '2xl': 16,
  '3xl': 24,
  full: 9999,
};

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
};

export const Animation = {
  fast: 200,
  normal: 300,
  slow: 500,
};

// Social Platform Colors (matches web logo colors)
export const PlatformColors = {
  twitter: '#1da1f2',
  reddit: '#ff4500',
  youtube: '#ff0000',
  xiaohongshu: '#fe2c55',
};

export type ThemeColors = typeof Colors.light | typeof Colors.dark;
