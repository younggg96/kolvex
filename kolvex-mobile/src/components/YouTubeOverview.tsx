// The Web's YouTube opinions overview (YouTubeOpinionExplorer, phone layout): the stock
// or creator directory in one list card, each creator's latest video, and recent shifts.
import { useState } from "react";
import { Image, Pressable, View } from "react-native";
import { router } from "expo-router";
import { apiRequest } from "../lib/http";
import { opinionDay } from "../lib/opinionDates";
import { useTheme } from "../lib/theme";
import { useResource } from "../lib/useResource";
import { usePreferences } from "../state/Preferences";
import { CompanyLogo } from "./CompanyLogo";
import { Filters } from "./Content";
import { OpinionStrength } from "./OpinionStrength";
import { Copy, Glass, Skeleton, styles } from "./UI";

type Stock = {
  ticker: string;
  company_name?: string;
  total_opinions: number;
  creator_count: number;
  avg_score: number;
};
type Creator = {
  channel_id: string;
  channel_title?: string;
  channel_handle?: string;
  channel_avatar_url?: string;
  total_opinions: number;
  avg_score: number;
  latest_opinion_at?: string;
};
type VideoOpinion = {
  id: string;
  ticker: string;
  sentiment: string;
  channel_id?: string;
  channel_title?: string;
};
type VideoGroup = {
  videoId: string;
  video: {
    video_title?: string;
    video_url?: string;
    thumbnail_url?: string;
    video_published_at?: string;
    opinion_date?: string;
  };
  opinions: VideoOpinion[];
};
type Change = {
  ticker: string;
  current_date: string;
  change?: number;
};
type Catalogue = {
  summary: {
    total_stocks: number;
    total_creators: number;
    total_opinions: number;
  };
  stocks: Stock[];
  creators: Creator[];
  changes: Change[];
  latest_videos?: VideoGroup[];
};
type Performance = Record<
  string,
  { price: number; change_1d_percent: number | null }
>;
const PREVIEW = 10;

