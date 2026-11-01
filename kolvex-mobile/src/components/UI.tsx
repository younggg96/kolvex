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
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { demoMode } from "../lib/api";
import { useTheme } from "../lib/theme";

export function Copy({
  children,
  size = 16,
  muted = false,
  bold = false,
  color,
  selectable = false,
}: PropsWithChildren<{
  size?: number;
  muted?: boolean;
  bold?: boolean;
  color?: string;
  selectable?: boolean;
}>) {
  const t = useTheme();
  return (
    <Text
      selectable={selectable}
      style={{
        color: color ?? (muted ? t.secondary : t.text),
        fontSize: size,
        fontWeight: bold ? "600" : "400",
        lineHeight: size * 1.45,
        fontVariant: ["tabular-nums"],
      }}
    >
      {children}
    </Text>
  );
}
export function Glass({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const t = useTheme();
  const [reduce, setReduce] = useState(true);
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    AccessibilityInfo.isReduceTransparencyEnabled()
      .then(setReduce)
      .catch(() => setReduce(true));
    const subscription = AccessibilityInfo.addEventListener(
      "reduceTransparencyChanged",
      setReduce,
    );
    return () => subscription.remove();
  }, []);
  const shell = [styles.glass, { borderColor: t.border }, style];
  if (reduce)
    return (
      <View style={[shell, { backgroundColor: t.surface }]}>{children}</View>
    );
  if (Platform.OS === "ios" && isLiquidGlassAvailable())
    return (
      <GlassView glassEffectStyle="regular" style={shell}>
        {children}
      </GlassView>
    );
  if (Platform.OS === "ios")
    return (
      <BlurView
        tint={t.background === "#0B100E" ? "dark" : "light"}
        intensity={60}
        style={shell}
      >
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
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
          borderColor: selected ? t.accent : t.border,
          opacity: disabled ? 0.45 : pressed ? 0.65 : 1,
        },
      ]}
    >
      <Copy size={14} bold color={selected ? t.accent : t.text}>
        {children}
      </Copy>
    </Pressable>
  );
}
export function Page({
  title,
  subtitle,
  children,
  refreshing,
  onRefresh,
  followContent = false,
}: PropsWithChildren<{
  title: string;
  subtitle?: string;
  refreshing?: boolean;
  onRefresh?: () => void;
  followContent?: boolean;
}>) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const nearEnd = useRef(true);
  return (
    <ScrollView
      ref={scroll}
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
      {children}
    </ScrollView>
  );
}
export function Section({ title, note }: { title: string; note?: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Copy size={20} bold>
        {title}
      </Copy>
      {note && (
        <Copy size={12} muted>
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
  return (
    <View
      accessibilityLabel="正在加载数据"
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
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  return (
    <Glass
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
        accessibilityLabel={placeholder}
        placeholder={placeholder}
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
          accessibilityLabel="清除搜索"
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
