// The Web's settings page (app/dashboard/settings) at phone size: a pill tab bar for
// 账户 / API 密钥 / 偏好设置, each a bold section title over divided label/value rows.
import { useState, type ReactNode } from "react";
import { Image, Linking, Pressable, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { AuthGate, Filters } from "../../../components/Content";
import { FormSkeleton } from "../../../components/Skeletons";
import {
  Button,
  Copy,
  Failure,
  Glass,
  Page,
  Skeleton,
  phone,
} from "../../../components/UI";
import { profile } from "../../../lib/contentApi";
import { apiRequest } from "../../../lib/http";
import { useText } from "../../../lib/i18n";
import { safeExternal } from "../../../lib/links";
import { useTheme } from "../../../lib/theme";
import { useResource } from "../../../lib/useResource";
import { useAuth } from "../../../state/Auth";
import { usePreferences, type Appearance } from "../../../state/Preferences";

const TABS = [
  ["account", "账户"],
  ["api-keys", "API 密钥"],
  ["preferences", "偏好设置"],
] as const;

/** The Web's PROVIDER_INFO (lib/api/userApiKeysApi.ts). */
const PROVIDERS: Record<
  string,
  { name: string; description: string; placeholder: string; docsUrl: string }
> = {
  openai: {
    name: "OpenAI",
    description: "GPT-6 Astra, GPT-6.1 Sol, GPT-6 Luna",
    placeholder: "sk-...",
    docsUrl: "https://platform.openai.com/api-keys",
  },
  anthropic: {
    name: "Anthropic",
    description:
      "Claude Fable 5.1, Claude Opus 5.5, Claude Sonnet 5.5, Claude Haiku 5.5",
    placeholder: "sk-ant-...",
    docsUrl: "https://console.anthropic.com/settings/keys",
  },
  deepseek: {
    name: "DeepSeek",
    description: "DeepSeek V4.1 Flash, DeepSeek V4 Pro",
    placeholder: "sk-...",
    docsUrl: "https://platform.deepseek.com/api_keys",
  },
  qwen: {
    name: "Qwen (Alibaba)",
    description: "Qwen 3.8 Max, Qwen 3.7 Plus, Qwen 3.8 Flash",
    placeholder: "sk-...",
    docsUrl: "https://dashscope.console.aliyun.com/apiKey",
  },
  gemini: {
    name: "Google Gemini",
    description: "Gemini 3.8 Flash, Gemini 3.1 Pro (Preview)",
    placeholder: "AI...",
    docsUrl: "https://aistudio.google.com/apikey",
  },
  kimi: {
    name: "Kimi (Moonshot)",
    description: "Kimi K3",
    placeholder: "sk-...",
    docsUrl: "https://platform.moonshot.cn/console/api-keys",
  },
  grok: {
    name: "Grok (xAI)",
    description: "Grok 4.7",
    placeholder: "xai-...",
    docsUrl: "https://console.x.ai/",
  },
};

/** The Web's SettingsSection: a bold title with an underline, then its rows. */
function SettingsSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const t = useTheme();
  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          paddingTop: 8,
          paddingBottom: 14,
          borderBottomWidth: 1,
          borderColor: t.border,
        }}
      >
        <Copy size={22} bold>
          {title}
        </Copy>
        {action}
      </View>
      {children}
    </View>
  );
}

/** The Web's FieldRow: a muted label with its icon above the value on phones. */
function FieldRow({
  icon,
  label,
  children,
}: {
  icon: { ios: string; android: string };
  label: string;
  children: ReactNode;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        gap: 6,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderColor: t.border,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <SymbolView
          name={{ ...icon, web: icon.android } as never}
          size={12}
          tintColor={t.secondary}
        />
        <Copy size={14} bold muted>
          {label}
        </Copy>
      </View>
      {children}
    </View>
  );
}

