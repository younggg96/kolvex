// Chat history grouped by day, with a confirmed delete action.
import { useRef, useState } from "react";
import {
  Alert,
  Animated,
  Pressable,
  Platform,
  SectionList,
  View,
} from "react-native";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { conversations, deleteConversation } from "../lib/contentApi";
import type { Conversation } from "../lib/contentTypes";
import { useText } from "../lib/i18n";
import { useTheme } from "../lib/theme";
import { peekResource, useResource } from "../lib/useResource";
import { usePreferences } from "../state/Preferences";
import ChatGlassButton from "./native/ChatGlassButton";
import { Copy, Failure, LoadingStatus, phone, Skeleton } from "./UI";

function relativeTime(value: string, locale: string) {
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 7) return `${days} 天前`;
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "zh-CN", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function group(rows: Conversation[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = today.getTime() - 86400000;
  const week = today.getTime() - 7 * 86400000;
  const groups: [string, Conversation[]][] = [
    ["今天", []],
    ["昨天", []],
    ["本周", []],
    ["更早", []],
  ];
  for (const row of rows) {
    const time = new Date(row.updated_at).getTime();
    const index =
      time >= today.getTime()
        ? 0
        : time >= yesterday
          ? 1
          : time >= week
            ? 2
            : 3;
    groups[index][1].push(row);
  }
  return groups.filter(([, items]) => items.length);
}

function Row({
  item,
  active,
  user,
  onOpen,
  onDeleted,
}: {
  item: Conversation;
  active: boolean;
  user: string;
  onOpen: () => void;
  onDeleted: () => void;
}) {
  const t = useTheme();
  const { locale } = usePreferences();
  const text = useText();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string>();
  const remove = () => {
    setDeleting(true);
    setError(undefined);
    deleteConversation(item.id, user, new AbortController().signal)
      .then(onDeleted)
      .catch(() => setError("删除未完成，请重试。"))
      .finally(() => setDeleting(false));
  };
  // Deleting is permanent, so the trash asks first.
  const confirm = () => {
    const title = text("删除对话？");
    const message = text("删除后无法恢复。");
    if (Platform.OS === "web") {
      if (globalThis.confirm?.(`${title}\n${message}`)) remove();
      return;
    }
    Alert.alert(title, message, [
      { text: text("取消"), style: "cancel" },
      { text: text("删除"), style: "destructive", onPress: remove },
    ]);
  };
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        onPress={onOpen}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 8,
          padding: 8,
          paddingRight: 44,
          borderRadius: phone(16),
          backgroundColor: active || pressed ? t.wash : "transparent",
        })}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Copy size={17} bold={active} lines={1} localize={false}>
            {item.title}
          </Copy>
          <Copy size={13} muted lines={1}>
            {relativeTime(item.updated_at, locale)}
          </Copy>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={text("删除对话")}
        disabled={deleting}
        onPress={confirm}
        style={{
          position: "absolute",
          right: 4,
          top: 4,
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: "center",
          justifyContent: "center",
          opacity: deleting ? 0.4 : 1,
        }}
      >
        <SymbolView
          name={{ ios: "trash", android: "delete", web: "delete" }}
          size={13}
          tintColor={t.secondary}
        />
      </Pressable>
      {!!error && (
        <View style={{ paddingHorizontal: 8 }}>
          <Copy size={11} color={t.negative}>
            {error}
          </Copy>
        </View>
      )}
    </View>
  );
}

type HistoryPages = { rows: Conversation[]; page: number; total: number };

function HistorySkeleton({
  count,
  sectionHeader = false,
}: {
  count: number;
  sectionHeader?: boolean;
}) {
  const titleWidths = ["72%", "58%", "66%", "48%"] as const;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ paddingHorizontal: 8 }}
    >
      {sectionHeader && (
        <View style={{ height: 28, justifyContent: "center" }}>
          <Skeleton width={44} height={11} radius={5} />
        </View>
      )}
      {Array.from({ length: count }, (_, index) => (
        <View
          key={index}
          style={{
            height: 60,
            flexDirection: "row",
            alignItems: "flex-start",
            paddingVertical: 9,
            gap: 16,
          }}
        >
          <View style={{ flex: 1, gap: 7 }}>
            <Skeleton
              width={titleWidths[index % titleWidths.length]}
              height={13}
              radius={6}
            />
            <Skeleton width={54} height={9} radius={5} />
          </View>
          <Skeleton width={13} height={13} radius={5} />
        </View>
      ))}
    </View>
  );
}

