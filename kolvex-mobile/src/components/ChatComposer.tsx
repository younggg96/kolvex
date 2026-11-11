// The Web's docked ChatInput: one glass surface with the field, then a footer with "+"
// (the skills popover), the model chip and a round send button.
import { useEffect, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
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
import { Copy, phone, useLiquidGlass } from "./UI";

type Anchor = { x: number; y: number; width: number };

/** A card that opens upwards from the composer, like the Web's side="top" popovers. */
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
  const at = anchor ?? { x: 16, y: screen.height - 200, width: 0 };
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
          bottom: screen.height - at.y + 8,
          width: Math.min(width, screen.width - 32),
          maxHeight: at.y - 80,
          borderRadius: phone(24),
          padding: 8,
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
      <View
        style={{
          gap: 4,
          paddingHorizontal: 10,
          paddingTop: 6,
          paddingBottom: 10,
          marginBottom: 4,
          borderBottomWidth: 1,
          borderColor: t.border,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Copy size={14} bold>
            技能
          </Copy>
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 999,
              backgroundColor: t.wash,
            }}
          >
            <Copy
              size={12}
              muted
            >{`已选 ${skills.length}/${CHAT_SKILLS.length}`}</Copy>
          </View>
        </View>
        <Copy size={12} muted>
          选择这段对话可以使用的研究工具。
        </Copy>
      </View>
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
              gap: 10,
              minHeight: phone(44),
              paddingHorizontal: 10,
              borderRadius: phone(16),
              backgroundColor: pressed ? t.wash : "transparent",
            })}
          >
            <SymbolView
              name={{ ios, android, web: android } as never}
              size={15}
              tintColor={t.secondary}
            />
            <View style={{ flex: 1 }}>
              <Copy size={14}>{SKILL_LABELS[skill]}</Copy>
            </View>
            <View
              style={{
                width: 18,
                height: 18,
                borderRadius: 5,
                borderWidth: on ? 0 : 1.5,
                borderColor: t.secondary,
                backgroundColor: on ? t.wash : "transparent",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {on && (
                <SymbolView
                  name={{ ios: "checkmark", android: "check", web: "check" }}
                  size={11}
                  weight="bold"
                  tintColor={t.text}
                />
              )}
            </View>
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
  loaded,
  onChange,
}: {
  value: string;
  available: (id: string) => boolean;
  loaded: boolean;
  onChange: (id: string) => void;
}) {
  const t = useTheme();
  const any = MODEL_CONFIGS.some((m) => available(m.id));
  return (
    <>
      {loaded && !any && (
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push("/settings?tab=api-keys")}
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
              minHeight: phone(40),
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
              <Copy size={12} bold={selected} localize={false}>
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

export function ChatComposer({
  value,
  onChange,
  onSend,
  onStop,
  busy = false,
  disabled = false,
  placeholder = "问一只股票、一位博主，或和持仓的关系...",
  tall = false,
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
  /** The new-chat page's taller field (the Web's min-h-24). */
  tall?: boolean;
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
  const [menu, setMenu] = useState<"skills" | "model" | null>(null);
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
  const first = MODEL_CONFIGS.find((m) => available(m.id))?.id;
  // As on the Web, the first model with a key is chosen once keys load.
  useEffect(() => {
    if (!onModel || !first || (model && available(model))) return;
    const timer = setTimeout(() => onModel(first), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [first, model]);
  const canSend = !!value.trim() && !busy && !disabled;
  const current = MODEL_CONFIGS.find((m) => m.id === model && available(m.id));
  const anyModel = MODEL_CONFIGS.some((m) => available(m.id));
  const open = (next: "skills" | "model") => {
    setMenu(next);
    const node = host.current as unknown as {
      measureInWindow?: (
        cb: (x: number, y: number, width: number) => void,
      ) => void;
    } | null;
    node?.measureInWindow?.((x, y, width) => setAnchor({ x, y, width }));
  };
  const close = () => setMenu(null);
  return (
    <View ref={host} collapsable={false}>
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
          paddingHorizontal: phone(10),
          gap: 4,
        }}
      >
        {!!note && <View style={{ paddingHorizontal: phone(8) }}>{note}</View>}
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
            paddingHorizontal: phone(8),
            textAlignVertical: "top",
          }}
        />
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
                onPress={() => open("skills")}
                hitSlop={6}
                style={({ pressed }) => ({
                  width: phone(32) + 4,
                  height: phone(32) + 4,
                  borderRadius: 999,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor:
                    pressed || menu === "skills" ? t.wash : "transparent",
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
                onPress={() => open("model")}
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
                    pressed || menu === "model" ? t.wash : "transparent",
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
              backgroundColor: busy ? "transparent" : canSend ? t.brand : t.wash,
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
      {menu === "skills" && skills && onSkills && (
        <Popover anchor={anchor} width={256} onClose={close}>
          <SkillsMenu skills={skills} onChange={onSkills} />
        </Popover>
      )}
      {menu === "model" && onModel && (
        <Popover anchor={anchor} width={208} onClose={close}>
          <ModelMenu
            value={model ?? ""}
            available={available}
            loaded={!providers.loading}
            onChange={(id) => {
              onModel(id);
              close();
            }}
          />
        </Popover>
      )}
    </View>
  );
}
