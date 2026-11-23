import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { AppState } from "react-native";
import { CLOSED_MARKET_POLL_MS, usMarketsClosed } from "./pollingSchedule";

/** Revalidate only while the quote's screen is focused and the app is foregrounded. */
export function useMarketPolling(
  refresh: () => void,
  interval: number,
  enabled = true,
) {
  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      let last = Date.now();
      const revalidate = () => {
        last = Date.now();
        refresh();
      };
      const timer = setInterval(() => {
        if (AppState.currentState !== "active") return;
        if (usMarketsClosed() && Date.now() - last < CLOSED_MARKET_POLL_MS)
          return;
        revalidate();
      }, interval);
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active") revalidate();
      });
      return () => {
        clearInterval(timer);
        subscription.remove();
      };
    }, [refresh, interval, enabled]),
  );
}
