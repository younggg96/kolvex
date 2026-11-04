"use client";
import { useEffect } from "react";

/** Quote readers revalidate on return; hidden tabs do not keep polling. */
export function useVisiblePolling(refresh: () => void, interval = 15_000, enabled = true) {
  useEffect(() => {
    if (!enabled || !interval) return;
    const revalidate = () => { if (!document.hidden) refresh(); };
    const timer = window.setInterval(revalidate, interval);
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
