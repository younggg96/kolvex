"use client";

import { useEffect, useRef, useState } from "react";
import { Languages, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { translateText } from "@/components/trading-analysis/translate";
import { useTranslation } from "@/lib/i18n";

// Bounded session-only cache. Originals in the database are never overwritten.
const translations = new Map<string, string[]>();
export default function XTranslatedText({ text, quotes = [], compact = false }: { text: string; quotes?: string[]; compact?: boolean }) {
  const { locale } = useTranslation();
  const c = (en: string, zh: string) => locale === "zh" ? zh : en;
  const [translated, setTranslated] = useState<string[] | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const quotesKey = JSON.stringify(quotes);
  useEffect(() => {
    setTranslated(null); setExpanded(false); setShow(false); setBusy(false); setError(false);
    return () => { controller.current?.abort(); controller.current = null; };
  }, [locale, text, quotesKey]); // source or language changes invalidate the displayed translation

  async function toggle() {
    if (busy) return;
    if (show) { setShow(false); return; }
    if (translated) { setShow(true); return; }
    const key = JSON.stringify([locale, text, quotes]);
    const cached = translations.get(key);
    if (cached) { setTranslated(cached); setShow(true); return; }
    const request = new AbortController();
    controller.current = request;
    const timer = setTimeout(() => request.abort(), 35000);
    setBusy(true); setError(false);
    try {
      const results: string[] = [];
      for (const source of [text, ...quotes]) {
        results.push(await translateText(source, locale, request.signal));
      }
      if (request.signal.aborted) return;
      if (translations.size >= 100) translations.delete(translations.keys().next().value!);
      translations.set(key, results); setTranslated(results); setShow(true);
    } catch {
      if (controller.current === request) setError(true);
    } finally {
      clearTimeout(timer);
      if (controller.current === request) setBusy(false);
    }
  }
  const content = show && translated ? translated : [text, ...quotes];
  return <div className="max-w-prose">
    <p lang={show ? (locale === "zh" ? "zh-CN" : "en") : undefined} className={`${!compact && text.length > 600 && !expanded ? "line-clamp-6" : ""} whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${compact ? "text-sm leading-6 text-muted-foreground" : "text-base leading-7"}`}>{content[0]}</p>
    {!compact && text.length > 600 && <Button type="button" variant="ghost" size="sm" aria-expanded={expanded} onClick={() => setExpanded(value => !value)} className="mt-1 min-h-10 px-2 text-xs">{expanded ? c("Show less", "收起全文") : c("Read full post", "展开全文")}</Button>}
    {content.slice(1).map((quote, index) => <blockquote key={index} className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-muted p-4 text-sm leading-6 [overflow-wrap:anywhere]">{quote}</blockquote>)}
    <div className="mt-1 flex flex-wrap items-center gap-x-3" aria-live="polite">
      <Button type="button" variant="ghost" size="sm" onClick={() => void toggle()} disabled={busy} aria-pressed={show} aria-busy={busy} className="min-h-10 gap-1.5 px-2 text-xs text-muted-foreground">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Languages className="h-3.5 w-3.5" aria-hidden="true" />}
        {busy ? c("Translating…", "正在翻译…") : show ? c("Show original", "显示原文") : c("Translate to English", "翻译成中文")}
      </Button>
      {show && <span className="text-xs text-muted-foreground">{c("Machine translation", "机器翻译")}</span>}
      {error && <span role="alert" className="text-xs text-destructive">{c("Translation failed. Try again.", "翻译失败，请重试。")}</span>}
    </div>
  </div>;
}
