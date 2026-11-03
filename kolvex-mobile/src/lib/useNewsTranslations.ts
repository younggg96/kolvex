import { useEffect, useState } from "react";
import { translateText, translationAvailable } from "./translateText";
// Public headlines only; bounded in-memory cache, keyed by exact source text.
const titles = new Map<string, string>();
const CACHE_LIMIT = 1000;
const CONCURRENCY = 3;
export function useNewsTranslations(sources: string[], locale: string) {
  const sourceKey = JSON.stringify(sources);
  const active = locale === "zh" && translationAvailable;
  const key = `${locale}:${sourceKey}`;
  const [progress, setProgress] = useState({ key: "", pending: 0, failed: 0 });
  const [attempt, setAttempt] = useState(0);
  const [, repaint] = useState(0);
  useEffect(() => {
    if (!active) return;
    const work = [...new Set<string>(JSON.parse(sourceKey))].filter(
      (title) => !titles.has(title),
    );
    const controller = new AbortController();
    let live = true;
    let cursor = 0;
    let completed = 0;
    let failed = 0;
    const timeout = setTimeout(() => controller.abort(), 45_000);
    async function worker() {
      while (live && !controller.signal.aborted && cursor < work.length) {
        const title = work[cursor++];
        try {
          const translated = await translateText(
            title,
            "zh",
            controller.signal,
          );
          if (!live || controller.signal.aborted) return;
          titles.set(title, translated);
          if (titles.size > CACHE_LIMIT)
            titles.delete(titles.keys().next().value as string);
          repaint((value) => value + 1);
        } catch {
          if (!live) return;
          failed++;
        }
        completed++;
        if (live)
          setProgress({ key, pending: work.length - completed, failed });
      }
    }
    void Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, work.length) }, worker),
    ).then(() => {
      clearTimeout(timeout);
      if (live)
        setProgress({
          key,
          pending: 0,
          failed: failed + work.length - completed,
        });
    });
    return () => {
      live = false;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [active, key, sourceKey, attempt]);
  const current = active && progress.key === key;
  const waiting = active
    ? new Set(sources.filter((source) => !titles.has(source))).size
    : 0;
  return {
    title: (source: string) => (active ? titles.get(source) : undefined),
    pending: current ? progress.pending : waiting,
    failed: current ? progress.failed : 0,
    retry: () => setAttempt((value) => value + 1),
  };
}
