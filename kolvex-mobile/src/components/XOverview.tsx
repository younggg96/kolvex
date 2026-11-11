// The Web's X opinions page (components/x/XContentExplorer + XCreatorSummaries) at phone
// size: creators with their AI briefs, then the original posts as one list card.
import { useState } from "react";
import { Image, Linking, Pressable, View } from "react-native";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { apiRequest } from "../lib/http";
import { safeExternal } from "../lib/links";
import { useTheme } from "../lib/theme";
import { useResource } from "../lib/useResource";
import { usePreferences } from "../state/Preferences";
import { CompanyLogo } from "./CompanyLogo";
import { Field, Pager } from "./Content";
import { TranslatableText } from "./Translate";
import { Button, Chip, Copy, Failure, Glass, Skeleton, styles } from "./UI";

type Creator = {
  username: string;
  display_name: string;
  avatar_url?: string | null;
};
type Brief = { headline: string; basis: string; risks: string };
type Summary = {
  username: string;
  coverage_start: string;
  coverage_end: string;
  content: { zh: Brief; en?: Brief };
  sources: { id: string; url: string }[];
};
type Post = {
  id: string;
  author_username: string;
  creator?: { display_name?: string; avatar_url?: string | null } | null;
  published_at: string;
  text: string;
  quoted_texts?: string[];
  truncated?: boolean;
  cashtags: string[];
  url: string;
  metrics: Record<string, number | null | undefined>;
};
const METRICS: [string, string][] = [
  ["replies", "回复"],
  ["reposts", "转发"],
  ["likes", "点赞"],
  ["bookmarks", "收藏"],
  ["views", "浏览"],
];
const ALL_CREATORS = "全部博主";
const TICKER = /^[A-Za-z][A-Za-z0-9.\-]{0,9}$/;

function Avatar({ uri, name }: { uri?: string | null; name: string }) {
  const t = useTheme();
  return uri ? (
    <Image
      source={{ uri }}
      style={{ width: 32, height: 32, borderRadius: 16 }}
    />
  ) : (
    <View
      style={{
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: t.wash,
      }}
    >
      <Copy size={12} bold localize={false}>
        {name.replace(/^@/, "").slice(0, 1).toUpperCase()}
      </Copy>
    </View>
  );
}
function OpenLink({ url, label }: { url: string; label: string }) {
  const t = useTheme();
  const safe = safeExternal(url);
  if (!safe) return null;
  return (
    <Pressable
      accessibilityRole="link"
      hitSlop={8}
      onPress={() => void Linking.openURL(safe).catch(() => {})}
      style={{ flexDirection: "row", alignItems: "center", gap: 3 }}
    >
      <Copy size={12}>{label}</Copy>
      <SymbolView
        name={{
          ios: "arrow.up.right",
          android: "open_in_new",
          web: "open_in_new",
        }}
        size={10}
        tintColor={t.text}
      />
    </Pressable>
  );
}

export function XOverview({ revision }: { revision: number }) {
  const [author, setAuthor] = useState("");
  return (
    <>
      <View style={{ gap: 6 }}>
        <Copy size={24} bold>
          X 博主观点
        </Copy>
        <Copy size={14} muted>
          了解博主在关注什么，并查看观点背后的原帖。
        </Copy>
      </View>
      <Creators revision={revision} author={author} onAuthor={setAuthor} />
      <Posts key={author} revision={revision} author={author} />
    </>
  );
}

