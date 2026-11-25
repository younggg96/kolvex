"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PriceChart from "@/components/youtube/PriceChart";
import { useTranslation } from "@/lib/i18n";
import { isValidStockSymbol, normalizeStockSymbol } from "@/lib/stockLinks";

const LAST_SYMBOL_KEY = "kolvex:chart-terminal:symbol";
const FALLBACK_SYMBOL = "SPY";

function readLastSymbol(): string | null {
  try {
    return window.localStorage.getItem(LAST_SYMBOL_KEY);
  } catch {
    return null;
  }
}

/**
 * 看盘: the advanced chart as a page of its own. The symbol lives in the URL (`?symbol=`), so a
 * link or a reload opens the same chart; without one it reopens the last symbol charted here.
 */
export default function ChartTerminal() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useSearchParams();
  const fromUrl = normalizeStockSymbol(params.get("symbol") ?? "");
  const [symbol, setSymbol] = useState<string | null>(isValidStockSymbol(fromUrl) ? fromUrl : null);

  // No (valid) symbol in the URL: reopen the last one, else a broad-market default.
  useEffect(() => {
    if (isValidStockSymbol(fromUrl)) {
      setSymbol(fromUrl);
      return;
    }
    const last = normalizeStockSymbol(readLastSymbol() ?? "");
    const next = isValidStockSymbol(last) ? last : FALLBACK_SYMBOL;
    setSymbol(next);
    router.replace(`/dashboard/chart?symbol=${encodeURIComponent(next)}`, { scroll: false });
  }, [fromUrl, router]);

  useEffect(() => {
    if (!symbol) return;
    try {
      window.localStorage.setItem(LAST_SYMBOL_KEY, symbol);
    } catch {
      // Remembering the last symbol is a convenience only.
    }
  }, [symbol]);

  const show = useCallback(
    (next: string) => {
      const clean = normalizeStockSymbol(next);
      if (!isValidStockSymbol(clean)) return false;
      setSymbol(clean);
      // Replace, not push: switching charts shouldn't fill Back with every ticker tried.
      router.replace(`/dashboard/chart?symbol=${encodeURIComponent(clean)}`, { scroll: false });
      return true;
    },
    [router],
  );

  const formatDate = useCallback(
    (value: string) => new Date(value).toLocaleDateString(t("common.intlLocale")),
    [t],
  );

  return (
    // Phones: leave room for the floating tab bar and the panel sheet docked above it, so the
    // oscillator isn't hidden under them.
    <div className="flex h-[calc(100dvh-var(--app-header-height,0px))] min-h-[32rem] min-w-0 flex-1 flex-col max-lg:pb-[calc(8.5rem+env(safe-area-inset-bottom))]">
      <h1 className="sr-only">{t("sidebar.chart")}</h1>
      {symbol && (
        <PriceChart
          symbol={symbol}
          range="3M"
          from=""
          to=""
          opinions={[]}
          formatDate={formatDate}
          t={t}
          terminal={{ onSelectSymbol: show }}
        />
      )}
    </div>
  );
}
