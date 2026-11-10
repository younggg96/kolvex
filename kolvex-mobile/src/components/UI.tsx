import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentRef,
  type PropsWithChildren,
} from "react";
import {
  AccessibilityInfo,
  Animated,
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { demoMode } from "../lib/api";
import { usePreferences } from "../state/Preferences";
import { translateNodes, useText } from "../lib/i18n";
import { useTheme } from "../lib/theme";
import SwiftGlass from "./native/SwiftGlass";

export function Copy({
  children,
  size = 16,
  muted = false,
  bold = false,
  color,
  selectable = false,
  localize = true,
  lines,
  onPress,
  role,
}: PropsWithChildren<{
  size?: number;
  muted?: boolean;
  bold?: boolean;
  color?: string;
  selectable?: boolean;
  localize?: boolean;
  lines?: number;
  onPress?: () => void;
  role?: "link";
}>) {
  const t = useTheme();
  const { locale } = usePreferences();
  return (
    <Text
      selectable={selectable}
      numberOfLines={lines}
      onPress={onPress}
      accessibilityRole={role}
      style={{
        color: color ?? (muted ? t.secondary : t.text),
        fontSize: size,
        fontWeight: bold ? "600" : "400",
        lineHeight: size * 1.45,
        fontVariant: ["tabular-nums"],
      }}
    >
      {localize && !selectable ? translateNodes(children, locale) : children}
    </Text>
  );
}
// Reading and data sit on an opaque surface. Only toolbars and overlays ask for
// `material`: real SwiftUI glass on iOS 26+, blur on older iOS, opaque elsewhere.
// Reduce Transparency is one system setting; every glass surface reads the same copy.
let reduceTransparency = true;
const reduceListeners = new Set<() => void>();
if (Platform.OS === "ios") {
  void AccessibilityInfo.isReduceTransparencyEnabled()
    .then((value) => {
      reduceTransparency = value;
      reduceListeners.forEach((listener) => listener());
    })
    .catch(() => {});
  AccessibilityInfo.addEventListener("reduceTransparencyChanged", (value) => {
    reduceTransparency = value;
    reduceListeners.forEach((listener) => listener());
  });
}
const subscribeReduce = (listener: () => void) => {
  reduceListeners.add(listener);
  return () => reduceListeners.delete(listener);
};
const liquidGlass = Platform.OS === "ios" && isLiquidGlassAvailable();
/** True where iOS 26 Liquid Glass can render and the reader has not asked for solid surfaces. */
export function useLiquidGlass() {
  const reduce = useSyncExternalStore(
    subscribeReduce,
    () => reduceTransparency,
    () => true,
  );
  return liquidGlass && !reduce;
}

/**
 * The Web's glass card. On iOS 26 it is the system's Liquid Glass (UIGlassEffect);
 * with Reduce Transparency, or before iOS 26, the Web's solid card colours.
 * `material` keeps the clearer SwiftUI glass for floating toolbars such as the Dock.
 */
export function Glass({
  children,
  style,
  material = false,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle>; material?: boolean }>) {
  const t = useTheme();
  const glass = useLiquidGlass();
  // Liquid Glass draws its own lit edge; the Web rim is only for solid surfaces.
  const shell = [
    styles.glass,
    glass ? { borderWidth: 0 } : { borderColor: t.rim },
    style,
  ];
  if (glass && material)
    return <SwiftGlass style={shell}>{children}</SwiftGlass>;
  if (glass)
    return (
      <GlassView
        glassEffectStyle="regular"
        colorScheme={t.dark ? "dark" : "light"}
        style={shell}
      >
        {children}
      </GlassView>
    );
  if (material && Platform.OS === "ios" && !reduceTransparency)
    return (
      <BlurView tint={t.dark ? "dark" : "light"} intensity={60} style={shell}>
        {children}
      </BlurView>
    );
  return (
    <View style={[shell, { backgroundColor: material ? t.surface : t.card }]}>
      {children}
    </View>
  );
}
/**
 * The Web's pill button. `primary` is the one solid green action on a screen and
 * fills its row; everything else is a neutral wash that hugs its label.
 */
export function Button({
  children,
  onPress,
  selected = false,
  disabled = false,
  label,
  variant = "neutral",
  block = variant === "primary",
}: PropsWithChildren<{
  onPress: () => void;
  selected?: boolean;
  disabled?: boolean;
  label?: string;
  variant?: "neutral" | "primary";
  block?: boolean;
}>) {
  const t = useTheme();
  const { locale } = usePreferences();
  const text = useText();
  const glass = useLiquidGlass();
  const primary = variant === "primary";
  const label_ = (
    <Copy size={14} bold color={primary ? t.onBrand : t.text}>
      {translateNodes(children, locale)}
    </Copy>
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ? text(label) : undefined}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={() => {
        if (Platform.OS !== "web")
          void Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [
        { alignSelf: block ? "stretch" : "flex-start" },
        glass
          ? { opacity: disabled ? 0.4 : 1 }
          : [
              styles.button,
              {
                backgroundColor: primary
                  ? t.brand
                  : selected
                    ? t.washStrong
                    : t.wash,
                borderColor: primary ? "transparent" : t.rim,
                opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
              },
            ],
      ]}
    >
      {glass ? (
        // Interactive glass gives the system's own press response.
        <GlassView
          isInteractive={!disabled}
          glassEffectStyle="regular"
          tintColor={primary ? t.brand : selected ? t.washStrong : undefined}
          colorScheme={t.dark ? "dark" : "light"}
          style={[styles.button, { borderWidth: 0 }]}
        >
          {label_}
        </GlassView>
      ) : (
        label_
      )}
    </Pressable>
  );
}
/** Screens without a navigation bar: keeps content from scrolling under the status bar. */
export function StatusScrim() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: insets.top,
        backgroundColor: t.background,
      }}
    />
  );
}
/** A filter choice: a plain control among content, deliberately without glass. */
export function Chip({
  children,
  onPress,
  selected = false,
  disabled = false,
  bare = false,
}: PropsWithChildren<{
  onPress: () => void;
  selected?: boolean;
  disabled?: boolean;
  /** Inside a segmented track, where the track supplies the surface. */
  bare?: boolean;
}>) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={() => {
        if (Platform.OS !== "web")
          void Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        {
          minHeight: 36,
          paddingVertical: 6,
          borderWidth: 0,
          // The Web's glass thumb: a white pill with near-black text.
          backgroundColor: selected
            ? "rgba(255,255,255,0.97)"
            : bare
              ? "transparent"
              : t.wash,
          opacity: disabled ? 0.45 : pressed ? 0.65 : 1,
        },
      ]}
    >
      <Copy size={14} bold color={selected ? "#111111" : t.text}>
        {children}
      </Copy>
    </Pressable>
  );
}
/**
 * The Web's phone backdrop: the green light behind dark-mode screens, dimmed so
 * data text stays readable. Light mode keeps the plain ground, as on the Web.
 */
