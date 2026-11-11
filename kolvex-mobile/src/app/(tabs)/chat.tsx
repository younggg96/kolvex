// The Web's new-chat page (/dashboard/chat, ChatWelcome variant="dock"): a round history
// button, three suggested questions as quiet rows, and the composer docked above the dock.
import { useEffect, useRef, useState } from "react";
import { Keyboard, Pressable, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { GlassView } from "expo-glass-effect";
import { SymbolView } from "expo-symbols";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChatComposer } from "../../components/ChatComposer";
import { ChatHistoryDrawer } from "../../components/ChatHistoryDrawer";
import { AuthGate } from "../../components/Content";
import { CardsSkeleton } from "../../components/Skeletons";
import {
  Backdrop,
  Copy,
  Failure,
  phone,
  useLiquidGlass,
} from "../../components/UI";
import { DEFAULT_CHAT_SKILLS, type ChatSkill } from "../../lib/chatSkills";
import { createConversation } from "../../lib/contentApi";
import { useText } from "../../lib/i18n";
import { isSymbol } from "../../lib/models";
import { useTheme } from "../../lib/theme";
import { useAuth } from "../../state/Auth";

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
  const { ticker, history: openHistory } = useLocalSearchParams<{
    ticker?: string;
    /** kolvex://chat?history=1 opens the history drawer. */
    history?: string;
  }>();
  const symbol =
    typeof ticker === "string" && isSymbol(ticker) ? ticker : undefined;
  const [query, setQuery] = useState("");
  // The Web's welcome sends every source; skills choose what the reply may use.
  const sources = ["plaid", "portfolio", "web"];
  const [skills, setSkills] = useState<ChatSkill[]>(DEFAULT_CHAT_SKILLS);
  const [model, setModel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [history, setHistory] = useState(openHistory === "1");
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
          skills: skills.join(","),
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
          hitSlop={4}
        >
          <GlassView

            glassEffectStyle={glass ? "regular" : "none"}
            colorScheme={t.dark ? "dark" : "light"}
            style={{
              width: phone(44),
              height: phone(44),
              borderRadius: 999,
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
              size={16}
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
          skills={skills}
          onSkills={setSkills}
          model={model}
          onModel={setModel}
          user={user}
        />
      </View>
      <ChatHistoryDrawer
        visible={history}
        onClose={() => setHistory(false)}
        user={user}
      />
    </View>
  );
}