function Account() {
  const t = useTheme();
  const auth = useAuth();
  const user = auth.session!.user;
  const r = useResource(`settings-profile:${user.id}`, (signal) =>
    profile(user.id, signal),
  );
  const data = r.data;
  const email = data?.email ?? user.email ?? "";
  const name = data?.full_name || email.split("@")[0] || "—";
  if (r.loading && !data)
    return (
      <View style={{ gap: 16 }}>
        <Glass clear style={{ padding: 24, alignItems: "center", gap: 12 }}>
          <Skeleton width={phone(80)} height={phone(80)} radius={phone(40)} />
          <Skeleton width="50%" />
          <Skeleton width="65%" />
        </Glass>
        <Glass clear style={{ padding: 16, gap: 16 }}>
          <Skeleton />
          <Skeleton />
          <Skeleton />
        </Glass>
      </View>
    );
  return (
    <View style={{ gap: 16 }}>
      {!!r.error && <Failure message={r.error} retry={r.refresh} />}
      {/* Profile: who is signed in, with the one action that changes it. */}
      <Glass clear style={{ padding: 24, alignItems: "center", gap: 6 }}>
        {data?.avatar_url ? (
          <Image
            source={{ uri: data.avatar_url }}
            accessibilityIgnoresInvertColors
            style={{
              width: phone(80),
              height: phone(80),
              borderRadius: phone(40),
            }}
          />
        ) : (
          <View
            style={{
              width: phone(80),
              height: phone(80),
              borderRadius: phone(40),
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: t.brand,
            }}
          >
            <Copy size={26} bold color={t.onBrand} localize={false}>
              {(email || "US").slice(0, 2).toUpperCase()}
            </Copy>
          </View>
        )}
        <View style={{ alignItems: "center", gap: 2, marginTop: 8 }}>
          <Copy size={20} bold lines={1} localize={false}>
            {name}
          </Copy>
          <Copy size={14} muted lines={1} localize={false}>
            {email || "—"}
          </Copy>
        </View>
        <View style={{ marginTop: 10 }}>
          <Button
            size="sm"
            icon={
              <SymbolView
                name={{ ios: "pencil", android: "edit", web: "edit" }}
                size={12}
                tintColor={t.text}
              />
            }
            onPress={() => router.push("/account")}
          >
            编辑资料
          </Button>
        </View>
      </Glass>
      {/* Details: label on the left, value on the right, like iOS Settings. */}
      <Glass clear style={{ paddingHorizontal: 16 }}>
        {(
          [
            [{ ios: "envelope", android: "mail" }, "邮箱地址", email || "—"],
            [
              { ios: "person", android: "person" },
              "姓名",
              data?.full_name || "—",
            ],
            [
              { ios: "phone", android: "phone" },
              "手机号码",
              data?.phone_e164 || "—",
            ],
          ] as const
        ).map(([icon, label, value], index) => (
          <View
            key={label}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              minHeight: 52,
              borderTopWidth: index ? 1 : 0,
              borderColor: t.border,
            }}
          >
            <SymbolView
              name={{ ...icon, web: icon.android } as never}
              size={15}
              tintColor={t.secondary}
            />
            <Copy size={15} muted>
              {label}
            </Copy>
            <View style={{ flex: 1, alignItems: "flex-end" }}>
              <Copy size={15} lines={1} selectable localize={false}>
                {value}
              </Copy>
            </View>
          </View>
        ))}
      </Glass>
      <Glass clear style={{ overflow: "hidden" }}>
        <Pressable
          accessibilityRole="button"
          onPress={() => void auth.signOut()}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            minHeight: 52,
            backgroundColor: pressed ? t.wash : "transparent",
          })}
        >
          <SymbolView
            name={{
              ios: "rectangle.portrait.and.arrow.right",
              android: "logout",
              web: "logout",
            }}
            size={16}
            tintColor={t.negative}
          />
          <Copy size={15} bold color={t.negative}>
            退出登录
          </Copy>
        </Pressable>
      </Glass>
    </View>
  );
}