export function YouTubeOverview({ revision }: { revision: number }) {
  const t = useTheme();
  const [view, setView] = useState("stocks");
  const r = useResource(`youtube-overview:${revision}`, (signal) =>
    apiRequest<Catalogue>("/youtube-opinions/dashboard?limit=20", {
      signal,
      timeout: 40_000,
    }),
  );
  const data = r.data;
  const stocks = [...(data?.stocks ?? [])]
    .sort((a, b) => b.total_opinions - a.total_opinions)
    .slice(0, PREVIEW);
  const tickers = stocks.map((s) => s.ticker).join(",");
  const perf = useResource(
    `youtube-overview-perf:${tickers}:${revision}`,
    (signal) =>
      tickers
        ? apiRequest<{ stocks: Performance }>(
            `/market/performance?symbols=${encodeURIComponent(tickers)}`,
            { signal, timeout: 30_000 },
          ).then((x) => x.stocks)
        : Promise.resolve({} as Performance),
  );
  const creators = [...(data?.creators ?? [])].sort((a, b) =>
    (b.latest_opinion_at ?? "").localeCompare(a.latest_opinion_at ?? ""),
  );
  return (
    <>
      <View style={{ gap: 12 }}>
        <View style={[styles.row, { alignItems: "flex-start" }]}>
          <View style={{ flex: 1, gap: 4 }}>
            <Copy size={20} bold>
              {view === "stocks" ? "YouTube 观点" : "追踪的博主"}
            </Copy>
            {!!data && (
              <Copy size={12} muted>
                {`${data.summary.total_stocks} 只股票，${data.summary.total_creators} 位博主，${data.summary.total_opinions} 条观点`}
              </Copy>
            )}
          </View>
          <Filters
            values={[
              ["stocks", "按股票"],
              ["creators", "按博主"],
            ]}
            value={view}
            onChange={setView}
          />
        </View>
        <Glass style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
          {r.loading && !data ? (
            <View style={{ gap: 14, paddingVertical: 12 }}>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} height={32} />
              ))}
            </View>
          ) : r.error && !data ? (
            <Copy size={14}>观点目录加载失败，请检查网络后重试。</Copy>
          ) : view === "stocks" ? (
            <>
              {stocks.map((stock, index) => {
                const p = perf.data?.[stock.ticker];
                return (
                  <Row
                    key={stock.ticker}
                    first={index === 0}
                    onPress={() =>
                      router.push(`/stock/${encodeURIComponent(stock.ticker)}`)
                    }
                  >
                    <CompanyLogo symbol={stock.ticker} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Copy size={15} bold localize={false}>
                        {stock.ticker}
                      </Copy>
                      <Copy size={13} muted lines={1} localize={false}>
                        {stock.company_name || stock.ticker}
                      </Copy>
                    </View>
                    <View style={{ alignItems: "flex-end", minWidth: 64 }}>
                      {p ? (
                        <>
                          <Copy size={14} bold localize={false}>
                            {`$${p.price.toFixed(2)}`}
                          </Copy>
                          <Copy
                            size={12}
                            bold
                            localize={false}
                            color={
                              (p.change_1d_percent ?? 0) < 0
                                ? t.negative
                                : t.accent
                            }
                          >
                            {p.change_1d_percent == null
                              ? "—"
                              : `${p.change_1d_percent > 0 ? "+" : ""}${p.change_1d_percent.toFixed(2)}%`}
                          </Copy>
                        </>
                      ) : perf.loading ? (
                        <Skeleton width={56} height={14} />
                      ) : (
                        <Copy size={12} muted localize={false}>
                          —
                        </Copy>
                      )}
                    </View>
                    <View
                      style={{ alignItems: "flex-end", gap: 2, minWidth: 72 }}
                    >
                      <OpinionStrength value={stock.avg_score} />
                      <Copy
                        size={12}
                        muted
                      >{`${stock.creator_count} 位博主`}</Copy>
                    </View>
                  </Row>
                );
              })}
              <Footer
                label={`查看全部股票 · ${stocks.length}/${data?.summary.total_stocks ?? 0}`}
                onPress={() => router.push("/creators?tab=stocks")}
              />
            </>
          ) : (
            creators.map((creator, index) => (
              <Row
                key={creator.channel_id}
                first={index === 0}
                onPress={() =>
                  router.push(
                    `/creator/youtube/${encodeURIComponent(creator.channel_id)}`,
                  )
                }
              >
                <Avatar uri={creator.channel_avatar_url} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Copy size={15} bold lines={1} localize={false}>
                    {creator.channel_title || creator.channel_id}
                  </Copy>
                  <Copy size={13} muted lines={1} localize={false}>
                    {creator.channel_handle || creator.channel_id}
                  </Copy>
                </View>
                <View style={{ alignItems: "flex-end", gap: 2 }}>
                  <OpinionStrength value={creator.avg_score} />
                  <Copy
                    size={12}
                    muted
                  >{`${creator.total_opinions} 条观点`}</Copy>
                </View>
              </Row>
            ))
          )}
        </Glass>
      </View>
      {view === "stocks" && !!data?.latest_videos?.length && (
        <LatestVideos groups={data.latest_videos} creators={data.creators} />
      )}
      {!!data?.changes.length && (
        <Shifts changes={data.changes} stocks={data.stocks} />
      )}
    </>
  );
}

function Row({
  children,
  first,
  onPress,
}: {
  children: React.ReactNode;
  first: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        minHeight: 56,
        paddingVertical: 8,
        borderTopWidth: first ? 0 : 1,
        borderColor: t.border,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      {children}
    </Pressable>
  );
}
function Footer({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        alignItems: "center",
        justifyContent: "center",
        borderTopWidth: 1,
        borderColor: t.border,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Copy size={13} bold muted>
        {label}
      </Copy>
    </Pressable>
  );
}
function Avatar({ uri, size = 32 }: { uri?: string; size?: number }) {
  const t = useTheme();
  return uri ? (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
    />
  ) : (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: t.wash,
      }}
    />
  );
}

