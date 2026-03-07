import { useState, useCallback, useRef } from "react";
import { translateText } from "./translate";

export function useContentTranslation(
  originalContent: string | null | undefined,
  locale: string
) {
  const [showTranslated, setShowTranslated] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedContent, setTranslatedContent] = useState<string | null>(
    null
  );
  const translatedForLocale = useRef<string | null>(null);

  const toggle = useCallback(() => {
    if (isTranslating || !originalContent) return;

    if (showTranslated) {
      setShowTranslated(false);
      return;
    }

    if (translatedForLocale.current) {
      setShowTranslated(true);
      return;
    }

    const targetLang = locale === "en" ? "zh" : locale;
    setIsTranslating(true);

    translateText(originalContent, targetLang)
      .then((result) => {
        setTranslatedContent(result);
        translatedForLocale.current = targetLang;
        setShowTranslated(true);
      })
      .catch((err) => console.error("Translation failed:", err))
      .finally(() => setIsTranslating(false));
  }, [isTranslating, showTranslated, originalContent, locale]);

  const displayContent =
    showTranslated && translatedContent ? translatedContent : originalContent;

  return { displayContent, showTranslated, isTranslating, toggle };
}

export function useDebateTranslation(
  debate: Record<string, string> | null | undefined,
  keys: string[],
  locale: string
) {
  const [showTranslated, setShowTranslated] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translated, setTranslated] = useState<Record<string, string>>({});
  const translatedForLocale = useRef<string | null>(null);

  const toggle = useCallback(() => {
    if (isTranslating || !debate) return;

    if (showTranslated) {
      setShowTranslated(false);
      return;
    }

    if (translatedForLocale.current) {
      setShowTranslated(true);
      return;
    }

    const targetLang = locale === "en" ? "zh" : locale;
    const activeKeys = keys.filter((k) => k && debate[k]);
    if (activeKeys.length === 0) return;

    setIsTranslating(true);

    Promise.all(activeKeys.map((k) => translateText(debate[k], targetLang)))
      .then((results) => {
        const map: Record<string, string> = {};
        activeKeys.forEach((k, i) => {
          map[k] = results[i];
        });
        setTranslated(map);
        translatedForLocale.current = targetLang;
        setShowTranslated(true);
      })
      .catch((err) => console.error("Translation failed:", err))
      .finally(() => setIsTranslating(false));
  }, [isTranslating, showTranslated, debate, keys, locale]);

  const getContent = useCallback(
    (key: string) => {
      if (!debate) return null;
      return showTranslated && translated[key]
        ? translated[key]
        : debate[key] || null;
    },
    [debate, showTranslated, translated]
  );

  return { showTranslated, isTranslating, toggle, getContent };
}
