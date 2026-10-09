import { useState, useCallback, useRef, useEffect } from "react";
import { translateText } from "./translate";

// Key translations by their source and language so historical reports never
// display a translation from a different version.
function useTranslation(entries: [string, string][], locale: string) {
  const targetLang = locale === "en" ? "zh" : locale;
  const sourceKey = JSON.stringify([targetLang, entries]);
  const [state, setState] = useState({
    sourceKey,
    showTranslated: false,
    isTranslating: false,
    translationError: false,
    translated: null as Record<string, string> | null,
  });
  const request = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      request.current?.abort();
      request.current = null;
    };
  }, [sourceKey]);

  const current = state.sourceKey === sourceKey ? state : null;
  const showTranslated = current?.showTranslated ?? false;
  const isTranslating = current?.isTranslating ?? false;
  const translationError = current?.translationError ?? false;
  const translated = current?.translated ?? null;

  const toggle = useCallback(async () => {
    if (request.current || !entries.length) return;
    if (translated) {
      setState({
        sourceKey,
        translated,
        showTranslated: !showTranslated,
        isTranslating: false,
        translationError: false,
      });
      return;
    }

    const controller = new AbortController();
    request.current = controller;
    setState({
      sourceKey,
      translated: null,
      showTranslated: false,
      isTranslating: true,
      translationError: false,
    });
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const results = await Promise.all(
        entries.map(
          async ([key, content]) =>
            [
              key,
              await translateText(content, targetLang, controller.signal),
            ] as const,
        ),
      );
      if (request.current !== controller) return;
      setState({
        sourceKey,
        translated: Object.fromEntries(results),
        showTranslated: true,
        isTranslating: false,
        translationError: false,
      });
    } catch {
      if (request.current !== controller) return;
      controller.abort();
      setState({
        sourceKey,
        translated: null,
        showTranslated: false,
        isTranslating: false,
        translationError: true,
      });
    } finally {
      clearTimeout(timeout);
      if (request.current === controller) request.current = null;
    }
  }, [entries, sourceKey, targetLang, translated, showTranslated]);

  return {
    showTranslated,
    isTranslating,
    translationError,
    translated,
    toggle,
  };
}

export function useContentTranslation(
  originalContent: string | null | undefined,
  locale: string,
) {
  const { translated, ...translation } = useTranslation(
    originalContent ? [["content", originalContent]] : [],
    locale,
  );
  const displayContent = translation.showTranslated
    ? (translated?.content ?? originalContent)
    : originalContent;
  return { ...translation, displayContent };
}

export function useDebateTranslation(
  debate: Record<string, string> | null | undefined,
  keys: string[],
  locale: string,
) {
  const entries: [string, string][] = keys
    .filter((key) => key && debate?.[key])
    .map((key) => [key, debate![key]]);
  const { translated, ...translation } = useTranslation(entries, locale);
  const getContent = useCallback(
    (key: string) => {
      return (
        (translation.showTranslated ? translated?.[key] : null) ??
        debate?.[key] ??
        null
      );
    },
    [debate, translation.showTranslated, translated],
  );
  return { ...translation, getContent };
}
