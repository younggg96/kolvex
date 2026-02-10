import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, ThemeColors } from '@/constants/theme';

// ============================================================
// Types
// ============================================================

export type ColorScheme = 'light' | 'dark';
export type ThemePreference = 'LIGHT' | 'DARK' | 'SYSTEM';

const THEME_STORAGE_KEY = 'kolvex_theme_preference';

// ============================================================
// Theme Context
// ============================================================

export interface ThemeContextType {
  themePreference: ThemePreference;
  setThemePreference: (theme: ThemePreference) => void;
  colorScheme: ColorScheme;
  isDark: boolean;
  colors: ThemeColors;
  primary: string;
  success: string;
  error: string;
  warning: string;
  bullish: string;
  bearish: string;
  neutral: string;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// ============================================================
// Hook to use theme state (used inside ThemeProvider)
// ============================================================

export function useThemeState() {
  const systemColorScheme = useColorScheme() ?? 'dark';
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>('SYSTEM');
  const [loaded, setLoaded] = useState(false);

  // Load saved preference on mount
  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((saved) => {
      if (saved === 'LIGHT' || saved === 'DARK' || saved === 'SYSTEM') {
        setThemePreferenceState(saved);
      }
      setLoaded(true);
    });
  }, []);

  const setThemePreference = useCallback((theme: ThemePreference) => {
    setThemePreferenceState(theme);
    AsyncStorage.setItem(THEME_STORAGE_KEY, theme);
  }, []);

  // Resolve the actual color scheme
  const resolvedScheme: ColorScheme =
    themePreference === 'SYSTEM'
      ? (systemColorScheme as ColorScheme)
      : themePreference === 'DARK'
        ? 'dark'
        : 'light';

  const isDark = resolvedScheme === 'dark';
  const colors: ThemeColors = isDark ? Colors.dark : Colors.light;

  return {
    themePreference,
    setThemePreference,
    colorScheme: resolvedScheme,
    isDark,
    colors,
    primary: Colors.primary,
    success: Colors.success,
    error: Colors.error,
    warning: Colors.warning,
    bullish: Colors.bullish,
    bearish: Colors.bearish,
    neutral: Colors.neutral,
    loaded,
  };
}

// ============================================================
// Consumer hook (used throughout the app)
// ============================================================

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    // Fallback for usage outside provider (e.g., tab layout)
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const systemColorScheme = useColorScheme() ?? 'dark';
    const isDark = systemColorScheme === 'dark';
    return {
      themePreference: 'SYSTEM',
      setThemePreference: () => {},
      colorScheme: systemColorScheme as ColorScheme,
      isDark,
      colors: isDark ? Colors.dark : Colors.light,
      primary: Colors.primary,
      success: Colors.success,
      error: Colors.error,
      warning: Colors.warning,
      bullish: Colors.bullish,
      bearish: Colors.bearish,
      neutral: Colors.neutral,
    };
  }
  return context;
}

export function useColors() {
  const { colors } = useTheme();
  return colors;
}
