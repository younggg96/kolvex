"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * True while the viewport is at least `px` wide. The server and the first client render assume a
 * wide screen, so desktop layouts never shift on load; phones switch right after hydration.
 */
export function useMinWidth(px: number): boolean {
  const query = `(min-width: ${px}px)`;
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => true,
  );
}
