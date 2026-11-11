// A compact glass composer that grows with the message. The footer holds skills,
// the model picker, and the send or stop button.
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
} from "react-native";
import { BottomSheet, RNHostView } from "@expo/ui";
import { router } from "expo-router";
import { GlassView } from "expo-glass-effect";
import { SymbolView } from "expo-symbols";
import { MODEL_CONFIGS, providerId } from "../lib/aiModels";
import {
  CHAT_SKILLS,
  SKILL_ICONS,
  SKILL_LABELS,
  type ChatSkill,
} from "../lib/chatSkills";
import { apiRequest } from "../lib/http";
import { useText } from "../lib/i18n";
import { useResource } from "../lib/useResource";
import { useTheme } from "../lib/theme";
import NativeField from "./native/NativeField";
import { Copy, Failure, phone, useLiquidGlass } from "./UI";

type Anchor = { x: number; bottom: number };

/** The skills menu opens over the leading edge of the composer. */
function Popover({
  anchor,
  width,
  onClose,
  children,
}: {
  anchor: Anchor | null;
  width: number;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const t = useTheme();
  const glass = useLiquidGlass();
  const screen = useWindowDimensions();
  // Until the composer is measured, open from the bottom-left above the dock.
  const at = anchor ?? { x: 16, bottom: screen.height - 100 };
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="关闭"
        onPress={onClose}
        style={{ flex: 1 }}
      />
      <GlassView
        glassEffectStyle={glass ? "regular" : "none"}
        colorScheme={t.dark ? "dark" : "light"}
        style={{
          position: "absolute",
          left: at.x,
          bottom: Math.max(12, screen.height - at.bottom),
          width: Math.min(width, screen.width - 32),
          maxHeight: Math.max(96, at.bottom - 72),
          borderRadius: 32,
          padding: 12,
          backgroundColor: glass ? undefined : t.card,
          borderWidth: glass ? 0 : 1,
          borderColor: t.rim,
        }}
      >
        <ScrollView bounces={false}>{children}</ScrollView>
      </GlassView>
    </Modal>
  );
}

function SkillsMenu({
  skills,
  onChange,
}: {
  skills: ChatSkill[];
  onChange: (next: ChatSkill[]) => void;
}) {
  const t = useTheme();
  return (
    <>
      {CHAT_SKILLS.map((skill) => {
        const on = skills.includes(skill);
        const [ios, android] = SKILL_ICONS[skill];
        return (
          <Pressable
            key={skill}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            onPress={() =>
              onChange(
                on
                  ? skills.filter((item) => item !== skill)
                  : CHAT_SKILLS.filter(
                      (item) => item === skill || skills.includes(item),
                    ),
              )
            }
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              minHeight: 52,
              paddingHorizontal: 8,
              borderRadius: 22,
              backgroundColor: pressed ? t.wash : "transparent",
            })}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: t.wash,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <SymbolView
                name={{ ios, android, web: android } as never}
                size={17}
                tintColor={t.text}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Copy size={17}>{SKILL_LABELS[skill]}</Copy>
            </View>
            {on && (
              <SymbolView
                name={{ ios: "checkmark", android: "check", web: "check" }}
                size={14}
                weight="semibold"
                tintColor={t.accent}
              />
            )}
          </Pressable>
        );
      })}
    </>
  );
}

