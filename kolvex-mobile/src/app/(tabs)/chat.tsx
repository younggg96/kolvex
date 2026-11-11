// The Web's new-chat page (/dashboard/chat, ChatWelcome variant="dock"): a round history
// button, three suggested questions as quiet rows, and the composer docked above the dock.
import { useEffect, useRef, useState } from "react";
import { Keyboard, Pressable, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { GlassView } from "expo-glass-effect";
import { SymbolView } from "expo-symbols";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChatActions } from "../../components/ChatActions";
import { ChatComposer } from "../../components/ChatComposer";
import { ConfirmAction } from "../../components/ConfirmAction";
import { AuthGate, Pager, ResourceState } from "../../components/Content";
import { MutationStatus } from "../../components/MutationStatus";
import { Sheet } from "../../components/PaperTrading";
import { CardsSkeleton } from "../../components/Skeletons";
import {
  Backdrop,
  Copy,
  Failure,
  phone,
  useLiquidGlass,
} from "../../components/UI";
import {
  conversations,
  createConversation,
  deleteAllConversations,
} from "../../lib/contentApi";
import { useText } from "../../lib/i18n";
import { isSymbol } from "../../lib/models";
import { useTheme } from "../../lib/theme";
import { useMutation } from "../../lib/useMutation";
import { useResource } from "../../lib/useResource";
import { useAuth } from "../../state/Auth";
import { usePreferences } from "../../state/Preferences";

const SUGGESTIONS = [
  "NVDA 上博主最近怎么说？",
  "哪些观点和我的持仓有关？",
  "最近谁转强、谁转弱？",
];
/** The dock's own height above the home indicator (46pt row + 4pt padding each side). */
const DOCK = 54;

export default function NewChat() {
  return (
    <AuthGate
      title="对话"
      skeleton={
        <CardsSkeleton lines={[{ size: 16 }, { size: 12, width: "40%" }]} />
      }
    >
      <Welcome />
    </AuthGate>
  );
}

function Welcome() {
  const t = useTheme();
  const text = useText();
  const glass = useLiquidGlass();
  const insets = useSafeAreaInsets();
  const user = useAuth().session!.user.id;
  const { ticker } = useLocalSearchParams<{ ticker?: string }>();
  const symbol =
    typeof ticker === "string" && isSymbol(ticker) ? ticker : undefined;
  const [query, setQuery] = useState("");
  const [sources, setSources] = useState(["web"]);
  const [model, setModel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [history, setHistory] = useState(false);
  const [keyboard, setKeyboard] = useState(0);
  const action = useRef<AbortController | null>(null);
  useEffect(() => () => action.current?.abort(), []);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardWillShow", (event) =>
      setKeyboard(event.endCoordinates.height),
    );
    const hide = Keyboard.addListener("keyboardWillHide", () => setKeyboard(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  /** Creates the conversation and opens it; the conversation page sends the question. */
  async function start(question: string) {
    const content = question.trim();
    if (!content || action.current) return;
    const controller = new AbortController();
    action.current = controller;
    setBusy(true);
    setError(undefined);
    try {
      const item = await createConversation(user, controller.signal);
      if (controller.signal.aborted) return;
      setQuery("");
      router.push({
        pathname: "/chat/[id]",
        params: {
          id: item.id,
          q: content,
          sources: sources.join(","),
          ...(model ? { model } : {}),
          ...(symbol ? { ticker: symbol } : {}),
        },
      });
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : "创建未确认，请重试。");
    } finally {
      action.current = null;
      setBusy(false);
    }
  }

  const bottom = keyboard
    ? keyboard + 8
    : Math.max(16, insets.bottom) + DOCK + 12;
  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <Backdrop />
      <View
        style={{
          paddingTop: insets.top + 6,
          paddingHorizontal: phone(16),
          height: insets.top + 6 + 56,
          justifyContent: "center",
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={text("历史对话")}
          onPress={() => setHistory(true)}
        >
          <GlassView

            glassEffectStyle={glass ? "regular" : "none"}
            colorScheme={t.dark ? "dark" : "light"}
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: glass ? undefined : t.wash,
            }}
          >
            <SymbolView
              name={{
                ios: "clock.arrow.circlepath",
                android: "history",
                web: "history",
              }}
              size={20}
              tintColor={t.text}
            />
          </GlassView>
        </Pressable>
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: phone(16),
          paddingTop: phone(24),
          paddingBottom: bottom + 140,
        }}
      >
        {symbol && (
          <Copy
            size={13}
            muted
          >{`新对话可附加 ${symbol} 的真实报价作为本轮资料。`}</Copy>
        )}
        {SUGGESTIONS.map((suggestion) => (
          <Pressable
            key={suggestion}
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void start(text(suggestion))}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: phone(12),
              minHeight: 44,
              paddingHorizontal: phone(12),
              paddingVertical: phone(10),
              borderRadius: phone(12),
              backgroundColor: pressed ? t.wash : "transparent",
              opacity: busy ? 0.5 : 1,
            })}
          >
            <SymbolView
              name={{
                ios: "message",
                android: "chat_bubble",
                web: "chat_bubble",
              }}
              size={15}
              tintColor={t.secondary}
            />
            <View style={{ flex: 1 }}>
              <Copy size={14}>{suggestion}</Copy>
            </View>
            <SymbolView
              name={{
                ios: "arrow.up.right",
                android: "north_east",
                web: "north_east",
              }}
              size={14}
              tintColor={t.secondary}
            />
          </Pressable>
        ))}
        {!!error && <Failure message={error} />}
      </ScrollView>
      <View
        style={{
          position: "absolute",
          left: phone(16),
          right: phone(16),
          bottom,
        }}
      >
        <ChatComposer
          tall
          value={query}
          onChange={setQuery}
          onSend={() => void start(query)}
          busy={busy}
          sources={sources}
          onSources={setSources}
          model={model}
          onModel={setModel}
          user={user}
        />
      </View>
      <Sheet
        title="历史对话"
        visible={history}
        onClose={() => setHistory(false)}
      >
        {history && <History user={user} onOpen={() => setHistory(false)} />}
      </Sheet>
    </View>
  );
}

