"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Languages, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { translateText } from "@/components/trading-analysis/translate";
import { useTranslation } from "@/lib/i18n";

// Bounded session-only cache. Originals in the database are never overwritten.
const translations = new Map<string, string[]>();
let activeTranslations = 0;
const translationQueue: Array<() => void> = [];
async function queuedTranslation(text: string, locale: string, signal: AbortSignal) {
  if (activeTranslations >= 3) await new Promise<void>(resolve => translationQueue.push(resolve));
  else activeTranslations++;
  try {
    signal.throwIfAborted();
    // Keep financial identifiers and source URLs literal in every target language.
    let prefix = "KOLVEXLITERAL";
    while (text.includes(prefix)) prefix += "X";
    const literals: string[] = [];
    const protectedText = text.replace(/https?:\/\/[^\s]+|\$[A-Za-z][A-Za-z0-9.\-]{0,14}\b/g, value => {
      const token = `${prefix}${literals.length}TOKEN`;
      literals.push(value);
      return token;
    });
    let result = await translateText(protectedText, locale, signal);
    for (const [index, literal] of literals.entries()) {
      const token = `${prefix}${index}TOKEN`;
      if (!result.includes(token)) throw new Error("Translation changed a source identifier");
      result = result.replaceAll(token, literal);
    }
    return result;
  }
  finally { const next = translationQueue.shift(); if (next) next(); else activeTranslations--; }
}
export default function XTranslatedText({ text, quotes = [], compact = false }: { text: string; quotes?: string[]; compact?: boolean }) {
  const { locale } = useTranslation();
  const c = (en: string, zh: string) => locale === "zh" ? zh : en;
  const [translated, setTranslated] = useState<string[] | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const sourceKey = JSON.stringify([text, ...quotes]);
  const key = `${locale}:${sourceKey}`;
  const [resultKey, setResultKey] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [visible, setVisible] = useState(false);
  const runTranslation = useCallback(async (signal: AbortSignal) => {
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
  }, [key, sourceKey, locale]);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    if (!("IntersectionObserver" in window)) { setVisible(true); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: "160px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setTranslated(null); setExpanded(false); setShow(false); setBusy(false); setError(false);
    setResultKey(key);
    if (!visible) return;
    const controller = new AbortController();
    let current = true;
    const timer = setTimeout(() => controller.abort(), 45000);
    setBusy(true);
    void runTranslation(controller.signal).then(result => {
      if (current) { setTranslated(result); setShow(true); }
    }).catch(() => { if (current) setError(true); }).finally(() => {
      clearTimeout(timer);
      if (current) setBusy(false);
    });
    return () => { current = false; controller.abort(); clearTimeout(timer); };
  }, [key, visible, attempt, runTranslation]);

  function toggle() {
    if (busy) return;
    if (translated) setShow(value => !value);
    else setAttempt(value => value + 1);
  }
  const showingTranslation = resultKey === key && show && translated;
  const content = showingTranslation ? translated! : [text, ...quotes];
  return <div ref={root} className="w-full min-w-0 max-w-none">
    <p lang={showingTranslation ? (locale === "zh" ? "zh-CN" : "en") : undefined} className={`${!compact && text.length > 600 && !expanded ? "line-clamp-6" : ""} whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${compact ? "text-sm leading-6 text-muted-foreground" : "text-base leading-7"}`}>{content[0]}</p>
    {!compact && text.length > 600 && <Button type="button" variant="ghost" size="sm" aria-expanded={expanded} onClick={() => setExpanded(value => !value)} className="mt-1 min-h-10 px-2 text-xs">{expanded ? c("Show less", "收起全文") : c("Read full post", "展开全文")}</Button>}
    {content.slice(1).map((quote, index) => <blockquote key={index} className="mt-3 whitespace-pre-wrap break-words rounded-3xl bg-muted p-4 text-sm leading-6 [overflow-wrap:anywhere]">{quote}</blockquote>)}
    <div className="mt-1 flex flex-wrap items-center gap-x-3" aria-live="polite">
      <Button type="button" variant="ghost" size="sm" onClick={() => void toggle()} disabled={busy} aria-pressed={!!showingTranslation} aria-busy={busy} className="min-h-10 gap-1.5 px-2 text-xs text-muted-foreground">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Languages className="h-3.5 w-3.5" aria-hidden="true" />}
        {busy ? c("Translating…", "正在翻译…") : showingTranslation ? c("Show original", "显示原文") : error ? c("Retry translation", "重试翻译") : c("Show translation", "显示译文")}
      </Button>
      {showingTranslation && <span className="text-xs text-muted-foreground">{c("Machine translation", "机器翻译")}</span>}
      {error && <span role="alert" className="text-xs text-destructive">{c("Translation unavailable. Showing original.", "翻译暂不可用，已显示原文。")}</span>}
    </div>
  </div>;
}
