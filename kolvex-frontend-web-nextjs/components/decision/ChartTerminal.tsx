"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import PriceChart from "@/components/youtube/PriceChart";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/lib/i18n";
import { isValidStockSymbol, marketStockHref, normalizeStockSymbol } from "@/lib/stockLinks";
import { cn } from "@/lib/utils";

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
  const [draft, setDraft] = useState("");
  const [invalid, setInvalid] = useState(false);

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

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) return;
    if (show(draft)) {
      setDraft("");
      setInvalid(false);
    } else setInvalid(true);
  };

  const formatDate = useCallback(
    (value: string) => new Date(value).toLocaleDateString(t("common.intlLocale")),
    [t],
  );

  return (
    // Phones: leave room for the floating tab bar so the oscillator isn't hidden under it.
    <div className="flex h-[calc(100dvh-var(--app-header-height,0px))] min-h-[32rem] min-w-0 flex-1 flex-col max-lg:pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
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
          terminal={{
            onSelectSymbol: show,
            headerActions: (
              <div className="flex items-center gap-1.5">
                <form onSubmit={submit} role="search" className="flex items-center">
                  <Input
                    value={draft}
                    onChange={(event) => {
                      setDraft(event.target.value);
                      setInvalid(false);
                    }}
                    placeholder={t("chartTerminal.symbolPlaceholder")}
                    aria-label={t("chartTerminal.symbolLabel")}
                    aria-invalid={invalid}
                    title={invalid ? t("chartTerminal.symbolInvalid") : undefined}
                    autoCapitalize="characters"
                    spellCheck={false}
                    maxLength={12}
                    className={cn(
                      // Phones keep the 44px / 16px input (no iOS zoom), just narrower.
                      "!w-24 rounded-full px-3 uppercase placeholder:normal-case sm:!h-8 sm:!w-28 sm:text-xs",
                      invalid && "border-negative",
                    )}
                  />
                </form>
                <Link
                  href={marketStockHref(symbol)}
                  className="inline-flex h-11 w-11 items-center justify-center gap-1 rounded-full text-xs font-medium text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-8 sm:w-auto sm:px-2.5"
                  title={t("chartTerminal.openStock", { symbol })}
                  aria-label={t("chartTerminal.openStock", { symbol })}
                >
                  <span className="max-sm:hidden">{t("chartTerminal.stockPage")}</span>
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            ),
          }}
        />
      )}
    </div>
  );
}
