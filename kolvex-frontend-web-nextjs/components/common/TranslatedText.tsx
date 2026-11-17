"use client";

import { useEffect, useState, type ElementType } from "react";
import { translateText } from "@/components/trading-analysis/translate";
import { chineseTextLanguage } from "@/lib/contentLanguage";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// Public opinion text only; bounded in-memory cache keyed by exact source text.
const english = new Map<string, string>();
const pending = new Map<string, Promise<string>>();
const CACHE_LIMIT = 2000;
const CONCURRENCY = 3;
let running = 0;
const queue: (() => void)[] = [];

function schedule<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      running++;
      task()
        .then(resolve, reject)
        .finally(() => {
          running--;
          queue.shift()?.();
        });
    };
    if (running < CONCURRENCY) run();
    else queue.push(run);
  });
}

function toEnglish(text: string): Promise<string> {
  const cached = english.get(text);
  if (cached) return Promise.resolve(cached);
  const inFlight = pending.get(text);
  if (inFlight) return inFlight;
  const request = schedule(() => translateText(text, "en"))
    .then((translated) => {
      english.set(text, translated);
      if (english.size > CACHE_LIMIT) english.delete(english.keys().next().value!);
      return translated;
    })
    .finally(() => pending.delete(text));
  pending.set(text, request);
  return request;
}

/**
 * Renders creator-sourced text. When the interface is English and the text is
 * Chinese, it shows a machine translation and keeps the original on hover.
 * If translation fails the original stays visible; nothing is invented.
 */
export function useEnglishTranslation(text?: string | null) {
  const { locale } = useTranslation();
  const source = text?.trim() ? text : "";
  const wanted = locale === "en" && Boolean(chineseTextLanguage(source));
  const [, refresh] = useState(0);

  useEffect(() => {
    if (!wanted || english.has(source)) return;
    let active = true;
    toEnglish(source).then(
      () => active && refresh((value) => value + 1),
      () => undefined,
    );
    return () => {
      active = false;
    };
  }, [source, wanted]);

  const translated = wanted ? english.get(source) : undefined;
  return { text: translated ?? source, translated: Boolean(translated), original: source };
}

export default function TranslatedText({
  text,
  as: Tag = "span",
  className,
}: {
  text?: string | null;
  as?: ElementType;
  className?: string;
}) {
  const { t } = useTranslation();
  const result = useEnglishTranslation(text);
  if (!result.original) return null;
  return (
    <Tag
      lang={result.translated ? "en" : chineseTextLanguage(result.original)}
      title={
        result.translated
          ? `${t("common.machineTranslatedOriginal")}: ${result.original}`
          : undefined
      }
      className={cn(className)}
    >
      {result.text}
    </Tag>
  );
}
