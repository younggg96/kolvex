"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
  const terminalRef = useRef<HTMLDivElement>(null);
  const nativeFullscreen = useRef(false);
  const pendingFullscreen = useRef(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const dismiss = () => {
      if (!nativeFullscreen.current || document.fullscreenElement === document.documentElement)
        return;
      nativeFullscreen.current = false;
      setFullscreen(false);
    };
    document.addEventListener("fullscreenchange", dismiss);
    return () => {
      document.removeEventListener("fullscreenchange", dismiss);
      if (nativeFullscreen.current && document.fullscreenElement === document.documentElement) {
        void document.exitFullscreen().catch(() => {});
      }
      nativeFullscreen.current = false;
    };
  }, []);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (event: KeyboardEvent) => {
      if (
        !pendingFullscreen.current &&
        event.key === "Escape" &&
        !event.defaultPrevented &&
        !document.fullscreenElement &&
        !document.querySelector('[role="dialog"][data-state="open"]')
      ) {
        setFullscreen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  async function toggleFullscreen() {
    if (pendingFullscreen.current) return;
    const root = document.documentElement;
    if (fullscreen) {
      if (nativeFullscreen.current && document.fullscreenElement === root) {
        await document.exitFullscreen().catch(() => {});
      } else {
        setFullscreen(false);
      }
      return;
    }

    setFullscreen(true);
    if (!document.fullscreenEnabled || document.fullscreenElement) return;
    pendingFullscreen.current = true;
    try {
      // Portalled chart dialogs and selectors stay in the fullscreen document.
      await root.requestFullscreen({ navigationUI: "hide" });
      if (terminalRef.current) nativeFullscreen.current = document.fullscreenElement === root;
      else if (document.fullscreenElement === root) await document.exitFullscreen();
    } catch {
      // The chart still fills the browser viewport when native fullscreen is unavailable.
    } finally {
      pendingFullscreen.current = false;
    }
  }
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
    (value: string) =>
      new Date(value).toLocaleDateString(t("common.intlLocale"), { timeZone: "UTC" }),
    [t],
  );

  const fullscreenLabel = t(
    `youtubeOpinions.${fullscreen ? "exitTerminalFullscreen" : "terminalFullscreen"}`,
  );
  const FullscreenIcon = fullscreen ? Minimize2 : Maximize2;

  return (
    // Phones: leave room for the floating tab bar and the panel sheet docked above it, so the
    // oscillator isn't hidden under them.
    <div
      ref={terminalRef}
      data-chart-fullscreen={fullscreen || undefined}
      className={cn(
        "flex min-w-0 flex-1 flex-col max-lg:has-[[data-chart-replay]]:pb-0",
        fullscreen
          ? "h-dvh min-h-0 bg-background pt-[env(safe-area-inset-top)] max-lg:pb-[calc(5.25rem+env(safe-area-inset-bottom))] max-sm:[&_[data-price-graph]]:min-h-[clamp(14rem,40svh,24rem)]"
          : "h-[calc(100dvh-var(--app-header-height,0px))] min-h-[32rem] max-lg:pb-[calc(8.5rem+env(safe-area-inset-bottom))]",
      )}
    >
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
            fullscreen,
            headerActions: (
              <Button
                type="button"
                variant="toolbar"
                size="toolbar"
                selected={fullscreen}
                className="focus-visible:ring-1 focus-visible:ring-ring"
                aria-pressed={fullscreen}
                aria-label={fullscreenLabel}
                title={fullscreenLabel}
                onClick={() => void toggleFullscreen()}
              >
                <FullscreenIcon className="h-4 w-4" aria-hidden="true" />
              </Button>
            ),
          }}
        />
      )}
    </div>
  );
}
