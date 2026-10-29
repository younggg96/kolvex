"use client";

import { useEffect, useRef, useState } from "react";
import { translateText } from "@/components/trading-analysis/translate";
import { briefSourceLanguage, translateBrief, type BriefLanguage } from "@/lib/briefTranslation";
import type { DailyBrief } from "@/lib/dailyBriefs";

export function useBriefTranslation(document: DailyBrief, language: BriefLanguage) {
  const source = JSON.stringify(document);
  const key = `${language}:${source}`;
  const originalLanguage = briefSourceLanguage(document);
  const cache = useRef({ source, texts: new Map<string, string>() });
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ key: string; document?: DailyBrief; error: boolean }>({ key: "", error: false });

  useEffect(() => {
    if (cache.current.source !== source) cache.current = { source, texts: new Map() };
    if (originalLanguage === language) return;
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 90_000);
    setState({ key, error: false });
    void translateBrief(JSON.parse(source), language, translateText, controller.signal, cache.current.texts)
      .then(translated => { if (active) setState({ key, document: translated, error: false }); })
      .catch(() => {
        controller.abort();
        if (active) setState({ key, error: true });
      })
      .finally(() => clearTimeout(timeout));
    return () => { active = false; controller.abort(); clearTimeout(timeout); };
  }, [source, key, language, originalLanguage, attempt]);

  const needsTranslation = originalLanguage !== language;
  const current = state.key === key ? state : undefined;
  const pending = needsTranslation && !current?.document && !current?.error;
  return {
    document: needsTranslation ? current?.document ?? document : document,
    displayLanguage: needsTranslation && !current?.document ? originalLanguage : language,
    pending,
    error: needsTranslation && !!current?.error,
    retry: () => setAttempt(value => value + 1),
  };
}
