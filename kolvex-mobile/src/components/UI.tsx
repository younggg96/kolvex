import {
  createContext,
  useContext,
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

/**
 * The Web shrinks its rem from 16px to 14px on phones, so every size there is 87.5% of its
 * desktop value (globals.css). Sizes in this app are written in the Web's desktop px and
 * scaled here once, the way the Web's rem does; tiny labels keep its 11px floor.
 */
export const PHONE_SCALE = 0.875;
export const phone = (px: number) => px * PHONE_SCALE;
const fontPx = (size: number) =>
  size <= 12 ? Math.max(phone(size), 11) : phone(size);
export function Copy({
  children,
  size = 16,
  lineHeight,
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
  lineHeight?: number;
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
        fontSize: fontPx(size),
        fontWeight: bold ? "600" : "400",
        lineHeight: lineHeight === undefined
          ? fontPx(size) * (size >= 20 ? 1.3 : 1.5)
          : phone(lineHeight),
        letterSpacing: size >= 20 ? -0.2 : 0,
        fontVariant: ["tabular-nums"],
      }}
    >
      {localize && !selectable ? translateNodes(children, locale) : children}
    </Text>
  );
}
// Reading and data sit on an opaque surface. Only toolbars and overlays ask for
// `material`: real SwiftUI glass on iOS 26+, blur on older iOS, opaque elsewhere.
const SPACING =
  /^(padding|paddingHorizontal|paddingVertical|paddingTop|paddingBottom|paddingLeft|paddingRight|gap|rowGap|columnGap)$/;
/** Card padding and gaps are written in the Web's desktop px; phones get 87.5%, as on the Web. */
function scaleSpacing(style: StyleProp<ViewStyle>): StyleProp<ViewStyle> {
  const flat = StyleSheet.flatten(style);
  if (!flat) return style;
  return Object.fromEntries(
    Object.entries(flat).map(([key, value]) => [
      key,
      SPACING.test(key) && typeof value === "number" ? value * 0.875 : value,
    ]),
  ) as ViewStyle;
}
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
  clear = false,
}: PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  material?: boolean;
  /** Clear glass over artwork, darkened like the Web's bg-card-glass so text stays legible. */
  clear?: boolean;
}>) {
  const t = useTheme();
  const glass = useLiquidGlass();
  style = scaleSpacing(style);
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
        glassEffectStyle={clear ? "clear" : "regular"}
        tintColor={clear && t.dark ? "rgba(0,0,0,0.35)" : undefined}
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
  size = "md",
  variant = "neutral",
  block = variant === "primary",
  icon,
  trailingIcon,
}: PropsWithChildren<{
  onPress: () => void;
  selected?: boolean;
  disabled?: boolean;
  label?: string;
  size?: "sm" | "md";
  variant?: "neutral" | "primary";
  block?: boolean;
  /** Leading artwork, such as a provider logo. */
  icon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
}>) {
  const t = useTheme();
  const { locale } = usePreferences();
  const text = useText();
  const glass = useLiquidGlass();
  const primary = variant === "primary";
  const compact = size === "sm" ? {
    minHeight: phone(36),
    paddingHorizontal: phone(16),
    paddingVertical: phone(6),
  } : undefined;
  const label_ = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      {icon}
      <Copy size={14} bold color={primary ? t.onBrand : t.text}>
        {translateNodes(children, locale)}
      </Copy>
      {trailingIcon}
    </View>
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ? text(label) : undefined}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      hitSlop={size === "sm" ? { top: 7, bottom: 7 } : { top: 3, bottom: 3 }}
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
              compact,
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
          glassEffectStyle="regular"
          tintColor={primary ? t.brand : selected ? t.washStrong : undefined}
          colorScheme={t.dark ? "dark" : "light"}
          style={[styles.button, compact, { borderWidth: 0 }]}
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
  size = "md",
}: PropsWithChildren<{
  onPress: () => void;
  selected?: boolean;
  disabled?: boolean;
  /** Inside a segmented track, where the track supplies the surface. */
  bare?: boolean;
  /** The Web's segmented sizes: md min-h-10 px-4 text-sm, sm min-h-8 px-3 13px. */
  size?: "sm" | "md";
}>) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      // Drawn at the Web's phone size; the touch area stays at least 44pt.
      hitSlop={size === "sm" ? { top: 8, bottom: 8 } : { top: 5, bottom: 5 }}
      onPress={() => {
        if (Platform.OS !== "web")
          void Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        {
          minHeight: phone(size === "sm" ? 32 : 40),
          paddingHorizontal: phone(size === "sm" ? 12 : 16),
          paddingVertical: phone(size === "sm" ? 4 : 6),
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
      <Copy
        size={size === "sm" ? 13 : 14}
        bold
        color={selected ? "#111111" : t.text}
      >
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
/**
 * Inside an EmbeddedPage a screen's Page or ListPage renders only its content: the host
 * (the Markets tabs) owns the title, backdrop and scrolling, as the Web's tabbed pages do.
 */
const Embedded = createContext(false);
export function EmbeddedPage({ children }: PropsWithChildren) {
  return <Embedded.Provider value>{children}</Embedded.Provider>;
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
  hideTitle = false,
  stickyHeader,
  scrollKey,
}: PropsWithChildren<{
  title: string;
  subtitle?: string;
  /** The Web's tab pages show no page heading; `title` still names the screen. */
  hideTitle?: boolean;
  stickyHeader?: React.ReactNode;
  scrollKey?: string;
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
  const embedded = useContext(Embedded);
  useEffect(() => {
    if (scrollKey !== undefined) {
      scroll.current?.scrollTo({
        y: Platform.OS === "ios" ? -insets.top : 0,
        animated: false,
      });
    }
  }, [scrollKey, insets.top]);
  if (embedded) return <View style={{ gap: phone(24) }}>{children}</View>;
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
        stickyHeaderIndices={stickyHeader ? [0] : undefined}
        contentContainerStyle={{
          paddingHorizontal: phone(16),
          paddingTop:
            Platform.OS === "android" ? insets.top + phone(16) : phone(16),
          paddingBottom: insets.bottom + 100,
          gap: phone(24),
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
        {stickyHeader}
        {!hideTitle && (
          <View style={{ gap: 4 }}>
            <Copy size={24} bold localize={titleLocalize}>
              {title}
            </Copy>
            {!!subtitle && (
              <Copy size={14} muted localize={subtitleLocalize}>
                {subtitle}
              </Copy>
            )}
          </View>
        )}
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
        minHeight: 48,
        paddingHorizontal: phone(20),
        paddingVertical: phone(12),
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
    borderRadius: phone(24),
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  // The Web's h-11 button (38.5px on phones) with px-6 padding.
  button: {
    minHeight: phone(44),
    paddingHorizontal: phone(24),
    paddingVertical: phone(8),
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
  const embedded = useContext(Embedded);
  if (embedded)
    return (
      <View style={{ gap: phone(16) }}>
        {header}
        {items.length
          ? items.map((item) => (
              <View key={keyFor(item)}>{renderItem(item)}</View>
            ))
          : empty}
        {footer}
      </View>
    );
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
          paddingHorizontal: phone(16),
          paddingTop:
            Platform.OS === "android" ? insets.top + phone(16) : phone(16),
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
          <View style={{ gap: phone(24), paddingBottom: phone(24) }}>
            <View style={{ gap: 4 }}>
              <Copy size={24} bold>
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
