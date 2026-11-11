import { Pressable, ScrollView, View } from "react-native";
import type { ReactNode } from "react";
import { Copy } from "../UI";
import { useTheme } from "../../lib/theme";

/** A titled block of search picks; the screen decides where the block sits. */
export function SearchGroup({
  title,
  action,
  onAction,
  children,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: 12 }}>
      <View
        style={{
          minHeight: 24,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Copy bold>{title}</Copy>
        {!!action && (
          <Pressable accessibilityRole="button" onPress={onAction} hitSlop={10}>
            <Copy size={14} muted>
              {action}
            </Copy>
          </Pressable>
        )}
      </View>
      {children}
    </View>
  );
}

export function PillRow({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={{ marginHorizontal: -16 }}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
    >
      {children}
    </ScrollView>
  );
}

export function Pill({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        height: 44,
        maxWidth: 240,
        paddingHorizontal: 16,
        justifyContent: "center",
        borderRadius: 22,
        borderWidth: 1,
        borderColor: t.border,
        backgroundColor: pressed ? t.border : t.tint,
      })}
    >
      <Copy size={14} bold localize={false} lines={1}>
        {label}
      </Copy>
    </Pressable>
  );
}

export function ResultRow({
  title,
  detail,
  leading,
  trailing,
  onPress,
}: {
  title: string;
  detail: string;
  /** A company logo or icon before the text. */
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: t.border,
      }}
    >
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => ({
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingVertical: 14,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        {leading}
        <View style={{ flex: 1, gap: 2 }}>
          <Copy localize={false} lines={1}>
            {title}
          </Copy>
          <Copy size={14} muted localize={false} lines={1}>
            {detail}
          </Copy>
        </View>
      </Pressable>
      {trailing}
    </View>
  );
}
