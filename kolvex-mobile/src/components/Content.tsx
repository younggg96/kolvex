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
import { GlassView } from "expo-glass-effect";
import { useText } from "../lib/i18n";
import { useTheme } from "../lib/theme";
import {
  Button,
  Chip,
  Copy,
  Empty,
  Failure,
  Page,
  LoadingStatus,
  useLiquidGlass,
} from "./UI";
import { textBlocks } from "../lib/markdownBlocks";
import { safeExternal } from "../lib/links";

export function AuthGate({
  title,
  children,
  inline = false,
  skeleton,
}: PropsWithChildren<{
  title: string;
  inline?: boolean;
  skeleton: React.ReactNode;
}>) {
  const auth = useAuth();
  let boundary: React.ReactNode;
  if (!auth.ready) boundary = <LoadingStatus>{skeleton}</LoadingStatus>;
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
  const glass = useLiquidGlass();
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
      <GlassView
        glassEffectStyle={glass ? "regular" : "none"}
        colorScheme={t.dark ? "dark" : "light"}
        style={{
          paddingHorizontal: 16,
          borderRadius: props.multiline ? 24 : 999,
          borderWidth: glass && !error ? 0 : 1,
          borderColor: error ? t.negative : t.rim,
          backgroundColor: glass ? undefined : t.field,
        }}
      >
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
      </GlassView>
      {!!error && <Failure message={error} />}
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
      {!!error && <Failure message={error} />}
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
  const t = useTheme();
  const glass = useLiquidGlass();
  return (
    <GlassView
      glassEffectStyle={glass ? "regular" : "none"}
      colorScheme={t.dark ? "dark" : "light"}
      style={{
        alignSelf: "flex-start",
        maxWidth: "100%",
        borderRadius: 999,
        borderWidth: glass ? 0 : 1,
        borderColor: t.rim,
        backgroundColor: glass ? undefined : t.field,
        overflow: "hidden",
      }}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ gap: 4, padding: 4 }}
      >
        {values.map(([key, name]) => (
          <Chip
            bare
            key={key}
            disabled={disabled}
            selected={key === value}
            onPress={() => onChange(key)}
          >
            {name}
          </Chip>
        ))}
      </ScrollView>
    </GlassView>
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
  skeleton,
}: {
  resource: {
    loading: boolean;
    data?: unknown;
    error?: string;
    refresh: () => void;
  };
  empty: boolean;
  message: string;
  /** Placeholder in the shape of the content this state stands in for. */
  skeleton: React.ReactNode;
}) {
  return (
    <>
      {!!resource.error && (
        <Failure message={resource.error} retry={resource.refresh} />
      )}
      {resource.error?.includes("登录") && (
        <Button onPress={() => router.push("/account")}>管理登录</Button>
      )}
      {resource.loading && !resource.data ? (
        <LoadingStatus>{skeleton}</LoadingStatus>
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
      {textBlocks(text).map((block, i) =>
        block.kind === "rule" ? (
          <View key={i} style={{ height: 1, backgroundColor: theme.border }} />
        ) : block.kind === "bullet" ? (
          <View key={i} style={{ flexDirection: "row", gap: 8 }}>
            <Copy localize={false}>•</Copy>
            <View style={{ flex: 1 }}>
              <Copy selectable>{inline(block.text)}</Copy>
            </View>
          </View>
        ) : (
          <Copy
            key={i}
            selectable
            bold={block.kind === "heading"}
            size={block.kind === "heading" ? 20 : 16}
          >
            {inline(block.text)}
          </Copy>
        ),
      )}
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
