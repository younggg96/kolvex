import {
  useEffect,
  useRef,
  useState,
  type ComponentRef,
  type PropsWithChildren,
} from "react";
import {
  AccessibilityInfo,
  FlatList,
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
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { demoMode } from "../lib/api";
import { usePreferences } from "../state/Preferences";
import { translateNodes, useText } from "../lib/i18n";
import { useTheme } from "../lib/theme";
import SwiftGlass from "./native/SwiftGlass";
import SwiftButton, { swiftButtonsAvailable } from "./native/SwiftButton";

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
export function Glass({
  children,
  style,
  material = false,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle>; material?: boolean }>) {
  const t = useTheme();
  const [reduce, setReduce] = useState(true);
  useEffect(() => {
    if (!material || Platform.OS !== "ios") return;
    AccessibilityInfo.isReduceTransparencyEnabled()
      .then(setReduce)
      .catch(() => setReduce(true));
    const subscription = AccessibilityInfo.addEventListener(
      "reduceTransparencyChanged",
      setReduce,
    );
    return () => subscription.remove();
  }, [material]);
  const shell = [styles.glass, { borderColor: t.border }, style];
  if (!material || reduce)
    return (
      <View style={[shell, { backgroundColor: t.surface }]}>{children}</View>
    );
  if (Platform.OS === "ios" && isLiquidGlassAvailable())
    return <SwiftGlass style={shell}>{children}</SwiftGlass>;
  if (Platform.OS === "ios")
    return (
      <BlurView tint={t.dark ? "dark" : "light"} intensity={60} style={shell}>
        {children}
      </BlurView>
    );
  return (
    <View style={[shell, { backgroundColor: t.surface }]}>{children}</View>
  );
}
export function Button({
  children,
  onPress,
  selected = false,
  disabled = false,
  label,
}: PropsWithChildren<{
  onPress: () => void;
  selected?: boolean;
  disabled?: boolean;
  label?: string;
}>) {
  const t = useTheme();
  const { locale } = usePreferences();
  const text = useText();
  if (swiftButtonsAvailable)
    return (
      <SwiftButton
        selected={selected}
        disabled={disabled}
        label={label ? text(label) : undefined}
        onPress={onPress}
      >
        {translateNodes(children, locale)}
      </SwiftButton>
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
        styles.button,
        {
          backgroundColor: selected ? t.tint : t.surface,
          borderColor: selected ? t.secondary : t.border,
          opacity: disabled ? 0.45 : pressed ? 0.65 : 1,
        },
      ]}
    >
      <Copy size={14} bold color={t.text}>
        {translateNodes(children, locale)}
      </Copy>
    </Pressable>
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
      style={{ flex: 1, backgroundColor: t.background }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      contentContainerStyle={{
        paddingHorizontal: 24,
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
        <Copy size={12} bold color={t.accent}>
          KOLVEX
        </Copy>
        <Copy size={36} bold localize={titleLocalize}>
          {title}
        </Copy>
        {subtitle && (
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
      {note && (
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
export function Skeleton() {
  const t = useTheme();
  const text = useText();
  return (
    <View
      accessibilityLabel={text("正在加载数据")}
      accessibilityState={{ busy: true }}
      style={{ gap: 12 }}
    >
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            height: 72,
            borderRadius: 16,
            backgroundColor: t.border,
            opacity: 0.45,
          }}
        />
      ))}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
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
    <FlatList
      data={items}
      keyExtractor={keyFor}
      renderItem={({ item }) => renderItem(item)}
      style={{ flex: 1, backgroundColor: t.background }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        paddingHorizontal: 24,
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
            <Copy size={12} bold color={t.accent}>
              KOLVEX
            </Copy>
            <Copy size={36} bold>
              {title}
            </Copy>
            {subtitle && (
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
  );
}
