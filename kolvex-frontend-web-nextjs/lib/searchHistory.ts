export interface SearchHistoryItem {
  title: string;
  detail: string;
  href: string;
}

const HISTORY_LIMIT = 6;
const historyKey = (userId: string) => `kolvex:search-history:${userId}`;

function isHistoryItem(value: unknown): value is SearchHistoryItem {
  if (!value || typeof value !== "object") return false;
  const { title, detail, href } = value as Record<string, unknown>;
  return typeof title === "string" && typeof detail === "string" && typeof href === "string" && href.startsWith("/dashboard/");
}

export function readSearchHistory(userId: string): SearchHistoryItem[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(historyKey(userId)) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isHistoryItem).slice(0, HISTORY_LIMIT) : [];
  } catch {
    return [];
  }
}

/** History is a convenience: when storage is blocked it still lasts for the current visit. */
export function writeSearchHistory(userId: string, items: SearchHistoryItem[]) {
  try {
    if (items.length) window.localStorage.setItem(historyKey(userId), JSON.stringify(items));
    else window.localStorage.removeItem(historyKey(userId));
  } catch {
    // Nothing to recover: the in-memory list stays correct.
  }
}

/** Newest first, without repeating a destination. */
export function addToSearchHistory(items: SearchHistoryItem[], item: SearchHistoryItem) {
  return [item, ...items.filter((existing) => existing.href !== item.href)].slice(0, HISTORY_LIMIT);
}
