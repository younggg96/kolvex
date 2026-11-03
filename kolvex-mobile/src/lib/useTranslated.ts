import { useEffect, useRef, useState } from "react";
import { usePreferences } from "../state/Preferences";
import { translateProtected, translationAvailable } from "./translateText";
// Session-only; stored originals are never overwritten.
const cache = new Map<string, string>();
const LIMIT = 500;
export function useTranslated(text: string) {
  const { locale } = usePreferences();
  const key = `${locale}:${text}`;
  // Held per source text, so a recycled row never shows another row's translation.
  const [shownKey, setShownKey] = useState<string>();
  const [failedKey, setFailedKey] = useState<string>();
  const [busy, setBusy] = useState(false);
  const action = useRef<AbortController | null>(null);
  const show = shownKey === key;
  useEffect(() => () => action.current?.abort(), [key]);
  async function toggle() {
    if (show) return setShownKey(undefined);
    if (cache.has(key)) return setShownKey(key);
    if (action.current) return;
    const controller = new AbortController();
    action.current = controller;
    setBusy(true);
    setFailedKey(undefined);
    try {
      const translated = await translateProtected(
        text,
        locale,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      if (cache.size >= LIMIT)
        cache.delete(cache.keys().next().value as string);
      cache.set(key, translated);
      setShownKey(key);
    } catch {
      if (!controller.signal.aborted) setFailedKey(key);
    } finally {
      action.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return {
    available: translationAvailable,
    shown: show ? (cache.get(key) ?? text) : text,
    show,
    busy,
    failed: failedKey === key,
    toggle,
  };
}