function History({ user, onOpen }: { user: string; onOpen: () => void }) {
  const t = useTheme();
  const { locale } = usePreferences();
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<string | null>(null);
  const resource = useResource(`${user}:${page}`, (signal) =>
    conversations(user, signal, page),
  );
  const rows = resource.data?.conversations ?? [];
  const clearAll = useMutation();
  return (
    <View style={{ gap: 12 }}>
      <ResourceState
        skeleton={
          <CardsSkeleton lines={[{ size: 16 }, { size: 12, width: "40%" }]} />
        }
        resource={resource}
        empty={!rows.length}
        message="还没有对话。"
      />
      {rows.map((item, index) => (
        <View
          key={item.id}
          style={{
            gap: 8,
            paddingVertical: 8,
            borderTopWidth: index ? 1 : 0,
            borderColor: t.border,
          }}
        >
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              onOpen();
              // Navigate once the sheet has finished closing; a push during its
              // dismissal is dropped by the modal.
              setTimeout(
                () => router.push(`/chat/${encodeURIComponent(item.id)}`),
                350,
              );
            }}
            onLongPress={() => setEditing(editing === item.id ? null : item.id)}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              minHeight: 44,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Copy size={14} lines={1} localize={false}>
                {item.title}
              </Copy>
              <Copy size={12} muted localize={false}>
                {new Date(item.updated_at).toLocaleString(
                  locale === "en" ? "en-US" : "zh-CN",
                )}
              </Copy>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={item.title}
              hitSlop={10}
              onPress={() => setEditing(editing === item.id ? null : item.id)}
            >
              <SymbolView
                name={{
                  ios: "ellipsis",
                  android: "more_horiz",
                  web: "more_horiz",
                }}
                size={16}
                tintColor={t.secondary}
              />
            </Pressable>
          </Pressable>
          {editing === item.id && (
            <ChatActions
              id={item.id}
              user={user}
              title={item.title}
              onChanged={() => {
                setEditing(null);
                resource.refresh();
              }}
            />
          )}
        </View>
      ))}
      <Pager
        page={page}
        hasMore={page * 20 < (resource.data?.total ?? 0)}
        loading={resource.loading}
        onChange={setPage}
      />
      {!!rows.length && (
        <ConfirmAction
          label="删除全部对话"
          description="此账户的所有对话和消息都会被永久删除，无法恢复。"
          disabled={clearAll.busy}
          onConfirm={() =>
            void clearAll.run(async (signal) => {
              await deleteAllConversations(user, signal);
              setPage(1);
              resource.refresh();
            })
          }
        />
      )}
      <MutationStatus {...clearAll} />
    </View>
  );
}
