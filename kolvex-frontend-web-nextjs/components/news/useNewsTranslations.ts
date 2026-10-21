"use client";

import { useEffect, useState } from "react";
import { translateText } from "@/components/trading-analysis/translate";
import type { FeedArticle } from "@/lib/newsFeed";

// Public headlines only; bounded in-memory cache, keyed by exact source text.
const chineseTitles = new Map<string, string>();
const CACHE_LIMIT = 1000;
const CONCURRENCY = 3;

export function useNewsTranslations(articles: FeedArticle[], locale: string) {
  const sourceKey = JSON.stringify(articles.map(article => article.title));
  const key = `${locale}:${sourceKey}`;
  const [progress, setProgress] = useState({ key: "", pending: 0, failed: 0 });
  const [attempt, setAttempt] = useState(0);
  const [, updateTitles] = useState(0);

  useEffect(() => {
    if (locale !== "zh") return;
    const titles = Array.from(new Set<string>(JSON.parse(sourceKey)));
    const work = titles.filter(title => !chineseTitles.has(title));
    const controller = new AbortController();
    let active = true, cursor = 0, completed = 0, failed = 0;
    setProgress({ key, pending: work.length, failed: 0 });
    const timeout = setTimeout(() => controller.abort(), 45_000);

    async function worker() {
      while (active && !controller.signal.aborted && cursor < work.length) {
        const title = work[cursor++];
        try {
          const translated = await translateText(title, "zh", controller.signal);
          if (!active || controller.signal.aborted) return;
          chineseTitles.set(title, translated);
          if (chineseTitles.size > CACHE_LIMIT) chineseTitles.delete(chineseTitles.keys().next().value!);
          updateTitles(value => value + 1);
        } catch {
          if (!active) return;
          failed++;
        }
        completed++;
        if (active) setProgress({ key, pending: work.length - completed, failed });
      }
    }

    void Promise.all(Array.from({ length: Math.min(CONCURRENCY, work.length) }, worker)).then(() => {
      clearTimeout(timeout);
      if (active) setProgress({ key, pending: 0, failed: failed + work.length - completed });
    });
    return () => { active = false; controller.abort(); clearTimeout(timeout); };
  }, [key, sourceKey, locale, attempt]);

  const translations: Record<string, string> = Object.create(null);
  if (locale === "zh") for (const article of articles) {
    const title = chineseTitles.get(article.title);
    if (title) translations[article.title] = title;
  }
  return {
    translations,
    pending: locale === "zh" && progress.key === key ? progress.pending : 0,
    failed: locale === "zh" && progress.key === key ? progress.failed : 0,
    retry: () => setAttempt(value => value + 1),
  };
}