function List({
  user,
  topPadding,
  bottomPadding,
  onOpen,
}: {
  user: string;
  topPadding: number;
  bottomPadding: number;
  onOpen: (id: string) => void;
}) {
  const key = `history:${user}`;
  // Reopening the drawer shows the cached history at once and quietly refreshes every
  // page already loaded, so new and deleted chats still show up.
  const request = useRef<{ page: number; previous?: Conversation[] }>({
    page: peekResource<HistoryPages>(key)?.page ?? 1,
  });
  const resource = useResource<HistoryPages>(
    key,
    async (signal) => {
      const { page, previous } = request.current;
      const pages = previous
        ? [page]
        : Array.from({ length: page }, (_, index) => index + 1);
      const results = await Promise.all(
        pages.map((number) => conversations(user, signal, number)),
      );
      const rows = new Map(previous?.map((row) => [row.id, row]));
      for (const result of results)
        for (const row of result.conversations) rows.set(row.id, row);
      return { rows: [...rows.values()], page, total: results[0].total };
    },
    undefined,
    { cache: true },
  );
  const data = resource.data;
  // The page the reader scrolled on to; refs can't be read during render.
  const [wanted, setWanted] = useState(1);
  // Skeleton rows only for a first load or a next page, never for a background refresh.
  const showLoading = resource.loading && (!data || data.page < wanted);
  return (
    <SectionList
      style={{ flex: 1 }}
      scrollIndicatorInsets={{ top: topPadding }}
      sections={group(data?.rows ?? []).map(([title, rows]) => ({
        title,
        data: rows,
      }))}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={{
        paddingHorizontal: 14,
        paddingTop: topPadding,
        paddingBottom: bottomPadding,
      }}
      keyExtractor={(item) => item.id}
      onEndReachedThreshold={0.45}
      onEndReached={() => {
        if (
          !data ||
          resource.loading ||
          resource.error ||
          data.page * 20 >= data.total
        )
          return;
        if (request.current.page > data.page) return;
        request.current = { page: data.page + 1, previous: data.rows };
        setWanted(data.page + 1);
        resource.refresh();
      }}
      renderSectionHeader={({ section }) => (
        <View style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
          <Copy size={14} bold muted>
            {section.title}
          </Copy>
        </View>
      )}
      renderItem={({ item }) => (
        <Row
          item={item}
          user={user}
          active={false}
          onOpen={() => onOpen(item.id)}
          onDeleted={() => {
            request.current = { page: data?.page ?? 1 };
            resource.refresh();
          }}
        />
      )}
      ListEmptyComponent={
        !showLoading && !resource.error ? (
          <View style={{ padding: 8 }}>
            <Copy size={13} muted>
              还没有对话
            </Copy>
          </View>
        ) : undefined
      }
      ListFooterComponent={
        showLoading ? (
          <LoadingStatus label="正在加载数据">
            <HistorySkeleton
              count={data?.rows.length ? 2 : 6}
              sectionHeader={!data?.rows.length}
            />
          </LoadingStatus>
        ) : resource.error ? (
          <Failure message="暂时无法加载历史对话。" retry={resource.refresh} />
        ) : undefined
      }
    />
  );
}

/** Height of the drawer's title row, below the status bar. */
const HEADER = 52;

/**
 * ChatGPT's drawer: the list runs the full height of the screen and scrolls under a
 * plain title bar, with the new-chat button floating over the bottom of the list.
 */
export function ChatHistoryDrawer({
  width,
  visible,
  progress,
  onClose,
  onNew,
  user,
}: {
  width: number;
  visible: boolean;
  /** 0 closed → 1 open; the drawer fades out as the chat slides back over it. */
  progress: Animated.Value;
  onClose: () => void;
  onNew: () => void;
  user: string;
}) {
  const t = useTheme();
  const text = useText();
  const insets = useSafeAreaInsets();
  const top = insets.top + HEADER;
  return (
    <Animated.View
      accessibilityElementsHidden={!visible}
      onAccessibilityEscape={onClose}
      importantForAccessibility={visible ? "auto" : "no-hide-descendants"}
      pointerEvents={visible ? "auto" : "none"}
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: 0,
        width,
        backgroundColor: t.background,
        opacity: progress.interpolate({
          inputRange: [0, 0.25, 1],
          outputRange: [0, 1, 1],
          extrapolate: "clamp",
        }),
      }}
    >
      <List
        user={user}
        topPadding={top + 4}
        bottomPadding={Math.max(16, insets.bottom) + 72}
        onOpen={(id) => {
          onClose();
          router.push(`/chat/${encodeURIComponent(id)}`);
        }}
      />
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: top,
          paddingTop: insets.top,
          justifyContent: "center",
          paddingHorizontal: 22,
          backgroundColor: t.background,
        }}
      >
        <Copy size={22} bold>
          历史对话
        </Copy>
      </View>
      {/* Gone the moment the drawer starts closing, so it never rides over the chat. */}
      {visible && (
        <View
          style={{
            position: "absolute",
            left: 20,
            bottom: Math.max(16, insets.bottom),
          }}
        >
          <ChatGlassButton
            icon="new"
            label={text("新建对话")}
            showLabel
            onPress={onNew}
          />
        </View>
      )}
    </Animated.View>
  );
}