function useProviders(user?: string) {
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

function ModelSheet({
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
      snapPoints={["half"]}
      containerColor={Platform.OS === "ios" && glass ? undefined : t.surface}
      contentPadding={{ top: 22, bottom: 16, left: 22, right: 22 }}
    >
      <RNHostView>
        <View style={{ flex: 1, gap: 16 }}>
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
                height: Math.min(220, Math.max(96, height / 2 - 180)),
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

export function ChatComposer({
  value,
  onChange,
  onSend,
  onStop,
  busy = false,
  disabled = false,
  placeholder = "问一只股票、一位博主，或和持仓的关系...",
  skills,
  onSkills,
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
  skills?: ChatSkill[];
  onSkills?: (next: ChatSkill[]) => void;
  model?: string;
  onModel?: (next: string) => void;
  user?: string;
  /** A line above the field, such as attached quote evidence. */
  note?: React.ReactNode;
}) {
  const t = useTheme();
  const text = useText();
  const glass = useLiquidGlass();
  const host = useRef<React.ComponentRef<typeof View>>(null);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [modelDraft, setModelDraft] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const providers = useProviders(onModel ? user : undefined);
  const available = (id: string) => {
    const config = MODEL_CONFIGS.find((m) => m.id === id);
    return (
      !!config &&
      !!providers.data?.available_providers.includes(
        providerId[config.provider],
      )
    );
  };
  const current = MODEL_CONFIGS.find((m) => m.id === model && available(m.id));
  const canSend =
    !!value.trim() && !busy && !disabled && (!onModel || !!current);
  const anyModel = MODEL_CONFIGS.some((m) => available(m.id));
  const openSkills = () => {
    setSkillsOpen(true);
    host.current?.measureInWindow((x, y, _width, height) =>
      setAnchor({ x, bottom: y + height }),
    );
  };
  return (
    <View ref={host} collapsable={false}>
      <GlassView
        glassEffectStyle={glass ? "regular" : "none"}
        colorScheme={t.dark ? "dark" : "light"}
        style={{
          borderRadius: phone(26),
          borderWidth: glass ? 0 : 1,
          borderColor: t.rim,
          backgroundColor: glass ? undefined : t.card,
          paddingTop: phone(14),
          paddingBottom: phone(8),
          paddingHorizontal: phone(10),
          gap: 4,
        }}
      >
        {!!note && <View style={{ paddingHorizontal: phone(8) }}>{note}</View>}
        <View style={{ paddingHorizontal: phone(8) }}>
          <NativeField
            value={value}
            onChange={onChange}
            placeholder={text(placeholder)}
            editable={!disabled}
            multiline
            maxLength={100000}
            minHeight={phone(32)}
            maxLines={6}
          />
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 2,
              flexShrink: 1,
            }}
          >
            {!!onSkills && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={text("技能")}
                onPress={openSkills}
                hitSlop={6}
                style={({ pressed }) => ({
                  width: phone(32) + 4,
                  height: phone(32) + 4,
                  borderRadius: 999,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor:
                    pressed || skillsOpen ? t.wash : "transparent",
                })}
              >
                <SymbolView
                  name={{ ios: "plus", android: "add", web: "add" }}
                  size={15}
                  tintColor={t.text}
                />
              </Pressable>
            )}
            {!!onModel && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={text("选择模型")}
                onPress={() => setModelDraft(current?.id ?? "")}
                hitSlop={6}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  height: phone(32) + 4,
                  paddingHorizontal: phone(12),
                  borderRadius: 999,
                  flexShrink: 1,
                  backgroundColor:
                    pressed || modelDraft !== null ? t.wash : "transparent",
                })}
              >
                <SymbolView
                  name={
                    anyModel || providers.loading
                      ? { ios: "cpu", android: "memory", web: "memory" }
                      : { ios: "lock", android: "lock", web: "lock" }
                  }
                  size={12}
                  tintColor={t.secondary}
                />
                <View style={{ flexShrink: 1 }}>
                  <Copy
                    size={13}
                    bold
                    lines={1}
                    color={anyModel ? t.text : t.secondary}
                    localize={!current}
                  >
                    {current
                      ? current.name
                      : providers.loading || anyModel
                        ? "选择模型"
                        : "添加 API 密钥"}
                  </Copy>
                </View>
                <SymbolView
                  name={{
                    ios: "chevron.down",
                    android: "expand_more",
                    web: "expand_more",
                  }}
                  size={9}
                  weight="semibold"
                  tintColor={t.secondary}
                />
              </Pressable>
            )}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={text(busy ? "停止回复" : "发送")}
            disabled={busy ? !onStop : !canSend}
            onPress={busy ? onStop : onSend}
            hitSlop={6}
            style={({ pressed }) => ({
              width: phone(36) + 4,
              height: phone(36) + 4,
              borderRadius: 999,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: busy ? 1 : 0,
              borderColor: t.rim,
              backgroundColor: busy
                ? "transparent"
                : canSend
                  ? t.brand
                  : t.wash,
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
              size={busy ? 11 : 15}
              weight="bold"
              tintColor={busy ? t.text : canSend ? t.onBrand : t.secondary}
            />
          </Pressable>
        </View>
      </GlassView>
      {skillsOpen && skills && onSkills && (
        <Popover
          anchor={anchor}
          width={256}
          onClose={() => setSkillsOpen(false)}
        >
          <SkillsMenu skills={skills} onChange={onSkills} />
        </Popover>
      )}
      {onModel && (
        <ModelSheet
          draft={modelDraft}
          available={available}
          loading={providers.loading}
          error={providers.error}
          onRetry={providers.refresh}
          onChange={setModelDraft}
          onClose={() => setModelDraft(null)}
          onDone={() => {
            if (modelDraft && available(modelDraft)) onModel(modelDraft);
            setModelDraft(null);
          }}
        />
      )}
    </View>
  );
}
