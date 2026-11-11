// The Web's ChatHistorySheet: a left drawer of past conversations grouped by day,
// each row with a relative time and a delete control that takes a second tap.
import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { GlassView } from "expo-glass-effect";
import { SymbolView } from "expo-symbols";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { conversations, deleteConversation } from "../lib/contentApi";
import type { Conversation } from "../lib/contentTypes";
import { useTheme } from "../lib/theme";
import { useResource } from "../lib/useResource";
import { usePreferences } from "../state/Preferences";
import { Pager } from "./Content";
import { Copy, Failure, Skeleton, phone, useLiquidGlass } from "./UI";

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
      time >= today.getTime() ? 0 : time >= yesterday ? 1 : time >= week ? 2 : 3;
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
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string>();
  // Deleting is permanent, so the trash takes a second tap within three seconds.
  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(timer);
  }, [confirming]);
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
        <View style={{ paddingTop: 2 }}>
          <SymbolView
            name={{
              ios: "bubble.left.and.bubble.right",
              android: "forum",
              web: "forum",
            }}
            size={13}
            tintColor={active ? t.text : t.secondary}
          />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Copy
            size={13}
            bold
            lines={1}
            color={active ? t.text : t.secondary}
            localize={false}
          >
            {item.title}
          </Copy>
          <Copy size={11} muted lines={1}>
            {relativeTime(item.updated_at, locale)}
          </Copy>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={confirming ? "再点一次删除" : "删除对话"}
        disabled={deleting}
        onPress={() => {
          if (!confirming) return setConfirming(true);
          setDeleting(true);
          setError(undefined);
          const controller = new AbortController();
          deleteConversation(item.id, user, controller.signal)
            .then(onDeleted)
            .catch(() => setError("删除未完成，请重试。"))
            .finally(() => {
              setDeleting(false);
              setConfirming(false);
            });
        }}
        style={{
          position: "absolute",
          right: 4,
          top: 4,
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: confirming ? "rgba(239,68,68,0.15)" : "transparent",
          opacity: deleting ? 0.4 : 1,
        }}
      >
        <SymbolView
          name={{ ios: "trash", android: "delete", web: "delete" }}
          size={13}
          tintColor={confirming ? t.negative : t.secondary}
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

function List({
  user,
  current,
  onOpen,
}: {
  user: string;
  current?: string;
  onOpen: (id: string) => void;
}) {
  const [page, setPage] = useState(1);
  const resource = useResource(`history:${user}:${page}`, (signal) =>
    conversations(user, signal, page),
  );
  const rows = resource.data?.conversations ?? [];
  if (resource.loading && !resource.data)
    return (
      <View style={{ gap: 14, padding: 8 }}>
        <Skeleton width={48} height={12} />
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ gap: 6 }}>
            <Skeleton width={i % 2 ? "60%" : "80%"} height={13} />
            <Skeleton width={48} height={10} />
          </View>
        ))}
      </View>
    );
  if (resource.error && !resource.data)
    return <Failure message="暂时无法加载历史对话。" retry={resource.refresh} />;
  if (!rows.length)
    return (
      <View style={{ paddingHorizontal: 8, paddingVertical: 8 }}>
        <Copy size={13} muted>
          还没有对话
        </Copy>
      </View>
    );
  return (
    <View style={{ gap: 4 }}>
      {group(rows).map(([title, items]) => (
        <View key={title}>
          <View style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
            <Copy size={12} bold muted>
              {title}
            </Copy>
          </View>
          {items.map((item) => (
            <Row
              key={item.id}
              item={item}
              user={user}
              active={item.id === current}
              onOpen={() => onOpen(item.id)}
              onDeleted={resource.refresh}
            />
          ))}
        </View>
      ))}
      <Pager
        page={page}
        hasMore={page * 20 < (resource.data?.total ?? 0)}
        loading={resource.loading}
        onChange={setPage}
      />
    </View>
  );
}

export function ChatHistoryDrawer({
  visible,
  onClose,
  user,
  current,
}: {
  visible: boolean;
  onClose: () => void;
  user: string;
  current?: string;
}) {
  const t = useTheme();
  const glass = useLiquidGlass();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, flexDirection: "row" }}>
        <GlassView
          glassEffectStyle={glass ? "regular" : "none"}
          colorScheme={t.dark ? "dark" : "light"}
          style={{
            width: "85%",
            maxWidth: 384,
            borderTopRightRadius: 28,
            borderBottomRightRadius: 28,
            overflow: "hidden",
            backgroundColor: glass ? undefined : t.card,
            paddingTop: Math.max(20, insets.top),
            paddingBottom: insets.bottom,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingLeft: 20,
              paddingRight: 12,
              paddingBottom: 8,
            }}
          >
            <Copy size={16} bold>
              历史对话
            </Copy>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="关闭"
              onPress={onClose}
              hitSlop={6}
              style={({ pressed }) => ({
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: t.brand,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <SymbolView
                name={{ ios: "xmark", android: "close", web: "close" }}
                size={13}
                weight="bold"
                tintColor={t.onBrand}
              />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={{
              paddingLeft: 12,
              paddingRight: 8,
              paddingBottom: 16,
            }}
          >
            {visible && (
              <List
                user={user}
                current={current}
                onOpen={(id) => {
                  onClose();
                  // Navigate once the modal has closed; a push during its dismissal is dropped.
                  setTimeout(
                    () => router.push(`/chat/${encodeURIComponent(id)}`),
                    300,
                  );
                }}
              />
            )}
          </ScrollView>
        </GlassView>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="关闭"
          onPress={onClose}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)" }}
        />
      </View>
    </Modal>
  );
}
