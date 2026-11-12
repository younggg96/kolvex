// The shared model picker: a native bottom sheet that sizes to its content,
// with the current model, a scrolling list of models and a Done button.
// Pair it with useModelProviders to know which models have an API key.
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
} from "react-native";
import { BottomSheet, RNHostView } from "@expo/ui";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { MODEL_CONFIGS } from "../lib/aiModels";
import { apiRequest } from "../lib/http";
import { useResource } from "../lib/useResource";
import { useTheme } from "../lib/theme";
import { Copy, Failure, phone, useLiquidGlass } from "./UI";

export function useModelProviders(user?: string) {
  return useResource(`providers:${user ?? ""}`, (signal) =>
    user
      ? apiRequest<{ available_providers: string[] }>(
          "/user-api-keys/available-providers",
          { signal, authenticated: true, expectedUser: user },
        )
      : Promise.resolve({ available_providers: [] as string[] }),
  );
}

function ModelMenu({
  value,
  available,
  onChange,
  onOpenKeys,
}: {
  value: string;
  available: (id: string) => boolean;
  onChange: (id: string) => void;
  onOpenKeys: () => void;
}) {
  const t = useTheme();
  const any = MODEL_CONFIGS.some((m) => available(m.id));
  return (
    <>
      {!any && (
        <Pressable
          accessibilityRole="link"
          onPress={onOpenKeys}
          style={{ padding: 12, alignItems: "center", gap: 6 }}
        >
          <Copy size={12} muted>
            添加 API 密钥后即可选择模型。
          </Copy>
          <Copy size={12} bold color={t.accent}>
            设置 API 密钥
          </Copy>
        </Pressable>
      )}
      {MODEL_CONFIGS.map((model) => {
        const ok = available(model.id);
        const selected = ok && value === model.id;
        return (
          <Pressable
            key={model.id}
            accessibilityRole="button"
            accessibilityState={{ selected, disabled: !ok }}
            disabled={!ok}
            onPress={() => onChange(model.id)}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              minHeight: 44,
              paddingHorizontal: 10,
              borderRadius: phone(12),
              backgroundColor: selected || pressed ? t.wash : "transparent",
              opacity: ok ? 1 : 0.4,
            })}
          >
            <View style={{ width: 12 }}>
              {ok ? (
                selected && (
                  <SymbolView
                    name={{ ios: "checkmark", android: "check", web: "check" }}
                    size={11}
                    weight="bold"
                    tintColor={t.accent}
                  />
                )
              ) : (
                <SymbolView
                  name={{ ios: "lock", android: "lock", web: "lock" }}
                  size={11}
                  tintColor={t.secondary}
                />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Copy size={14} bold={selected} localize={false}>
                {model.name}
              </Copy>
            </View>
            {model.isPro && ok && (
              <View
                style={{
                  paddingHorizontal: 6,
                  paddingVertical: 1,
                  borderRadius: 999,
                  backgroundColor: t.wash,
                }}
              >
                <Copy size={11} muted localize={false}>
                  Pro
                </Copy>
              </View>
            )}
          </Pressable>
        );
      })}
    </>
  );
}

export function ModelSheet({
  draft,
  available,
  loading,
  error,
  onRetry,
  onChange,
  onDone,
  onClose,
}: {
  draft: string | null;
  available: (id: string) => boolean;
  loading: boolean;
  error?: string;
  onRetry: () => void;
  onChange: (id: string) => void;
  onDone: () => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const glass = useLiquidGlass();
  const { height } = useWindowDimensions();
  const selected = MODEL_CONFIGS.find((model) => model.id === draft);
  const canApply = !!draft && available(draft);
  return (
    <BottomSheet
      isPresented={draft !== null}
      onDismiss={onClose}
      containerColor={Platform.OS === "ios" && glass ? undefined : t.surface}
      contentPadding={{ top: 22, bottom: 16, left: 22, right: 22 }}
    >
      <RNHostView matchContents={{ vertical: true }}>
        <View style={{ gap: 16 }}>
          <View style={{ alignItems: "center" }} accessibilityRole="header">
            <Copy size={18} bold>
              模型配置
            </Copy>
          </View>
          <View
            style={{
              borderRadius: 22,
              backgroundColor: t.wash,
              paddingHorizontal: 12,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                minHeight: 44,
                gap: 12,
              }}
            >
              <Copy size={15}>模型</Copy>
              <View style={{ flex: 1, alignItems: "flex-end" }}>
                {selected ? (
                  <Copy size={15} muted lines={1} localize={false}>
                    {selected.name}
                  </Copy>
                ) : (
                  <Copy size={15} muted lines={1}>
                    选择模型
                  </Copy>
                )}
              </View>
            </View>
            <ScrollView
              style={{
                maxHeight: Math.min(320, Math.max(132, height * 0.45)),
                borderTopWidth: 1,
                borderColor: t.border,
              }}
              contentContainerStyle={{ paddingVertical: 6 }}
            >
              {loading ? (
                <ActivityIndicator
                  color={t.secondary}
                  style={{ padding: 12 }}
                />
              ) : error ? (
                <Failure message={error} retry={onRetry} />
              ) : (
                <ModelMenu
                  value={draft ?? ""}
                  available={available}
                  onChange={onChange}
                  onOpenKeys={() => {
                    onClose();
                    router.push("/settings?tab=api-keys");
                  }}
                />
              )}
            </ScrollView>
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={!canApply}
            onPress={onDone}
            style={({ pressed }) => ({
              minHeight: 44,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 22,
              backgroundColor: t.text,
              opacity: !canApply ? 0.4 : pressed ? 0.8 : 1,
            })}
          >
            <Copy size={16} bold color={t.background}>
              完成
            </Copy>
          </Pressable>
        </View>
      </RNHostView>
    </BottomSheet>
  );
}
