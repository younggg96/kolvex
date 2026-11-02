import { usePreferences } from "../state/Preferences";
import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type PropsWithChildren,
} from "react";
import {
  Image,
  Linking,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { apiURL } from "../lib/config";
import { useAuth } from "../state/Auth";
import { useText } from "../lib/i18n";
import { useTheme } from "../lib/theme";
import { Button, Copy, Empty, Failure, Glass, Page, Skeleton } from "./UI";
import { safeExternal } from "../lib/links";

export function AuthGate({
  title,
  children,
  inline = false,
}: PropsWithChildren<{ title: string; inline?: boolean }>) {
  const auth = useAuth();
  let boundary: React.ReactNode;
  if (!auth.ready) boundary = <Skeleton />;
  else if (!auth.session)
    boundary = (
      <>
        <Empty
          title="登录后继续"
          message="使用现有 Kolvex 账户，读取与你网页端相同的内容。"
        />
        <Button onPress={() => router.push("/account")}>登录账户</Button>
      </>
    );
  else if (!apiURL)
    boundary = (
      <Empty
        title="尚未连接后端"
        message="请配置 API 地址后重新启动应用。此页面不会使用演示数据替代你的账户内容。"
      />
    );
  else
    return (
      <View
        key={auth.session.user.id}
        style={inline ? { gap: 16 } : { flex: 1 }}
      >
        {children}
      </View>
    );
  return inline ? (
    <View style={{ gap: 16 }}>{boundary}</View>
  ) : (
    <Page title={title}>{boundary}</Page>
  );
}
export function Field({
  label,
  error,
  ...props
}: ComponentProps<typeof TextInput> & { label: string; error?: string }) {
  const t = useTheme();
  const text = useText();
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);
  useEffect(() => {
    if (error) input.current?.focus();
  }, [error]);
  return (
    <View style={{ gap: 8 }}>
      <Copy size={14} bold>
        {label}
      </Copy>
      <Glass style={{ paddingHorizontal: 16 }}>
        <TextInput
          ref={input}
          accessibilityLabel={text(label)}
          accessibilityHint={error ? text(error) : undefined}
          placeholderTextColor={t.secondary}
          {...props}
          style={[
            { minHeight: 48, color: t.text, fontSize: 16, paddingVertical: 12 },
            props.style,
          ]}
        />
      </Glass>
      {error && <Failure message={error} />}
    </View>
  );
}
export function SourceLink({
  url,
  children,
}: PropsWithChildren<{ url: string }>) {
  const [error, setError] = useState<string>();
  const safe = safeExternal(url);
  if (!safe)
    return (
      <Copy size={12} muted>
        来源链接不可用
      </Copy>
    );
  return (
    <View style={{ gap: 8 }}>
      <Button
        onPress={() => {
          void Linking.openURL(safe).catch(() =>
            setError("无法打开链接，请稍后重试。"),
          );
        }}
      >
        {children ?? "查看来源 ↗"}
      </Button>
      {error && <Failure message={error} />}
    </View>
  );
}
export function Filters({
  values,
  value,
  onChange,
  disabled = false,
}: {
  values: readonly (readonly [string, string])[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
    >
      {values.map(([key, name]) => (
        <Button
          key={key}
          disabled={disabled}
          selected={key === value}
          onPress={() => onChange(key)}
        >
          {name}
        </Button>
      ))}
    </ScrollView>
  );
}
export function Pager({
  page,
  hasMore,
  loading,
  onChange,
}: {
  page: number;
  hasMore: boolean;
  loading: boolean;
  onChange: (v: number) => void;
}) {
  const { locale } = usePreferences();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
      }}
    >
      <Button
        disabled={page === 1 || loading}
        onPress={() => onChange(page - 1)}
      >
        上一页
      </Button>
      <Copy size={12} muted>
        {locale === "en" ? `Page ${page}` : <>第 {page} 页</>}
      </Copy>
      <Button disabled={!hasMore || loading} onPress={() => onChange(page + 1)}>
        下一页
      </Button>
    </View>
  );
}
export function ResourceState({
  resource,
  empty,
  message,
}: {
  resource: {
    loading: boolean;
    data?: unknown;
    error?: string;
    refresh: () => void;
  };
  empty: boolean;
  message: string;
}) {
  return (
    <>
      {resource.error && (
        <Failure message={resource.error} retry={resource.refresh} />
      )}
      {resource.error?.includes("登录") && (
        <Button onPress={() => router.push("/account")}>管理登录</Button>
      )}
      {resource.loading && !resource.data ? (
        <Skeleton />
      ) : !resource.error && empty ? (
        <Empty title="暂无内容" message={message} />
      ) : null}
    </>
  );
}
// Render native text, never execute report HTML or inject it into a WebView.
export function TextBody({ text }: { text: string }) {
  const theme = useTheme();
  const [linkError, setLinkError] = useState(false);
  const inline = (value: string) =>
    value
      .split(/(\*\*[^*]+\*\*|\[[^\]]+\]\(https:\/\/[^)\s]+\))/g)
      .map((part, index) => {
        if (part.startsWith("**") && part.endsWith("**"))
          return (
            <Text key={index} style={{ fontWeight: "600" }}>
              {part.slice(2, -2)}
            </Text>
          );
        const link = /^\[([^\]]+)\]\((https:\/\/[^)\s]+)\)$/.exec(part);
        const url = link && safeExternal(link[2]);
        if (link && url)
          return (
            <Text
              key={index}
              accessibilityRole="link"
              style={{ color: theme.accent, textDecorationLine: "underline" }}
              onPress={() => {
                void Linking.openURL(url).catch(() => setLinkError(true));
              }}
            >
              {link[1]}
            </Text>
          );
        return part;
      });
  return (
    <View style={{ gap: 12 }}>
      {text
        .split(/\n\s*\n/)
        .filter(Boolean)
        .map((part, i) => {
          const heading = /^#{1,6}\s/.test(part);
          return (
            <Copy key={i} selectable bold={heading} size={heading ? 20 : 16}>
              {inline(part.replace(/^#{1,6}\s/, ""))}
            </Copy>
          );
        })}
      {linkError && <Failure message="无法打开来源链接，请稍后重试。" />}
    </View>
  );
}
export function EditorialImage({
  image,
}: {
  image: { url: string; caption: string; credit: string; source_page: string };
}) {
  const [failed, setFailed] = useState(false);
  const url = safeExternal(image.url);
  if (!url || failed)
    return (
      <Copy size={12} muted>
        {image.caption || "图片暂不可用"}
      </Copy>
    );
  return (
    <View style={{ gap: 8 }}>
      <Image
        source={{ uri: url }}
        accessibilityLabel={image.caption || "日报配图"}
        style={{ width: "100%", aspectRatio: 16 / 9, borderRadius: 16 }}
        resizeMode="cover"
        onError={() => setFailed(true)}
      />
      <Copy size={12} muted>
        {image.caption}
        {image.credit ? ` · ${image.credit}` : ""}
      </Copy>
      {image.source_page && (
        <SourceLink url={image.source_page}>图片来源 ↗</SourceLink>
      )}
    </View>
  );
}
