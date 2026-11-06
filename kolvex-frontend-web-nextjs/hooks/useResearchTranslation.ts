"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getResearchTranslation,
  requestResearchTranslation,
  type ResearchTranslation,
  type TradingAnalysis,
} from "@/lib/tradingAnalysisApi";
import { applyResearchTranslation, researchLanguage, RESEARCH_SOURCE_LANGUAGE, storedTranslation } from "@/lib/researchTranslation";

export type ResearchTranslationState = "original" | "translated" | "missing" | "translating" | "error";

const POLL_MS = 4000;
const POLL_LIMIT_MS = 6 * 60 * 1000;

/**
 * Shows a completed research report in the reader's language.
 * Uses the translation stored with the report; for older reports the reader can ask for one,
 * which runs on the server with their own model and is then saved for everyone.
 */
export function useResearchTranslation(analysis: TradingAnalysis | null | undefined, locale: string) {
  const language = researchLanguage(locale);
  const id = analysis?.status === "completed" ? analysis.id : null;
  const [fetched, setFetched] = useState<{ id: string; translation: ResearchTranslation } | null>(null);
  const [pending, setPending] = useState<{ id: string; state: "translating" | "error"; error?: string } | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => { setShowOriginal(false); }, [id]);

  const translation = language === RESEARCH_SOURCE_LANGUAGE
    ? null
    : storedTranslation(analysis, language) || (fetched?.id === id ? fetched.translation : null);

  const poll = useCallback((targetId: string, startedAt: number) => {
    timer.current = setTimeout(async () => {
      try {
        const result = await getResearchTranslation(targetId, language);
        if (result.status === "completed") {
          setFetched({ id: targetId, translation: result.translation });
          setPending(null);
        } else if (result.status === "translating" && Date.now() - startedAt < POLL_LIMIT_MS) {
          poll(targetId, startedAt);
        } else {
          setPending({ id: targetId, state: "error" });
        }
      } catch {
        setPending({ id: targetId, state: "error" });
      }
    }, POLL_MS);
  }, [language]);

  const translate = useCallback(async () => {
    if (!id) return;
    setPending({ id, state: "translating" });
    try {
      const result = await requestResearchTranslation(id, language);
      if (result.status === "completed") {
        setFetched({ id, translation: result.translation });
        setPending(null);
      } else {
        poll(id, Date.now());
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setPending({ id, state: "error", error: message });
    }
  }, [id, language, poll]);

  const localized = useMemo(
    () => (analysis && translation && !showOriginal ? applyResearchTranslation(analysis, translation) : analysis),
    [analysis, translation, showOriginal],
  );

  let state: ResearchTranslationState = "original";
  if (id && language !== RESEARCH_SOURCE_LANGUAGE) {
    if (translation) state = "translated";
    else if (pending?.id === id) state = pending.state;
    else state = "missing";
  }

  return {
    analysis: localized ?? null,
    language,
    state,
    error: pending?.id === id ? pending.error : undefined,
    showOriginal,
    setShowOriginal,
    translate,
  };
}

export type ResearchTranslationControl = ReturnType<typeof useResearchTranslation>;