function ProviderRow({
  provider,
  masked,
  user,
  onChanged,
  last,
}: {
  provider: string;
  masked?: string;
  user: string;
  onChanged: () => void;
  last: boolean;
}) {
  const t = useTheme();
  const text = useText();
  const info = PROVIDERS[provider] ?? {
    name: provider,
    description: "",
    placeholder: "",
    docsUrl: "",
  };
  const [value, setValue] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  async function run(kind: "save" | "delete") {
    setBusy(kind);
    setError(undefined);
    const controller = new AbortController();
    try {
      await apiRequest(
        kind === "save"
          ? "/user-api-keys"
          : `/user-api-keys/${encodeURIComponent(provider)}`,
        {
          method: kind === "save" ? "PUT" : "DELETE",
          ...(kind === "save"
            ? { body: { provider, api_key: value.trim() } }
            : {}),
          signal: controller.signal,
          authenticated: true,
          expectedUser: user,
        },
      );
      setValue("");
      setConfirming(false);
      onChanged();
    } catch {
      setError(kind === "save" ? "保存 API 密钥失败" : "删除 API 密钥失败");
    } finally {
      setBusy(null);
    }
  }
  const docs = safeExternal(info.docsUrl);
  return (
    <View
      style={{
        gap: 10,
        paddingVertical: 18,
        borderBottomWidth: last ? 0 : 1,
        borderColor: t.border,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Copy size={15} bold localize={false}>
              {info.name}
            </Copy>
            {!!masked && (
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 1,
                  borderRadius: 999,
                  backgroundColor: "rgba(34,197,94,0.12)",
                }}
              >
                <Copy size={11} bold color={t.accent}>
                  已配置
                </Copy>
              </View>
            )}
          </View>
          {!!info.description && (
            <Copy size={13} muted localize={false}>
              {info.description}
            </Copy>
          )}
        </View>
        {!!docs && (
          <Pressable
            accessibilityRole="link"
            hitSlop={10}
            onPress={() => void Linking.openURL(docs).catch(() => undefined)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              minHeight: 28,
            }}
          >
            <Copy size={13} bold muted>
              获取密钥
            </Copy>
            <SymbolView
              name={{
                ios: "arrow.up.right.square",
                android: "open_in_new",
                web: "open_in_new",
              }}
              size={11}
              tintColor={t.secondary}
            />
          </Pressable>
        )}
      </View>
      {!!masked && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Copy size={13} muted localize={false}>
            {`•••• ${masked.slice(-4)}`}
          </Copy>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              confirming ? "再点一次删除" : `删除 ${info.name}`
            }
            disabled={busy !== null}
            onPress={() =>
              confirming ? void run("delete") : setConfirming(true)
            }
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: confirming
                ? "rgba(239,68,68,0.15)"
                : "transparent",
              opacity: busy === "delete" ? 0.4 : 1,
            }}
          >
            <SymbolView
              name={{ ios: "trash", android: "delete", web: "delete" }}
              size={13}
              tintColor={confirming ? t.negative : t.secondary}
            />
          </Pressable>
        </View>
      )}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            minHeight: phone(44),
            borderRadius: phone(12),
            borderWidth: 1,
            borderColor: t.rim,
            backgroundColor: t.field,
            paddingLeft: 12,
          }}
        >
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder={masked ? text("替换为新密钥...") : info.placeholder}
            placeholderTextColor={t.secondary}
            accessibilityLabel={`${info.name} API key`}
            secureTextEntry={!visible}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={500}
            editable={busy === null}
            onSubmitEditing={() => value.trim() && void run("save")}
            style={{
              flex: 1,
              fontSize: phone(16),
              color: t.text,
              paddingVertical: 8,
            }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={visible ? "隐藏密钥" : "显示密钥"}
            onPress={() => setVisible((v) => !v)}
            style={{
              width: 40,
              height: 40,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <SymbolView
              name={{
                ios: visible ? "eye.slash" : "eye",
                android: "visibility",
                web: "visibility",
              }}
              size={14}
              tintColor={t.secondary}
            />
          </Pressable>
        </View>
        <Button
          selected={!!value.trim()}
          disabled={!value.trim() || busy !== null}
          onPress={() => void run("save")}
        >
          {busy === "save" ? "保存中…" : "保存"}
        </Button>
      </View>
      {!!error && (
        <Copy size={12} color={t.negative}>
          {error}
        </Copy>
      )}
    </View>
  );
}

function ApiKeys() {
  const user = useAuth().session!.user.id;
  const r = useResource(`settings-keys:${user}`, (signal) =>
    apiRequest<{
      keys: { provider: string; api_key_masked: string }[];
      supported_providers: string[];
    }>("/user-api-keys", { signal, authenticated: true, expectedUser: user }),
  );
  const providers = r.data?.supported_providers.length
    ? r.data.supported_providers
    : Object.keys(PROVIDERS);
  return (
    <SettingsSection title="API 密钥">
      {r.loading && !r.data ? (
        <View style={{ gap: 16, paddingVertical: 16 }}>
          <FormSkeleton fields={3} />
        </View>
      ) : (
        <>
          {!!r.error && <Failure message={r.error} retry={r.refresh} />}
          <Glass
            style={{
              paddingHorizontal: 14,
              paddingVertical: 12,
              marginTop: 14,
            }}
          >
            <Copy size={13} muted>
              您的 API
              密钥已安全存储并加密保存。仅在您发送消息时使用——如果设置了某个提供商的密钥，将使用它替代默认服务器密钥。
            </Copy>
          </Glass>
          {providers.map((provider, index) => (
            <ProviderRow
              key={provider}
              provider={provider}
              user={user}
              masked={
                r.data?.keys.find((k) => k.provider === provider)
                  ?.api_key_masked
              }
              onChanged={r.refresh}
              last={index === providers.length - 1}
            />
          ))}
        </>
      )}
    </SettingsSection>
  );
}

function Preferences() {
  const p = usePreferences();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  async function save(next: Parameters<typeof p.save>[0]) {
    setBusy(true);
    setError(undefined);
    try {
      await p.save(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新失败，请重试。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <SettingsSection title="显示偏好">
      <FieldRow icon={{ ios: "globe", android: "language" }} label="语言">
        <Filters
          size="sm"
          disabled={busy}
          values={[
            ["zh", "简体中文"],
            ["en", "English"],
          ]}
          value={p.locale}
          onChange={(v) => void save({ locale: v as "zh" | "en" })}
        />
      </FieldRow>
      <FieldRow
        icon={{ ios: "circle.lefthalf.filled", android: "contrast" }}
        label="主题"
      >
        <Filters
          size="sm"
          disabled={busy}
          values={[
            ["LIGHT", "浅色"],
            ["DARK", "深色"],
            ["SYSTEM", "跟随系统"],
          ]}
          value={p.theme}
          onChange={(v) => void save({ theme: v as Appearance })}
        />
      </FieldRow>
      {!!(error || p.error) && <Failure message={error || p.error!} />}
    </SettingsSection>
  );
}

export default function Settings() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const initial = TABS.some(([key]) => key === params.tab)
    ? params.tab!
    : "account";
  // A new ?tab= link remounts the page on that tab.
  return <SettingsTabs key={initial} initial={initial} />;
}

function SettingsTabs({ initial }: { initial: string }) {
  const [tab, setTab] = useState(initial);
  return (
    <Page
      title="设置"
      hideTitle
      floatingHeader={<Filters values={TABS} value={tab} onChange={setTab} />}
    >
      {tab === "preferences" ? (
        <Preferences />
      ) : (
        <AuthGate inline title="设置" skeleton={<FormSkeleton fields={3} />}>
          {tab === "account" ? <Account /> : <ApiKeys />}
        </AuthGate>
      )}
    </Page>
  );
}
