// The Web's new-chat page (/dashboard/chat, ChatWelcome variant="dock"): a round history
// button, three suggested questions as quiet rows, and the composer docked above the dock.
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  BackHandler,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import ChatGlassButton from "../../components/native/ChatGlassButton";
import { SymbolView } from "expo-symbols";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChatComposer } from "../../components/ChatComposer";
import { ChatHistoryDrawer } from "../../components/ChatHistoryDrawer";
import { AuthGate } from "../../components/Content";
import { CardsSkeleton } from "../../components/Skeletons";
import { Backdrop, Copy, Failure, phone } from "../../components/UI";
import { DEFAULT_CHAT_SKILLS, type ChatSkill } from "../../lib/chatSkills";
import { createConversation } from "../../lib/contentApi";
import { useText } from "../../lib/i18n";
import { isSymbol } from "../../lib/models";
import { useTheme } from "../../lib/theme";
import { TabBarVisibility } from "../../state/TabBarVisibility";
import { useAuth } from "../../state/Auth";

const SUGGESTIONS = [
  "NVDA 上博主最近怎么说？",
  "哪些观点和我的持仓有关？",
  "最近谁转强、谁转弱？",
];
/** Height of the custom Dock on Android and web. */
const DOCK = 54;
/**
 * The sliding chat's corner while the drawer is open. On iPhone it follows the display's
 * own corner, as ChatGPT's does, so the page reads as the screen sliding aside.
 */
const PANEL_RADIUS = Platform.OS === "ios" ? 55 : 28;

export default function NewChat() {
  const { fresh } = useLocalSearchParams<{ fresh?: string }>();
  return (
    <AuthGate
      title="对话"
      skeleton={
        <CardsSkeleton lines={[{ size: 16 }, { size: 12, width: "40%" }]} />
      }
    >
      <Welcome key={fresh ?? "chat"} />
    </AuthGate>
  );
}

function Welcome() {
  const t = useTheme();
  const text = useText();
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
  const [historyMounted, setHistoryMounted] = useState(history);
  const setTabBarHidden = useContext(TabBarVisibility);
  const { width } = useWindowDimensions();
  const drawerWidth = Math.min(width * 0.8, 360);
  const [progress] = useState(
    () => new Animated.Value(openHistory === "1" ? 1 : 0),
  );
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      setTabBarHidden(history);
      if (!history) return;
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          setHistory(false);
          return true;
        },
      );
      return () => {
        subscription.remove();
        setTabBarHidden(false);
      };
    }, [history, setTabBarHidden]),
  );

  useEffect(() => {
    const toValue = history ? 1 : 0;
    const useNativeDriver = Platform.OS !== "web";
    const animation = reduceMotion
      ? Animated.timing(progress, { toValue, duration: 0, useNativeDriver })
      : Animated.spring(progress, {
          toValue,
          stiffness: 145,
          damping: 20,
          mass: 1,
          useNativeDriver,
        });
    animation.start(({ finished }) => {
      if (finished && !history) setHistoryMounted(false);
    });
    return () => animation.stop();
  }, [history, progress, reduceMotion]);

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
    if (!model) {
      setQuery(content);
      setError("请先选择模型。");
      return;
    }
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
          model,
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

  // The iOS tab screen's safe area already includes the native tab bar.
  const dockTop =
    Platform.OS === "ios" ? insets.bottom : Math.max(16, insets.bottom) + DOCK;
  const bottom = Math.max(keyboard, dockTop) + 14;
  const newConversation = () => {
    Keyboard.dismiss();
    setQuery("");
    setModel("");
    setError(undefined);
    setHistory(false);
  };
  return (
    <View
      style={{ flex: 1, overflow: "hidden", backgroundColor: t.background }}
    >
      {/* Mounted only while open or animating, so none of its native glass can show
          through the chat once the drawer has closed. */}
      {historyMounted && (
        <ChatHistoryDrawer
          width={drawerWidth}
          visible={history}
          progress={progress}
          user={user}
          onClose={() => setHistory(false)}
          onNew={newConversation}
        />
      )}
      <Animated.View
        style={{
          flex: 1,
          overflow: "hidden",
          borderRadius: historyMounted ? PANEL_RADIUS : 0,
          borderCurve: "continuous",
          backgroundColor: t.background,
          transform: [
            {
              translateX: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, drawerWidth],
              }),
            },
          ],
        }}
      >
        <View
          style={{ flex: 1 }}
          pointerEvents={history ? "none" : "auto"}
          accessibilityElementsHidden={history}
          importantForAccessibility={history ? "no-hide-descendants" : "auto"}
        >
          <Backdrop />
          <View
            style={{
              paddingTop: insets.top + 2,
              paddingHorizontal: 16,
              minHeight: insets.top + 2 + 48,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <ChatGlassButton
              icon="history"
              label={text("历史对话")}
              onPress={() => {
                Keyboard.dismiss();
                setHistoryMounted(true);
                setHistory(true);
              }}
            />
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingHorizontal: phone(16),
              paddingTop: phone(24),
              paddingBottom: bottom + 140,
            }}
          >
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
                  <Copy size={17}>{suggestion}</Copy>
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
              value={query}
              onChange={setQuery}
              onSend={() => void start(query)}
              busy={busy}
              skills={skills}
              onSkills={setSkills}
              model={model}
              onModel={(next) => {
                setModel(next);
                setError((previous) =>
                  previous === "请先选择模型。" ? undefined : previous,
                );
              }}
              user={user}
            />
          </View>
        </View>
        {historyMounted && (
          <Animated.View
            pointerEvents={history ? "auto" : "none"}
            style={[StyleSheet.absoluteFill, { opacity: progress }]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={text("关闭")}
              onPress={() => setHistory(false)}
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: t.washStrong },
              ]}
            />
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}