export function Backdrop() {
  const t = useTheme();
  if (!t.dark) return null;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { backgroundColor: "rgb(2,6,7)" }]}
    >
      <Image
        source={require("../../assets/dashboard-backdrop.jpg")}
        resizeMode="cover"
        style={{ width: "100%", height: "100%" }}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: "rgba(0,0,0,0.7)" },
        ]}
      />
    </View>
  );
}
export function Page({
  title,
  subtitle,
  titleLocalize = true,
  subtitleLocalize = true,
  children,
  refreshing,
  onRefresh,
  followContent = false,
  scrollEnabled = true,
}: PropsWithChildren<{
  title: string;
  subtitle?: string;
  titleLocalize?: boolean;
  subtitleLocalize?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  followContent?: boolean;
  scrollEnabled?: boolean;
}>) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const nearEnd = useRef(true);
  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <Backdrop />
      <ScrollView
        ref={scroll}
        scrollEnabled={scrollEnabled}
        onScroll={(event) => {
          const { contentOffset, contentSize, layoutMeasurement } =
            event.nativeEvent;
          nearEnd.current =
            contentOffset.y + layoutMeasurement.height >=
            contentSize.height - 120;
        }}
        scrollEventThrottle={100}
        onContentSizeChange={() => {
          if (followContent && nearEnd.current)
            scroll.current?.scrollToEnd({ animated: false });
        }}
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: Platform.OS === "android" ? insets.top + 16 : 16,
          paddingBottom: insets.bottom + 100,
          gap: 24,
        }}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing ?? false}
              onRefresh={onRefresh}
              tintColor={t.accent}
            />
          ) : undefined
        }
      >
        <View style={{ gap: 4 }}>
          <Copy size={26} bold localize={titleLocalize}>
            {title}
          </Copy>
          {!!subtitle && (
            <Copy size={14} muted localize={subtitleLocalize}>
              {subtitle}
            </Copy>
          )}
        </View>
        {demoMode && (
          <Glass style={{ padding: 12 }}>
            <Copy size={12} muted>
              演示模式 · 行情为静态样本，非实时市场数据
            </Copy>
          </Glass>
        )}
        {children}
      </ScrollView>
    </View>
  );
}
export function NavRow({
  title,
  note,
  onPress,
  last = false,
}: {
  title: string;
  note?: string;
  onPress: () => void;
  last?: boolean;
}) {
  const t = useTheme();
  const text = useText();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={text(title)}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 52,
        paddingHorizontal: 20,
        paddingVertical: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        opacity: pressed ? 0.6 : 1,
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        borderColor: t.border,
      })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Copy size={15}>{title}</Copy>
        {!!note && (
          <Copy size={12} muted>
            {note}
          </Copy>
        )}
      </View>
      <Copy muted localize={false}>
        ›
      </Copy>
    </Pressable>
  );
}
export function Section({
  title,
  note,
  localize = true,
}: {
  title: string;
  note?: string;
  localize?: boolean;
}) {
  return (
    <View style={{ gap: 4 }}>
      <Copy size={20} bold localize={localize}>
        {title}
      </Copy>
      {!!note && (
        <Copy size={12} muted localize={localize}>
          {note}
        </Copy>
      )}
    </View>
  );
}
export function Empty({ title, message }: { title: string; message: string }) {
  return (
    <Glass style={{ padding: 24, gap: 8 }}>
      <Copy size={20} bold>
        {title}
      </Copy>
      <Copy size={14} muted>
        {message}
      </Copy>
    </Glass>
  );
}
export function Failure({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  const t = useTheme();
  return (
    <View accessibilityRole="alert" style={{ gap: 8 }}>
      <Copy size={14} color={t.negative}>
        {message}
      </Copy>
      {retry && <Button onPress={retry}>重新加载</Button>}
    </View>
  );
}
/** Pulsing placeholder block; holds still when the system asks for reduced motion. */
export function Skeleton({
  width = "100%",
  height = 14,
  radius = 8,
  style,
}: {
  width?: ViewStyle["width"];
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    let loop: Animated.CompositeAnimation | undefined;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled || reduced) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0.45,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
    });
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [opacity]);
  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: t.tint,
          opacity,
        },
        style,
      ]}
    />
  );
}
/**
 * Cold-load wrapper for a skeleton. `children` must mirror the layout that replaces it
 * (see Skeletons.tsx). Appears after 300ms so fast reads never flash a placeholder.
 */
