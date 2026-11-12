import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

/** A small preference that survives restarts, as the Web keeps it in localStorage. */
export function useStoredState<T>(
  key: string,
  initial: T,
  valid: (v: unknown) => v is T,
) {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    void AsyncStorage.getItem(key)
      .then((raw) => {
        if (raw === null) return;
        const parsed = JSON.parse(raw);
        if (valid(parsed)) setValue(parsed);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const set = useCallback(
    (next: T) => {
      setValue(next);
      void AsyncStorage.setItem(key, JSON.stringify(next)).catch(() => {});
    },
    [key],
  );
  return [value, set] as const;
}
