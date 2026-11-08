import { useEffect, useState } from "react";
import {
  addToSearchHistory,
  readSearchHistory,
  writeSearchHistory,
  type SearchHistoryItem,
} from "./searchHistory";

export type { SearchHistoryItem };

/** Account-scoped recent searches; the dock and the search screen share one copy. */
export function useSearchHistory(user?: string) {
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  useEffect(() => {
    let active = true;
    if (!user) return;
    void readSearchHistory(user).then((saved) => {
      if (active) setHistory(saved);
    });
    return () => {
      active = false;
    };
  }, [user]);
  function save(next: SearchHistoryItem[]) {
    setHistory(next);
    if (user) writeSearchHistory(user, next);
  }
  return {
    history,
    replace: save,
    remember: (item: SearchHistoryItem) =>
      save(addToSearchHistory(history, item)),
  };
}
