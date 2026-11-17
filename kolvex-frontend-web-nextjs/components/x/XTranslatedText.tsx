"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Languages, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { translateText } from "@/components/trading-analysis/translate";
import { useTranslation } from "@/lib/i18n";
import type { XPost } from "@/lib/xContentApi";

// Bounded session-only cache. Originals in the database are never overwritten.
const translations = new Map<string, string[]>();
let activeTranslations = 0;
const translationQueue: Array<() => void> = [];
const IDENTIFIER_PATTERN = /https?:\/\/[^\s]+|\$[A-Za-z][A-Za-z0-9.\-]{0,14}\b/g;
// Placeholder for a protected identifier: the bracket-wrapped source index, e.g.
// "⟨0⟩". Machine translation keeps these brackets and digits verbatim (an ASCII
// word or bare number is translated, e.g. "Bloom" → "布卢姆", "0" → "LE"), so the
// index alone is enough to map each placeholder back to its identifier.
const TAG = { open: "⟨", close: "⟩" };
const TAG_PATTERN = new RegExp(`${TAG.open}(\\d+)${TAG.close}`, "g");
// Restore placeholders in place; anything the service left malformed is stripped so
// no marker text ever reaches the reader.
function restoreIdentifiers(translated: string, literals: string[]) {
  return translated
    .replace(TAG_PATTERN, (_, index: string) => literals[Number(index)] ?? "")
    .replace(new RegExp(`${TAG.open}\\d*${TAG.close}?`, "g"), "");
}
// If the service drops or reorders placeholders, keep the translation but append the
// identifiers it lost so cashtags never silently disappear from the post.
function appendDroppedIdentifiers(restored: string, literals: string[]) {
  const dropped = literals.filter((literal) => !restored.includes(literal));
  return dropped.length ? `${restored.trimEnd()} ${dropped.join(" ")}` : restored;
}
async function queuedTranslation(text: string, locale: string, signal: AbortSignal) {
  if (activeTranslations >= 3) await new Promise<void>((resolve) => translationQueue.push(resolve));
  else activeTranslations++;
  try {
    signal.throwIfAborted();
    // Keep financial identifiers and source URLs literal in every target language.
    const literals: string[] = [];
    const protectedText = text.replace(IDENTIFIER_PATTERN, (value) => {
      if (!value) return value;
      literals.push(value);
      return `${TAG.open}${literals.length - 1}${TAG.close}`;
    });
    // Waiting behind other visible posts does not consume the request timeout.
    const request = new AbortController();
    const cancel = () => request.abort();
    signal.addEventListener("abort", cancel, { once: true });
    const timer = setTimeout(cancel, 20000);
    let translated: string;
    try {
      translated = await translateText(protectedText, locale, request.signal);
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
    }
    signal.throwIfAborted();
    return appendDroppedIdentifiers(restoreIdentifiers(translated, literals), literals);
  } finally {
    const next = translationQueue.shift();
    if (next) next();
    else activeTranslations--;
  }
}
export default function XTranslatedText({
  text,
  quotes = [],
  compact = false,
  preparedChinese,
}: {
  text: string;
  quotes?: string[];
  compact?: boolean;
  preparedChinese?: XPost["translation_zh"];
}) {
  const { locale } = useTranslation();
  const c = (en: string, zh: string) => (locale === "zh" ? zh : en);
  const [translated, setTranslated] = useState<string[] | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const sourceKey = JSON.stringify([text, ...quotes]);
  const prepared =
    locale === "zh" &&
    preparedChinese?.text &&
    preparedChinese.quoted_texts.length === quotes.length
      ? preparedChinese
      : null;
  const key = `${locale}:${sourceKey}`;
  const hasPrepared = prepared !== null;
  const [originalKey, setOriginalKey] = useState<string | null>(null);
  const [resultKey, setResultKey] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [visible, setVisible] = useState(false);
  const runTranslation = useCallback(
    async (signal: AbortSignal) => {
      const cached = translations.get(key);
      if (cached) return cached;
      const results: string[] = [];
      for (const source of JSON.parse(sourceKey) as string[]) {
        results.push(await queuedTranslation(source, locale, signal));
      }
      signal.throwIfAborted();
      if (translations.size >= 100) translations.delete(translations.keys().next().value!);
      translations.set(key, results);
      return results;
    },
    [key, sourceKey, locale],
  );

  useEffect(() => {
    const element = root.current;
    if (!element || hasPrepared) return;
    if (!("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "160px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasPrepared]);

  useEffect(() => {
    setTranslated(null);
    setExpanded(false);
    setShow(false);
    setBusy(false);
    setError(false);
    setResultKey(key);
    if (hasPrepared || !visible) return;
    const controller = new AbortController();
    let current = true;
    setBusy(true);
    void runTranslation(controller.signal)
      .then((result) => {
        if (current) {
          setTranslated(result);
          setShow(true);
        }
      })
      .catch(() => {
        if (current) setError(true);
      })
      .finally(() => {
        if (current) setBusy(false);
      });
    return () => {
      current = false;
      controller.abort();
    };
  }, [key, visible, attempt, runTranslation, hasPrepared]);

  function toggle() {
    if (hasPrepared) {
      setOriginalKey((previous) => (previous === key ? null : key));
      return;
    }
    if (busy) return;
    if (translated) setShow((value) => !value);
    else setAttempt((value) => value + 1);
  }
  const currentTranslation = resultKey === key && show ? translated : null;
  const contentTranslation = prepared
    ? originalKey === key
      ? null
      : [prepared.text, ...prepared.quoted_texts]
    : currentTranslation;
  const showingTranslation = contentTranslation !== null;
  const content = contentTranslation ?? [text, ...quotes];
  const isBusy = !hasPrepared && resultKey === key && busy;
  const hasError = !hasPrepared && resultKey === key && error;
  return (
    <div ref={root} className="w-full min-w-0 max-w-none">
      <p
        lang={showingTranslation ? (locale === "zh" ? "zh-CN" : "en") : undefined}
        className={`${!compact && text.length > 600 && !expanded ? "line-clamp-6" : ""} whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${compact ? "text-sm leading-6 text-muted-foreground" : "text-base leading-7"}`}
      >
        {content[0]}
      </p>
      {!compact && text.length > 600 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className="mt-1 min-h-10 px-2 text-xs"
        >
          {expanded ? c("Show less", "收起全文") : c("Read full post", "展开全文")}
        </Button>
      )}
      {content.slice(1).map((quote, index) => (
        <blockquote
          key={index}
          className="mt-3 whitespace-pre-wrap break-words rounded-3xl bg-muted p-4 text-sm leading-6 [overflow-wrap:anywhere]"
        >
          {quote}
        </blockquote>
      ))}
      <div className="mt-1 flex flex-wrap items-center gap-x-3" aria-live="polite">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void toggle()}
          disabled={isBusy}
          aria-pressed={showingTranslation}
          aria-busy={isBusy}
          className="min-h-10 gap-1.5 px-2 text-xs text-muted-foreground"
        >
          {isBusy ? (
            <Loader2
              className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : (
            <Languages className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {isBusy
            ? c("Translating…", "正在翻译…")
            : showingTranslation
              ? c("Show original", "显示原文")
              : hasError
                ? c("Retry translation", "重试翻译")
                : c("Show translation", "显示译文")}
        </Button>
        {showingTranslation && (
          <span className="text-xs text-muted-foreground">
            {c("Machine translation", "机器翻译")}
          </span>
        )}
        {hasError && (
          <span role="alert" className="text-xs text-destructive">
            {c("Translation unavailable. Showing original.", "翻译暂不可用，已显示原文。")}
          </span>
        )}
      </div>
    </div>
  );
}