function Creators({
  revision,
  author,
  onAuthor,
}: {
  revision: number;
  author: string;
  onAuthor: (username: string) => void;
}) {
  const t = useTheme();
  const { locale } = usePreferences();
  const creators = useResource(`x-overview-creators:${revision}`, (signal) =>
    apiRequest<{ creators: Creator[] }>("/x-content/creators", { signal }),
  );
  const briefs = useResource(`x-overview-summaries:${revision}`, (signal) =>
    apiRequest<{ generated_at: string; summaries: Summary[] }>(
      "/x-content/summaries",
      { signal, timeout: 35_000 },
    ),
  );
  const [open, setOpen] = useState<string | null>(null);
  const summaries = new Map(
    (briefs.data?.summaries ?? []).map((s) => [s.username, s]),
  );
  const entries = new Map<string, Creator | undefined>(
    (creators.data?.creators ?? []).map((c) => [c.username, c]),
  );
  for (const username of summaries.keys())
    if (!entries.has(username)) entries.set(username, undefined);
  const date = (iso: string) =>
    new Date(iso).toLocaleDateString(locale === "en" ? "en-US" : "zh-CN", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 4 }}>
        <View style={[styles.row, { alignItems: "baseline" }]}>
          <Copy size={20} bold>
            博主与 AI 分析
          </Copy>
          {!!briefs.data?.generated_at && (
            <Copy
              size={12}
              muted
            >{`生成于 ${date(briefs.data.generated_at)}`}</Copy>
          )}
        </View>
        <Copy size={13} muted>
          AI 按博主归纳部分已收录的推文。每条摘要都标注了覆盖日期和依据原帖。
        </Copy>
      </View>
      <Glass style={{ paddingHorizontal: 12, paddingVertical: 10, gap: 4 }}>
        <View style={{ alignSelf: "flex-start" }}>
          <Chip selected={!author} onPress={() => onAuthor("")}>
            {ALL_CREATORS}
          </Chip>
        </View>
        {!!creators.error && !creators.data && (
          <Failure message="暂时无法加载博主列表。" retry={creators.refresh} />
        )}
        {briefs.loading && !briefs.data && (
          <Copy size={12} muted>
            正在加载 AI 分析…
          </Copy>
        )}
        {!!briefs.error && !briefs.data && (
          <Failure message="暂时无法加载 AI 分析。" retry={briefs.refresh} />
        )}
        {[...entries].map(([username, creator], index) => {
          const summary = summaries.get(username);
          const content = summary
            ? (locale === "en" && summary.content.en) || summary.content.zh
            : null;
          const active = author === username;
          const name = creator?.display_name || `@${username}`;
          return (
            <View
              key={username}
              style={{
                paddingVertical: 6,
                borderTopWidth: index ? 1 : 0,
                borderColor: t.border,
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => onAuthor(active ? "" : username)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  minHeight: 44,
                  padding: 6,
                  borderRadius: 12,
                  backgroundColor: active || pressed ? t.wash : "transparent",
                })}
              >
                <Avatar uri={creator?.avatar_url} name={name} />
                <View style={{ flex: 1 }}>
                  <Copy size={14} bold localize={false}>
                    {name}
                  </Copy>
                  <Copy size={12} muted localize={false}>
                    {`@${username}`}
                  </Copy>
                </View>
                {active && (
                  <Copy size={12} muted>
                    已筛选
                  </Copy>
                )}
              </Pressable>
              {!!summary && !!content && (
                <>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: open === username }}
                    onPress={() => setOpen(open === username ? null : username)}
                    style={{
                      flexDirection: "row",
                      gap: 8,
                      paddingHorizontal: 6,
                      paddingVertical: 8,
                    }}
                  >
                    <View
                      style={{
                        flex: 1,
                        flexDirection: "row",
                        flexWrap: "wrap",
                      }}
                    >
                      <Copy size={12} bold muted>
                        AI 分析
                      </Copy>
                      <Copy size={14} localize={false}>
                        {`  ${content.headline}`}
                      </Copy>
                    </View>
                    <SymbolView
                      name={{
                        ios: open === username ? "chevron.up" : "chevron.down",
                        android: "expand_more",
                        web: "expand_more",
                      }}
                      size={12}
                      tintColor={t.secondary}
                    />
                  </Pressable>
                  {open === username && (
                    <View
                      style={{
                        gap: 12,
                        paddingHorizontal: 6,
                        paddingBottom: 10,
                      }}
                    >
                      <Copy size={12} muted localize={false}>
                        {`${date(summary.coverage_start)}${summary.coverage_start !== summary.coverage_end ? ` – ${date(summary.coverage_end)}` : ""}`}
                      </Copy>
                      <View style={{ gap: 4 }}>
                        <Copy size={14} bold>
                          观点依据
                        </Copy>
                        <Copy size={14} muted localize={false} selectable>
                          {content.basis}
                        </Copy>
                      </View>
                      <View style={{ gap: 4 }}>
                        <Copy size={14} bold>
                          风险与限制
                        </Copy>
                        <Copy size={14} muted localize={false} selectable>
                          {content.risks}
                        </Copy>
                      </View>
                      <View style={{ gap: 6 }}>
                        <Copy size={14} bold>
                          依据原帖
                        </Copy>
                        <View
                          style={{
                            flexDirection: "row",
                            flexWrap: "wrap",
                            gap: 12,
                          }}
                        >
                          {summary.sources.map((source, i) => (
                            <OpenLink
                              key={source.id}
                              url={source.url}
                              label={`#${i + 1}`}
                            />
                          ))}
                        </View>
                      </View>
                    </View>
                  )}
                </>
              )}
            </View>
          );
        })}
      </Glass>
    </View>
  );
}