/** The Web's "Latest creator videos": each creator's newest video with its stock calls. */
function LatestVideos({
  groups,
  creators,
}: {
  groups: VideoGroup[];
  creators: Creator[];
}) {
  const t = useTheme();
  const { locale } = usePreferences();
  const byId = new Map(creators.map((c) => [c.channel_id, c]));
  const tone = (sentiment: string) =>
    sentiment === "bullish"
      ? t.accent
      : sentiment === "bearish"
        ? t.negative
        : t.secondary;
  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Copy size={20} bold>
            博主最新视频
          </Copy>
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 999,
              backgroundColor: t.wash,
            }}
          >
            <Copy size={12} muted localize={false}>
              {String(groups.length)}
            </Copy>
          </View>
        </View>
        <Copy size={12} muted>
          每位博主仅展示最新一期，合并同视频内的股票观点
        </Copy>
      </View>
      <Glass style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
        {groups.map((group, index) => {
          const channel = group.opinions[0]?.channel_id;
          const creator = channel ? byId.get(channel) : undefined;
          const day = opinionDay(
            group.video.video_published_at || group.video.opinion_date,
          );
          return (
            <Pressable
              key={group.videoId}
              accessibilityRole="button"
              onPress={() =>
                channel &&
                router.push(`/creator/youtube/${encodeURIComponent(channel)}`)
              }
              style={({ pressed }) => ({
                gap: 8,
                paddingVertical: 12,
                borderTopWidth: index ? 1 : 0,
                borderColor: t.border,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <Avatar uri={creator?.channel_avatar_url} size={24} />
                <View style={{ flex: 1 }}>
                  <Copy size={13} bold lines={1} localize={false}>
                    {creator?.channel_title ||
                      group.opinions[0]?.channel_title ||
                      ""}
                  </Copy>
                </View>
                <Copy size={12} muted localize={false}>
                  {day
                    ? new Date(`${day}T12:00:00Z`).toLocaleDateString(
                        locale === "en" ? "en-US" : "zh-CN",
                        { month: "short", day: "numeric" },
                      )
                    : ""}
                </Copy>
              </View>
              <View style={{ flexDirection: "row", gap: 10 }}>
                {!!group.video.thumbnail_url && (
                  <Image
                    source={{ uri: group.video.thumbnail_url }}
                    style={{ width: 96, height: 54, borderRadius: 8 }}
                  />
                )}
                <View style={{ flex: 1 }}>
                  <Copy size={14} lines={2} localize={false}>
                    {group.video.video_title ?? ""}
                  </Copy>
                </View>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {group.opinions.map((opinion) => (
                  <View
                    key={opinion.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: t.rim,
                    }}
                  >
                    <View
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: tone(opinion.sentiment),
                      }}
                    />
                    <Copy size={12} bold localize={false}>
                      {opinion.ticker}
                    </Copy>
                  </View>
                ))}
              </View>
            </Pressable>
          );
        })}
      </Glass>
    </View>
  );
}

/** The Web's "Recent shifts": stocks whose daily average moved between two dates. */
function Shifts({ changes, stocks }: { changes: Change[]; stocks: Stock[] }) {
  const t = useTheme();
  const consensus = new Map(stocks.map((s) => [s.ticker, s]));
  const rows = [...changes]
    .sort((a, b) => b.current_date.localeCompare(a.current_date))
    .slice(0, 8);
  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 4 }}>
        <Copy size={18} bold>
          最近观点变化
        </Copy>
        <Copy size={12} muted>
          与该股票上一次被讨论时相比
        </Copy>
      </View>
      <Glass style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
        {rows.map((change, index) => (
          <Row
            key={change.ticker}
            first={index === 0}
            onPress={() =>
              router.push(`/stock/${encodeURIComponent(change.ticker)}`)
            }
          >
            <CompanyLogo symbol={change.ticker} size={24} />
            <View style={{ flex: 1 }}>
              <Copy size={14} bold localize={false}>
                {change.ticker}
              </Copy>
            </View>
            <OpinionStrength value={consensus.get(change.ticker)?.avg_score} />
            <View style={{ width: 1, height: 12, backgroundColor: t.border }} />
            {change.change == null ? (
              <Copy size={12} muted>
                首次覆盖
              </Copy>
            ) : (
              <OpinionStrength value={change.change} change />
            )}
          </Row>
        ))}
      </Glass>
    </View>
  );
}
