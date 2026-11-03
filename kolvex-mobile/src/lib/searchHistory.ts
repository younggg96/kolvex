import AsyncStorage from "@react-native-async-storage/async-storage";

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
  return (
    typeof title === "string" &&
    typeof detail === "string" &&
    typeof href === "string" &&
    href.startsWith("/")
  );
}

export function parseSearchHistory(raw: string | null): SearchHistoryItem[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter(isHistoryItem).slice(0, HISTORY_LIMIT)
      : [];
  } catch {
    return [];
  }
}

export function addToSearchHistory(
  history: SearchHistoryItem[],
  item: SearchHistoryItem,
) {
  return [
    item,
    ...history.filter((existing) => existing.href !== item.href),
  ].slice(0, HISTORY_LIMIT);
}

export async function readSearchHistory(userId: string) {
  try {
    return parseSearchHistory(await AsyncStorage.getItem(historyKey(userId)));
  } catch {
    return [];
  }
}

export function writeSearchHistory(
  userId: string,
  history: SearchHistoryItem[],
) {
  AsyncStorage.setItem(historyKey(userId), JSON.stringify(history)).catch(
    () => undefined,
  );
}
