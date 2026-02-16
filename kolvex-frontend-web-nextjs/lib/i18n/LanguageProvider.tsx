"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import en from "./locales/en.json";
import zh from "./locales/zh.json";

// ── Types ──────────────────────────────────────────────────────
export type Locale = "en" | "zh";

export interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string>) => string;
}

// ── Constants ──────────────────────────────────────────────────
const STORAGE_KEY = "kolvex-locale";
const DEFAULT_LOCALE: Locale = "en";
const VALID_LOCALES: Locale[] = ["en", "zh"];

const translations: Record<Locale, Record<string, unknown>> = {
  en,
  zh,
};

export const SUPPORTED_LOCALES: { value: Locale; label: string; nativeLabel: string }[] = [
  { value: "en", label: "English", nativeLabel: "English" },
  { value: "zh", label: "Chinese", nativeLabel: "中文" },
];

// ── Helpers ────────────────────────────────────────────────────

/**
 * Detect browser/system language and map it to a supported locale.
 * Returns DEFAULT_LOCALE if no supported language is detected.
 */
function detectBrowserLocale(): Locale {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;

  const languages = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];

  for (const lang of languages) {
    const code = lang.toLowerCase().split("-")[0];
    if (VALID_LOCALES.includes(code as Locale)) {
      return code as Locale;
    }
  }

  return DEFAULT_LOCALE;
}

/**
 * Resolve a dot-separated key path from a nested object.
 * e.g. getNestedValue(obj, "settings.tabs.account") => "Account"
 */
function getNestedValue(obj: Record<string, unknown>, path: string): string | undefined {
  const keys = path.split(".");
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return typeof current === "string" ? current : undefined;
}

/**
 * Interpolate {param} placeholders in a translated string.
 */
function interpolate(template: string, params?: Record<string, string>): string {
  if (!params) return template;
  return Object.entries(params).reduce(
    (result, [key, value]) => result.replace(new RegExp(`\\{${key}\\}`, "g"), value),
    template,
  );
}

// ── Context ────────────────────────────────────────────────────
const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

// ── Provider ───────────────────────────────────────────────────
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [mounted, setMounted] = useState(false);

  // Restore from localStorage on mount, fallback to browser language
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && VALID_LOCALES.includes(stored as Locale)) {
        setLocaleState(stored as Locale);
      } else {
        // No stored preference — use browser/system language
        const browserLocale = detectBrowserLocale();
        setLocaleState(browserLocale);
        localStorage.setItem(STORAGE_KEY, browserLocale);
      }
    } catch {
      // localStorage unavailable (SSR or permission denied)
      setLocaleState(detectBrowserLocale());
    }
    setMounted(true);
  }, []);

  // Persist to localStorage + update <html lang>
  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem(STORAGE_KEY, newLocale);
    } catch {
      // ignore
    }
    // Update the html lang attribute for accessibility / SEO
    document.documentElement.lang = newLocale;
  }, []);

  // Translation function
  const t = useCallback(
    (key: string, params?: Record<string, string>): string => {
      const dict = translations[locale];
      const value = getNestedValue(dict, key);

      if (value !== undefined) {
        return interpolate(value, params);
      }

      // Fallback to English
      if (locale !== DEFAULT_LOCALE) {
        const fallback = getNestedValue(translations[DEFAULT_LOCALE], key);
        if (fallback !== undefined) {
          return interpolate(fallback, params);
        }
      }

      // Return the key itself as last resort (helps spotting missing translations)
      return key;
    },
    [locale],
  );

  const value = useMemo<LanguageContextValue>(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  // Prevent hydration mismatch: render children only after mounting
  // (locale might differ between server default and client localStorage)
  if (!mounted) {
    return (
      <LanguageContext.Provider value={{ locale: DEFAULT_LOCALE, setLocale, t }}>
        {children}
      </LanguageContext.Provider>
    );
  }

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

// ── Hook ───────────────────────────────────────────────────────
export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useTranslation must be used within a LanguageProvider");
  }
  return context;
}
