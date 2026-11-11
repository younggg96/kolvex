// The one sort/filter surface for every list: a native bottom sheet that sizes to
// its content (iOS Liquid Glass when available), a title with a green close button,
// wrapping chip groups and a full-width Done.
import type { ReactNode } from "react";
import { Platform, Pressable, View } from "react-native";
import { BottomSheet, RNHostView } from "@expo/ui";
import { SymbolView } from "expo-symbols";
import { useTheme } from "../lib/theme";
import { Button, Copy, phone, styles, useLiquidGlass } from "./UI";

export function OptionSheet({
  title,
  visible,
  onClose,
  onReset,
  children,
}: {
  title: string;
  visible: boolean;
  onClose: () => void;
  /** Shown as a 重置 link beside the title while something differs from the default. */
  onReset?: () => void;
  children: ReactNode;
}) {
  const t = useTheme();
  const glass = useLiquidGlass();
  return (
    <BottomSheet
      isPresented={visible}
      onDismiss={onClose}
      containerColor={Platform.OS === "ios" && glass ? undefined : t.surface}
      contentPadding={{ top: 22, bottom: 16, left: 20, right: 20 }}
    >
      <RNHostView matchContents={{ vertical: true }}>
        <View style={{ gap: phone(16) }}>
          <View style={styles.row}>
            <Copy size={18} bold>
              {title}
            </Copy>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 16 }}
            >
              {onReset && (
                <Copy size={14} color={t.accent} role="link" onPress={onReset}>
                  重置
                </Copy>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="关闭"
                onPress={onClose}
                hitSlop={6}
                style={({ pressed }) => ({
                  width: phone(36),
                  height: phone(36),
                  borderRadius: 999,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: t.brand,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <SymbolView
                  name={{ ios: "xmark", android: "close", web: "close" }}
                  size={phone(14)}
                  weight="semibold"
                  tintColor={t.onBrand}
                />
              </Pressable>
            </View>
          </View>
          {children}
          <Button variant="primary" onPress={onClose}>
            完成
          </Button>
        </View>
      </RNHostView>
    </BottomSheet>
  );
}

/** A labelled group of wrapping pill chips; the selected one is the white thumb. */
export function OptionGroup({
  label,
  options,
  value,
  onChange,
  localize = true,
}: {
  label: string;
  options: readonly (readonly [string, string])[];
  value: string;
  onChange: (value: string) => void;
  localize?: boolean;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Copy size={12} muted>
        {label}
      </Copy>
      <View
        accessibilityRole="radiogroup"
        style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
      >
        {options.map(([key, name]) => (
          <OptionChip
            key={key}
            selected={key === value}
            localize={localize}
            onPress={() => onChange(key)}
          >
            {name}
          </OptionChip>
        ))}
      </View>
    </View>
  );
}

export function OptionChip({
  selected,
  onPress,
  disabled = false,
  localize = true,
  children,
}: {
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  localize?: boolean;
  children: string;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      hitSlop={{ top: 4, bottom: 4 }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: phone(36),
        paddingHorizontal: phone(14),
        justifyContent: "center",
        borderRadius: 999,
        borderWidth: 1,
        borderColor: selected ? "transparent" : t.rim,
        backgroundColor: selected ? "rgba(255,255,255,0.97)" : "transparent",
        opacity: disabled ? 0.45 : pressed ? 0.65 : 1,
      })}
    >
      <Copy
        size={13}
        bold={selected}
        localize={localize}
        color={selected ? "#111111" : t.text}
      >
        {children}
      </Copy>
    </Pressable>
  );
}
