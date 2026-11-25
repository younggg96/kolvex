"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import en from "./locales/en.json";

// ── Types ──────────────────────────────────────────────────────
export type Locale = "en" | "zh";

export interface LanguageContextValue {
  locale: Locale;
  ready: boolean;
  /** Resolves once the locale's dictionary has loaded and the switch has happened. */
  setLocale: (locale: Locale) => Promise<void>;
  t: (key: string, params?: Record<string, string>) => string;
}

// ── Constants ──────────────────────────────────────────────────
const STORAGE_KEY = "kolvex-locale";
const LEGACY_READING_KEY = "kolvex-public-reading-locale";
const DEFAULT_LOCALE: Locale = "en";
const VALID_LOCALES: Locale[] = ["en", "zh"];

type Dictionary = Record<string, unknown>;

// English is the server-render default and the fallback, so it ships with every page.
// Other locales are separate chunks fetched on demand; a route that must render one on
// the server (the public reading pages render Chinese) registers it synchronously.
const translations: Partial<Record<Locale, Dictionary>> = { en };
const loaders: Record<Exclude<Locale, "en">, () => Promise<Dictionary>> = {
  zh: () => import("./locales/zh.json").then((module) => module.default as Dictionary),
};
const pending = new Map<Locale, Promise<void>>();
const listeners = new Set<() => void>();
let dictionaryVersion = 0;

function publish() {
  dictionaryVersion++;
  listeners.forEach((listener) => listener());
}

export function registerLocale(locale: Locale, dictionary: Dictionary) {
  if (translations[locale]) return;
  translations[locale] = dictionary;
  publish();
}

export function isLocaleLoaded(locale: Locale) {
  return Boolean(translations[locale]);
}

export function loadLocale(locale: Locale): Promise<void> {
  if (translations[locale] || locale === "en") return Promise.resolve();
  let request = pending.get(locale);
  if (!request) {
    request = loaders[locale]()
      .then((dictionary) => registerLocale(locale, dictionary))
      .catch((error) => {
        // English keeps rendering; a later switch retries the download.
        pending.delete(locale);
        throw error;
      });
    pending.set(locale, request);
  }
  return request;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Re-renders the caller when a dictionary finishes loading. */
function useDictionaryVersion() {
  return useSyncExternalStore(
    subscribe,
    () => dictionaryVersion,
    () => dictionaryVersion,
  );
}

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

  const languages = navigator.languages?.length ? navigator.languages : [navigator.language];

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
  return template.replace(/\{(\w+)\}/g, (literal, key: string) =>
    Object.hasOwn(params, key) ? params[key] : literal,
  );
}

export function translateForLocale(
  locale: Locale,
  key: string,
  params?: Record<string, string>,
): string {
  const dictionary = translations[locale];
  const value = dictionary ? getNestedValue(dictionary, key) : undefined;
  if (value !== undefined) return interpolate(value, params);

  // Fallback to English
  if (locale !== DEFAULT_LOCALE) {
    const fallback = getNestedValue(en, key);
    if (fallback !== undefined) return interpolate(fallback, params);
  }

  // Return the key itself as last resort (helps spotting missing translations)
  return key;
}

// ── Context ────────────────────────────────────────────────────
const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

// ── Provider ───────────────────────────────────────────────────
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let preferred = detectBrowserLocale();
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const legacy = localStorage.getItem(LEGACY_READING_KEY);
      if (stored === "en" || stored === "zh") preferred = stored;
      else if (legacy === "en" || legacy === "zh") {
        preferred = legacy;
        localStorage.setItem(STORAGE_KEY, legacy);
      }
    } catch {
      // Some browsing modes disable storage. The browser language still works.
    }
    let active = true;
    // Show the stored language only once its dictionary is here, so no keys flash.
    loadLocale(preferred)
      .catch(() => {
        preferred = DEFAULT_LOCALE;
      })
      .finally(() => {
        if (!active) return;
        setLocaleState(preferred);
        setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (ready) document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale, ready]);

  const setLocale = useCallback(async (newLocale: Locale) => {
    try {
      localStorage.setItem(STORAGE_KEY, newLocale);
    } catch {
      // Navigation still uses the in-memory preference.
    }
    try {
      await loadLocale(newLocale);
    } catch {
      return; // Download failed: stay on the current language rather than show raw keys.
    }
    setLocaleState(newLocale);
  }, []);

  const version = useDictionaryVersion();
  const t = useCallback(
    (key: string, params?: Record<string, string>) => translateForLocale(locale, key, params),
    // `version` changes when a dictionary arrives, so consumers re-translate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale, version],
  );

  const value = useMemo<LanguageContextValue>(
    () => ({ locale, ready, setLocale, t }),
    [locale, ready, setLocale, t],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

/**
 * Render a subtree in one fixed locale regardless of the visitor's preference, so the
 * server HTML and the hydrated page match.
 */
export function FixedLocale({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const { ready, setLocale } = useTranslation();
  const version = useDictionaryVersion();
  useEffect(() => {
    void loadLocale(locale).catch(() => undefined);
  }, [locale]);
  const value = useMemo<LanguageContextValue>(
    () => ({
      locale,
      ready,
      setLocale,
      t: (key: string, params?: Record<string, string>) => translateForLocale(locale, key, params),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale, ready, setLocale, version],
  );
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
