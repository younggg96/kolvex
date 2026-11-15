"use client";
import { useEffect } from "react";
import { CLOSED_MARKET_POLL_MS, usMarketsClosed } from "@/lib/pollingSchedule";

/**
 * Quote readers revalidate on return; hidden tabs do not keep polling. While no US
 * trading session is open, timer ticks refresh at most every `CLOSED_MARKET_POLL_MS`
 * (returning to the tab still refreshes immediately).
 */
export function useVisiblePolling(refresh: () => void, interval = 15_000, enabled = true) {
  useEffect(() => {
    if (!enabled || !interval) return;
    let last = 0;
    const revalidate = () => {
      if (document.hidden) return;
      last = Date.now();
      refresh();
    };
    const tick = () => {
      if (usMarketsClosed() && Date.now() - last < CLOSED_MARKET_POLL_MS) return;
      revalidate();
    };
    const timer = window.setInterval(tick, interval);
    document.addEventListener("visibilitychange", revalidate);
    window.addEventListener("focus", revalidate);
    window.addEventListener("online", revalidate);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", revalidate);
      window.removeEventListener("focus", revalidate);
      window.removeEventListener("online", revalidate);
    };
  }, [refresh, interval, enabled]);
}