export function LoadingStatus({
  children,
  label = "正在加载数据",
}: PropsWithChildren<{ label?: string }>) {
  const text = useText();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 300);
    return () => clearTimeout(timer);
  }, []);
  return (
    <View
      accessible
      accessibilityLabel={text(label)}
      accessibilityState={{ busy: true }}
      style={{ gap: 12 }}
    >
      {visible && children}
    </View>
  );
}
export function PendingValue({ height = 20 }: { height?: number }) {
  const t = useTheme();
  return (
    <View
      style={{ height, justifyContent: "center" }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View
        style={{
          width: 32,
          height: 2,
          borderRadius: 1,
          backgroundColor: t.secondary,
          opacity: 0.5,
        }}
      />
    </View>
  );
}
export function Search({
  value,
  onChange,
  onSubmit,
  placeholder = "搜索股票代码或名称",
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
}) {
  const t = useTheme();
  const text = useText();
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  return (
    <Glass
      material
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
      }}
    >
      <TextInput
        ref={input}
        value={value}
        onChangeText={onChange}
        accessibilityLabel={text(placeholder)}
        placeholder={text(placeholder)}
        placeholderTextColor={t.secondary}
        autoCapitalize="characters"
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={onSubmit}
        style={{
          flex: 1,
          minHeight: 48,
          fontSize: 16,
          color: t.text,
          paddingVertical: 12,
        }}
      />
      {!!value && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={text("清除搜索")}
          onPress={() => {
            onChange("");
            input.current?.focus();
          }}
          style={{
            minWidth: 44,
            minHeight: 44,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Copy muted>×</Copy>
        </Pressable>
      )}
    </Glass>
  );
}
export const styles = StyleSheet.create({
  glass: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  button: {
    minHeight: 44,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
});

// Virtualized counterpart of Page for potentially large news/watchlist feeds.
export function ListPage<T>({
  title,
  subtitle,
  items,
  keyFor,
  renderItem,
  header,
  footer,
  empty,
  onRefresh,
  refreshing = false,
}: {
  title: string;
  subtitle?: string;
  items: readonly T[];
  keyFor: (item: T) => string;
  renderItem: (item: T) => React.ReactElement;
  header?: React.ReactElement;
  footer?: React.ReactElement;
  empty?: React.ReactElement;
  onRefresh: () => void;
  refreshing?: boolean;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <Backdrop />
      <FlatList
        data={items}
        keyExtractor={keyFor}
        renderItem={({ item }) => renderItem(item)}
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: Platform.OS === "android" ? insets.top + 16 : 16,
          paddingBottom: insets.bottom + 100,
        }}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={t.accent}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: 24, paddingBottom: 24 }}>
            <View style={{ gap: 4 }}>
              <Copy size={26} bold>
                {title}
              </Copy>
              {!!subtitle && (
                <Copy size={14} muted>
                  {subtitle}
                </Copy>
              )}
            </View>
            {demoMode && (
              <Glass style={{ padding: 12 }}>
                <Copy size={12} muted>
                  演示模式 · 行情为静态样本，非实时市场数据
                </Copy>
              </Glass>
            )}
            {header}
          </View>
        }
        ListFooterComponent={
          footer ? <View style={{ paddingTop: 24 }}>{footer}</View> : undefined
        }
        ListEmptyComponent={empty}
      />
    </View>
  );
}
