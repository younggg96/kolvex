import { useFocusEffect } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useRef, useState } from "react";
import {
  AppState,
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  View,
  type ListRenderItemInfo,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Backdrop,
  Button,
  Copy,
  Glass,
  LoadingStatus,
  Skeleton,
  phone,
} from "../../components/UI";
import { news } from "../../lib/contentApi";
import type { NewsFeed, NewsItem } from "../../lib/contentTypes";
import { useText } from "../../lib/i18n";
import { safeExternal } from "../../lib/links";
import { useTheme } from "../../lib/theme";
import { useNewsTranslations } from "../../lib/useNewsTranslations";
import { usePreferences } from "../../state/Preferences";

const PAGE_SIZE = 40;
const FEED_LIMIT = 300;
const POLL_MS = 60_000;
const HEADLINE_TIME = phone(44);
const byline = { flexDirection: "row", gap: phone(12) } as const;
const itemKey = (item: NewsItem) => item.id ?? item.uuid ?? item.link;

type NewsState = {
  items: NewsItem[];
  pending: NewsItem[];
  meta?: Pick<NewsFeed, "fetched_at" | "stale">;
};

function mergeNews(...lists: NewsItem[][]) {
  const merged = new Map<string, NewsItem>();
  for (const row of lists.flat()) merged.set(itemKey(row), row);
  return [...merged.values()]
    .sort(
      (a, b) =>
        (b.publish_time ?? 0) - (a.publish_time ?? 0) ||
        itemKey(a).localeCompare(itemKey(b)),
    )
    .slice(0, FEED_LIMIT);
}

function receive(state: NewsState, next: NewsFeed): NewsState {
  const meta = { fetched_at: next.fetched_at, stale: next.stale };
  if (!state.meta)
    return { items: mergeNews(next.articles), pending: [], meta };
  const visible = new Set(state.items.map(itemKey));
  const updates = new Map(next.articles.map((item) => [itemKey(item), item]));
  return {
    meta,
    items: state.items.map((item) => updates.get(itemKey(item)) ?? item),
    pending: mergeNews(
      state.pending,
      next.articles.filter((item) => !visible.has(itemKey(item))),
    ),
  };
}

function useNewsFeed() {
  const [state, setState] = useState<NewsState>({ items: [], pending: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const operation = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    if (operation.current) return;
    const controller = new AbortController();
    operation.current = controller;
    setLoading(true);
    try {
      const next = await news(controller.signal);
      if (controller.signal.aborted) return;
      setState((state) => receive(state, next));
      setError(false);
    } catch {
      if (!controller.signal.aborted) setError(true);
    } finally {
      if (operation.current === controller) {
        operation.current = null;
        if (!controller.signal.aborted) setLoading(false);
      }
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      const poll = () => {
        if (!pausedRef.current && AppState.currentState === "active")
          void refresh();
      };
      const initial = setTimeout(() => {
        if (pausedRef.current) setLoading(false);
        else poll();
      }, 0);
      const timer = setInterval(poll, POLL_MS);
      const subscription = AppState.addEventListener("change", (next) => {
        if (next === "active") poll();
      });
      return () => {
        clearTimeout(initial);
        clearInterval(timer);
        subscription.remove();
        operation.current?.abort();
        operation.current = null;
      };
    }, [refresh]),
  );
  return {
    ...state,
    loading,
    error,
    paused,
    refresh,
    togglePause: () => {
      const next = !pausedRef.current;
      pausedRef.current = next;
      setPaused(next);
      if (!next) void refresh();
    },
    reveal: () =>
      setState((state) => ({
        ...state,
        items: mergeNews(state.items, state.pending),
        pending: [],
      })),
  };
}