function Posts({ revision, author }: { revision: number; author: string }) {
  const t = useTheme();
  const { locale } = usePreferences();
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState("");
  const [ticker, setTicker] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [reload, setReload] = useState(0);
  const r = useResource(
    `x-overview-posts:${revision}:${reload}:${author}:${ticker}:${page}`,
    (signal) => {
      const query = new URLSearchParams({
        limit: "20",
        offset: String((page - 1) * 20),
      });
      if (author) query.set("author", author);
      if (ticker) query.set("ticker", ticker);
      return apiRequest<{ posts: Post[]; total: number }>(
        `/x-content/posts?${query}`,
        { signal, timeout: 35_000 },
      );
    },
  );
  const apply = () => {
    const value = draft.trim().replace(/^\$/, "");
    if (value && !TICKER.test(value)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setTicker(value.toUpperCase());
    setPage(1);
  };
  const format = new Intl.NumberFormat(locale === "en" ? "en-US" : "zh-CN");
  const when = (iso: string) =>
    new Date(iso).toLocaleString(locale === "en" ? "en-US" : "zh-CN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  const posts = r.data?.posts ?? [];
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.row}>
        <Copy size={20} bold>
          原始推文
        </Copy>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="刷新推文"
          disabled={r.loading}
          onPress={() => setReload((v) => v + 1)}
          hitSlop={8}
          style={{
            width: 38,
            height: 38,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <SymbolView
            name={{
              ios: "arrow.clockwise",
              android: "refresh",
              web: "refresh",
            }}
            size={16}
            tintColor={t.secondary}
          />
        </Pressable>
      </View>
      <Glass style={{ paddingHorizontal: 14, paddingVertical: 12, gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Field
              label="股票代码"
              placeholder="股票代码，例如 NVDA"
              value={draft}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={apply}
              error={invalid ? "请输入有效的股票代码。" : undefined}
              onChangeText={(value) => {
                setDraft(value);
                setInvalid(false);
                if (!value.trim() && ticker) {
                  setTicker("");
                  setPage(1);
                }
              }}
            />
          </View>
          <Button onPress={apply}>搜索</Button>
        </View>
        {r.loading && !r.data ? (
          <View style={{ gap: 12, paddingVertical: 8 }}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={60} />
            ))}
          </View>
        ) : r.error && !r.data ? (
          <Failure message="暂时无法加载推文。" retry={r.refresh} />
        ) : !posts.length ? (
          <Copy size={14} muted>
            {ticker || author ? "没有符合筛选条件的推文。" : "此页暂无推文。"}
          </Copy>
        ) : (
          posts.map((post, index) => {
            const name = post.creator?.display_name || post.author_username;
            return (
              <View
                key={post.id}
                style={{
                  gap: 12,
                  paddingVertical: 14,
                  borderTopWidth: index ? 1 : 0,
                  borderColor: t.border,
                }}
              >
                <View style={[styles.row, { alignItems: "flex-start" }]}>
                  <View style={{ flex: 1, flexDirection: "row", gap: 10 }}>
                    <Avatar uri={post.creator?.avatar_url} name={name} />
                    <View style={{ flex: 1 }}>
                      <Copy size={14} bold localize={false}>
                        {name}
                      </Copy>
                      <Copy size={12} muted localize={false}>
                        {`@${post.author_username} · ${when(post.published_at)}`}
                      </Copy>
                    </View>
                  </View>
                  <OpenLink url={post.url} label="查看原帖" />
                </View>
                <TranslatableText text={post.text} size={15} />
                {post.quoted_texts?.map((text, i) => (
                  <TranslatableText key={i} text={text} size={14} muted />
                ))}
                {post.truncated && (
                  <Copy size={12} muted>
                    正文不完整，请前往 X 阅读全文。
                  </Copy>
                )}
                {post.cashtags.length > 0 && (
                  <View
                    style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                  >
                    {post.cashtags.map((tag) => (
                      <Pressable
                        key={tag}
                        accessibilityRole="button"
                        accessibilityLabel={`打开 ${tag} 行情`}
                        onPress={() =>
                          router.push(`/stock/${encodeURIComponent(tag)}`)
                        }
                        style={({ pressed }) => ({
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                          paddingLeft: 4,
                          paddingRight: 10,
                          paddingVertical: 4,
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: t.rim,
                          backgroundColor: pressed ? t.wash : "transparent",
                        })}
                      >
                        <CompanyLogo symbol={tag} size={20} />
                        <Copy size={12} bold localize={false}>
                          {tag}
                        </Copy>
                      </Pressable>
                    ))}
                  </View>
                )}
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}
                >
                  {METRICS.map(([key, label]) =>
                    post.metrics?.[key] != null ? (
                      <View key={key} style={{ flexDirection: "row", gap: 4 }}>
                        <Copy size={12} muted>
                          {label}
                        </Copy>
                        <Copy size={12} muted localize={false}>
                          {format.format(post.metrics[key]!)}
                        </Copy>
                      </View>
                    ) : null,
                  )}
                </View>
              </View>
            );
          })
        )}
        {(page > 1 || page * 20 < (r.data?.total ?? 0)) && (
          <Pager
            page={page}
            hasMore={page * 20 < (r.data?.total ?? 0)}
            loading={r.loading}
            onChange={setPage}
          />
        )}
      </Glass>
    </View>
  );
}
