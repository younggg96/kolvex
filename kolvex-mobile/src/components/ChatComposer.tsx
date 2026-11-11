// The Web's docked ChatInput: one glass surface with the field and a round send button
// at its end. Sources and model sit behind "+", as the Web's skills popover does.
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { GlassView } from "expo-glass-effect";
import { SymbolView } from "expo-symbols";
import { useText } from "../lib/i18n";
import { useTheme } from "../lib/theme";
import { ModelPicker } from "./ModelPicker";
import { Sheet } from "./PaperTrading";
import { Copy, Chip, phone, useLiquidGlass } from "./UI";

export const CHAT_SOURCES: [string, string][] = [
  ["web", "网页"],
  ["portfolio", "持仓"],
  ["plaid", "账户交易"],
];

export function ChatComposer({
  value,
  onChange,
  onSend,
  onStop,
  busy = false,
  disabled = false,
  placeholder = "问一只股票、一位博主，或和持仓的关系...",
  tall = false,
  sources,
  onSources,
  model,
  onModel,
  user,
  note,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop?: () => void;
  busy?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** The new-chat page's taller field (the Web's min-h-24). */
  tall?: boolean;
  sources?: string[];
  onSources?: (next: string[]) => void;
  model?: string;
  onModel?: (next: string) => void;
  user?: string;
  /** A line above the field, such as attached quote evidence. */
  note?: React.ReactNode;
}) {
  const t = useTheme();
  const text = useText();
  const glass = useLiquidGlass();
  const [options, setOptions] = useState(false);
  const canSend = !!value.trim() && !busy && !disabled;
  const hasOptions = !!onSources || !!onModel;
  return (
    <GlassView
      glassEffectStyle={glass ? "regular" : "none"}
      colorScheme={t.dark ? "dark" : "light"}
      style={{
        borderRadius: phone(28),
        borderWidth: glass ? 0 : 1,
        borderColor: t.rim,
        backgroundColor: glass ? undefined : t.card,
        paddingTop: phone(14),
        paddingBottom: phone(10),
        paddingHorizontal: phone(20),
        gap: 6,
      }}
    >
      {note}
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={text(placeholder)}
        placeholderTextColor={t.secondary}
        accessibilityLabel={text(placeholder)}
        multiline
        maxLength={100000}
        editable={!disabled}
        style={{
          // Fields stay 16px on phones so iOS never zooms, as on the Web.
          fontSize: 16,
          lineHeight: 24,
          color: t.text,
          minHeight: tall ? phone(96) - phone(24) : 28,
          maxHeight: 160,
          paddingTop: 0,
          paddingRight: 44,
          textAlignVertical: "top",
        }}
      />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {hasOptions ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={text("资料来源与模型")}
            onPress={() => setOptions(true)}
            hitSlop={8}
            style={({ pressed }) => ({
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              marginLeft: -6,
              backgroundColor: pressed ? t.wash : "transparent",
            })}
          >
            <SymbolView
              name={{ ios: "plus", android: "add", web: "add" }}
              size={16}
              tintColor={t.secondary}
            />
          </Pressable>
        ) : (
          <View />
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={text(busy ? "停止回复" : "发送")}
          disabled={busy ? !onStop : !canSend}
          onPress={busy ? onStop : onSend}
          hitSlop={6}
          style={({ pressed }) => ({
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: busy || canSend ? t.brand : t.wash,
            opacity: pressed ? 0.75 : 1,
          })}
        >
          <SymbolView
            name={
              busy
                ? { ios: "stop.fill", android: "stop", web: "stop" }
                : {
                    ios: "arrow.up",
                    android: "arrow_upward",
                    web: "arrow_upward",
                  }
            }
            size={busy ? 12 : 16}
            weight="semibold"
            tintColor={busy || canSend ? t.onBrand : t.secondary}
          />
        </Pressable>
      </View>
      <Sheet
        title="资料来源与模型"
        visible={options}
        onClose={() => setOptions(false)}
      >
        {!!onSources && sources && (
          <View style={{ gap: 8 }}>
            <Copy size={14} bold>
              资料来源
            </Copy>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {CHAT_SOURCES.map(([key, label]) => (
                <Chip
                  key={key}
                  selected={sources.includes(key)}
                  onPress={() =>
                    onSources(
                      sources.includes(key)
                        ? sources.filter((s) => s !== key)
                        : [...sources, key],
                    )
                  }
                >
                  {label}
                </Chip>
              ))}
            </View>
          </View>
        )}
        {!!onModel && !!user && (
          <View style={{ gap: 8 }}>
            <ModelPicker user={user} value={model ?? ""} onChange={onModel} />
          </View>
        )}
      </Sheet>
    </GlassView>
  );
}