export default function News() {
  const { locale } = usePreferences();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const text = useText();
  const region = locale === "zh" ? "zh-CN" : "en-US";
  const clock = new Intl.DateTimeFormat(region, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const day = new Intl.DateTimeFormat(region, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [linkError, setLinkError] = useState(false);
  const feed = useNewsFeed();
  const list = useRef<FlatList<NewsItem>>(null);
  const visible = feed.items.slice(0, limit);
  const translations = useNewsTranslations(
    visible.filter((item) => !item.title_zh).map((item) => item.title),
    locale,
  );
  const refreshError = feed.error || !!feed.meta?.stale;
  const currentTime = feed.meta?.fetched_at
    ? new Date(feed.meta.fetched_at)
    : null;
  const updated =
    currentTime && Number.isFinite(currentTime.getTime())
      ? clock.format(currentTime)
      : "—";
  const controlSize = phone(36);

  function render({ item, index }: ListRenderItemInfo<NewsItem>) {
    const time = item.publish_time ? new Date(item.publish_time * 1000) : null;
    const date = time ? day.format(time) : text("日期未知");
    const previous = visible[index - 1]?.publish_time;
    const previousDate = previous
      ? day.format(new Date(previous * 1000))
      : text("日期未知");
    const title =
      locale === "zh"
        ? item.title_zh || translations.title(item.title) || item.title
        : item.title;
    const url = safeExternal(item.link);
    return (
      <View style={[styles.row, { borderColor: t.border }]}>
        {(index === 0 || date !== previousDate) && (
          <Copy size={12} muted localize={false}>
            {date}
          </Copy>
        )}
        <View style={byline}>
          <View style={{ width: HEADLINE_TIME, paddingTop: phone(2) }}>
            <Copy size={12} muted localize={false}>
              {time ? clock.format(time) : "—"}
            </Copy>
          </View>
          <Pressable
            accessibilityRole={url ? "link" : undefined}
            accessibilityLabel={
              url ? `${title} ${text("（原文，新标签页）")}` : title
            }
            disabled={!url}
            onPress={() => {
              if (url)
                void Linking.openURL(url)
                  .then(() => setLinkError(false))
                  .catch(() => setLinkError(true));
            }}
            style={({ pressed }) => ({
              flex: 1,
              minWidth: 0,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Copy size={14} lineHeight={23} localize={false}>
              {title}
            </Copy>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View
      style={{ flex: 1, backgroundColor: t.background, paddingTop: insets.top }}
    >
      <Backdrop />
      <Glass clear style={{ flex: 1, padding: 12 }}>
        <View style={[styles.toolbar, { borderColor: t.border }]}>
          <View style={[styles.toolbarText, byline]}>
            {feed.loading && !feed.meta ? (
              <Skeleton height={phone(12)} width={phone(100)} />
            ) : (
              <Copy size={12} muted>{`${feed.items.length} 条快讯`}</Copy>
            )}
            <Copy size={12} muted>
              更新于 {updated}
            </Copy>
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: phone(8),
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={text(feed.paused ? "继续" : "暂停")}
              accessibilityState={{ selected: feed.paused }}
              hitSlop={6}
              onPress={feed.togglePause}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <Glass
                style={[
                  styles.center,
                  {
                    width: controlSize,
                    height: controlSize,
                    borderRadius: 999,
                  },
                ]}
              >
                <SymbolView
                  name={
                    feed.paused
                      ? {
                          ios: "play.fill",
                          android: "play_arrow",
                          web: "play_arrow",
                        }
                      : { ios: "pause.fill", android: "pause", web: "pause" }
                  }
                  size={phone(14)}
                  tintColor={t.text}
                />
              </Glass>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={text("刷新新闻")}
              accessibilityState={{ disabled: feed.loading }}
              disabled={feed.loading}
              hitSlop={6}
              onPress={() => void feed.refresh()}
              style={({ pressed }) => [
                styles.center,
                {
                  width: controlSize,
                  height: controlSize,
                  opacity: feed.loading ? 0.4 : pressed ? 0.6 : 1,
                },
              ]}
            >
              <SymbolView
                name={{
                  ios: "arrow.clockwise",
                  android: "refresh",
                  web: "refresh",
                }}
                size={phone(16)}
                tintColor={t.secondary}
              />
            </Pressable>
          </View>
        </View>
        {refreshError && (
          <View
            style={[styles.status, { borderColor: t.border }]}
            accessibilityLiveRegion="polite"
          >
            <Copy size={14}>更新失败，正在显示最近可用的快讯。</Copy>
          </View>
        )}
        {translations.failed > 0 && translations.pending === 0 && (
          <View
            style={[styles.status, { borderColor: t.border }]}
            accessibilityLiveRegion="polite"
          >
            <View style={{ flex: 1 }}>
              <Copy size={12} muted>
                部分快讯暂未翻译，已保留原文。
              </Copy>
            </View>
            <Copy role="link" onPress={translations.retry} size={12} muted>
              重试
            </Copy>
          </View>
        )}
        {linkError && (
          <View style={[styles.status, { borderColor: t.border }]}>
            <Copy size={12} muted>
              无法打开来源链接，请稍后重试。
            </Copy>
          </View>
        )}
        {feed.pending.length > 0 && (
          <View style={[styles.status, { borderColor: t.border }]}>
            <Button
              block
              onPress={() => {
                feed.reveal();
                setLimit(PAGE_SIZE);
                list.current?.scrollToOffset({ offset: 0 });
              }}
              icon={
                <SymbolView
                  name={{
                    ios: "arrow.up",
                    android: "arrow_upward",
                    web: "arrow_upward",
                  }}
                  size={phone(16)}
                  tintColor={t.text}
                />
              }
            >
              {`查看 ${feed.pending.length} 条新消息`}
            </Button>
          </View>
        )}
        <FlatList
          ref={list}
          data={visible}
          keyExtractor={itemKey}
          renderItem={render}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 90 }}
          ListEmptyComponent={
            feed.loading && !feed.meta ? (
              <LoadingStatus>
                {Array.from({ length: 8 }, (_, index) => (
                  <View
                    key={index}
                    style={[styles.row, { borderColor: t.border }]}
                  >
                    <View style={byline}>
                      <Skeleton height={phone(14)} width={HEADLINE_TIME} />
                      <View style={{ flex: 1, gap: phone(8) }}>
                        <Skeleton height={phone(16)} />
                        {index % 3 !== 2 && (
                          <Skeleton height={phone(16)} width="65%" />
                        )}
                      </View>
                    </View>
                  </View>
                ))}
              </LoadingStatus>
            ) : (
              <View style={styles.empty}>
                <SymbolView
                  name={{
                    ios: "newspaper",
                    android: "newspaper",
                    web: "newspaper",
                  }}
                  size={phone(24)}
                  tintColor={t.secondary}
                />
                <Copy size={14} bold>
                  {feed.error ? "新闻暂不可用" : "暂无快讯"}
                </Copy>
                <Button onPress={() => void feed.refresh()}>重试</Button>
              </View>
            )
          }
          ListFooterComponent={
            visible.length < feed.items.length ? (
              <View style={[styles.center, { paddingVertical: phone(16) }]}>
                <Button onPress={() => setLimit((limit) => limit + PAGE_SIZE)}>
                  显示更多快讯
                </Button>
              </View>
            ) : undefined
          }
        />
      </Glass>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: "center", alignItems: "center" },
  toolbar: {
    minHeight: phone(52),
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: phone(8),
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  toolbarText: {
    flex: 1,
    flexWrap: "wrap",
    alignItems: "center",
    rowGap: phone(4),
  },
  status: {
    paddingHorizontal: 16,
    paddingVertical: phone(8),
    flexDirection: "row",
    alignItems: "center",
    gap: phone(8),
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: phone(10),
    gap: phone(8),
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  empty: { alignItems: "center", paddingVertical: phone(64), gap: phone(12) },
});
