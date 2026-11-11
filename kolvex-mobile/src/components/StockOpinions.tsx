// The Web's CreatorIntelligence (stock page "博主情报" tab) at phone size: each creator's
// latest call in the past 30 days split into bullish / neutral-or-mixed / bearish cards,
// then an opinion timeline by date and the selected opinion's details.
import { useState } from "react";
import { Image, Linking, Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { apiRequest } from "../lib/http";
import { useTheme } from "../lib/theme";
import { useResource } from "../lib/useResource";
import { usePreferences } from "../state/Preferences";
import { OpinionStrength } from "./OpinionStrength";
import { Button, Copy, Failure, Glass, Skeleton, phone } from "./UI";

type StockOpinion = {
  id: string;
  channel_id: string;
  channel_title?: string | null;
  channel_avatar_url?: string | null;
  sentiment: string;
  direction_score?: number | null;
  confidence?: number | null;
  time_horizon?: string | null;
  summary?: string | null;
  thesis?: string | null;
  key_points?: string[] | null;
  risks?: string[] | null;
  opinion_date: string;
  video_id?: string | null;
  video_url?: string | null;
  video_title?: string | null;
};
type Side = "bullish" | "neutral" | "bearish";

const sideOf = (o: StockOpinion): Side =>
  o.sentiment === "bullish"
    ? "bullish"
    : o.sentiment === "bearish"
      ? "bearish"
      : "neutral";

/** The Web's latestCreatorOpinions: each creator's newest call in the past 30 days. */
function latestCreatorOpinions(opinions: StockOpinion[], now = Date.now()) {
  const latest = new Map<string, StockOpinion>();
  for (const opinion of opinions) {
    const date = Date.parse(opinion.opinion_date);
    if (!Number.isFinite(date) || date > now || date < now - 30 * 86400000)
      continue;
    const previous = latest.get(opinion.channel_id);
    if (!previous || date > Date.parse(previous.opinion_date))
      latest.set(opinion.channel_id, opinion);
  }
  return [...latest.values()].sort((a, b) =>
    b.opinion_date.localeCompare(a.opinion_date),
  );
}

const creatorName = (o: StockOpinion) => o.channel_title || o.channel_id;

function Avatar({ uri, size }: { uri?: string | null; size: number }) {
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

function Dot({ side, size = 8 }: { side: Side; size?: number }) {
  const t = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor:
          side === "bullish"
            ? t.accent
            : side === "bearish"
              ? t.negative
              : t.secondary,
      }}
    />
  );
}

export function StockOpinions({ symbol }: { symbol: string }) {
  const t = useTheme();
  const { locale } = usePreferences();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Side[]>([]);
  const [allDates, setAllDates] = useState(false);
  const r = useResource(`stock-creators:${symbol}`, (signal) =>
    apiRequest<{ opinions?: StockOpinion[] }>(
      `/youtube-opinions/stocks/${encodeURIComponent(symbol)}`,
      { signal, timeout: 30_000 },
    ),
  );
  const history = [...(r.data?.opinions ?? [])].sort((a, b) =>
    b.opinion_date.localeCompare(a.opinion_date),
  );
  const latest = latestCreatorOpinions(history);
  const selected =
    history.find((o) => o.id === selectedId) ?? history[0] ?? null;
  const selectedDay = selected?.opinion_date.slice(0, 10);
  const days = [...new Set(history.map((o) => o.opinion_date.slice(0, 10)))];
  const visibleDays = allDates
    ? days
    : [
        ...new Set([
          ...days.slice(0, 7),
          ...(selectedDay ? [selectedDay] : []),
        ]),
      ].sort((a, b) => b.localeCompare(a));
  const dayOpinions = history.filter(
    (o) => o.opinion_date.slice(0, 10) === selectedDay,
  );
  const date = (value: string, compact = false) => {
    const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
    return Number.isNaN(parsed.getTime())
      ? value
      : new Intl.DateTimeFormat(locale === "en" ? "en-US" : "zh-CN", {
          year: compact ? undefined : "numeric",
          month: "short",
          day: "numeric",
        }).format(parsed);
  };
  const groups: { side: Side; label: string; empty: string }[] = [
    { side: "bullish", label: "看多", empty: "近 30 天暂无看多观点" },
    { side: "neutral", label: "中性或分歧", empty: "近 30 天暂无中性或分歧观点" },
    { side: "bearish", label: "看空", empty: "近 30 天暂无看空观点" },
  ];
  const tone = (side: Side) =>
    side === "bullish" ? t.accent : side === "bearish" ? t.negative : t.secondary;

  const header = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <Copy size={20} bold>
        博主情报
      </Copy>
      <Pressable
        accessibilityRole="link"
        hitSlop={8}
        onPress={() =>
          router.push({ pathname: "/creators", params: { tab: "stocks" } })
        }
      >
        <Copy size={13} bold color={t.accent}>
          完整记录
        </Copy>
      </Pressable>
    </View>
  );

  if (r.loading && !r.data)
    return (
      <View style={{ gap: 12 }}>
        {header}
        {[0, 1, 2].map((i) => (
          <Glass key={i} style={{ padding: 16, gap: 10 }}>
            <Skeleton width={64} height={14} />
            <Skeleton height={14} />
            <Skeleton width="70%" height={14} />
          </Glass>
        ))}
      </View>
    );
  if (r.error && !r.data)
    return (
      <View style={{ gap: 12 }}>
        {header}
        <Failure message="暂时无法加载博主观点。" retry={r.refresh} />
      </View>
    );
  if (!history.length)
    return (
      <View style={{ gap: 12 }}>
        {header}
        <Glass style={{ padding: 16, gap: 10, alignItems: "flex-start" }}>
          <Copy size={14} muted>
            这只股票暂时没有博主观点，仍可在本页使用 AI 分析和 AI 研究。
          </Copy>
          <Button onPress={() => router.navigate("/opinions")}>
            浏览博主观点
          </Button>
        </Glass>
      </View>
    );

  return (
    <View style={{ gap: 16 }}>
      {header}
      {groups.map((group) => {
        const items = latest.filter((o) => sideOf(o) === group.side);
        const open = expanded.includes(group.side);
        return (
          <Glass key={group.side} style={{ padding: 0, overflow: "hidden" }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderColor: t.border,
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <Dot side={group.side} />
                <Copy size={14} bold color={tone(group.side)}>
                  {group.label}
                </Copy>
              </View>
              <Copy size={12} muted>{`${items.length} 位博主`}</Copy>
            </View>
            {items.length ? (
              (open ? items : items.slice(0, 3)).map((o, index) => (
                <Pressable
                  key={o.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selected?.id === o.id }}
                  onPress={() => setSelectedId(o.id)}
                  style={({ pressed }) => ({
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    gap: 10,
                    borderTopWidth: index ? 1 : 0,
                    borderColor: t.border,
                    backgroundColor:
                      selected?.id === o.id || pressed ? t.wash : "transparent",
                  })}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-start",
                      gap: 10,
                    }}
                  >
                    <Avatar uri={o.channel_avatar_url} size={phone(28)} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Copy size={14} bold localize={false}>
                        {creatorName(o)}
                      </Copy>
                      <Copy size={12} muted localize={false}>
                        {date(o.opinion_date)}
                      </Copy>
                    </View>
                  </View>
                  <Copy size={14} lines={2} localize={false}>
                    {o.summary || o.thesis || ""}
                  </Copy>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Copy size={12}>查看观点</Copy>
                    <SymbolView
                      name={{
                        ios: "arrow.up.right",
                        android: "north_east",
                        web: "north_east",
                      }}
                      size={11}
                      tintColor={t.secondary}
                    />
                  </View>
                </Pressable>
              ))
            ) : (
              <View style={{ paddingHorizontal: 16, paddingVertical: 20 }}>
                <Copy size={14} muted>
                  {group.empty}
                </Copy>
              </View>
            )}
            {items.length > 3 && (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                onPress={() =>
                  setExpanded((current) =>
                    open
                      ? current.filter((side) => side !== group.side)
                      : [...current, group.side],
                  )
                }
                style={{
                  minHeight: 44,
                  justifyContent: "center",
                  paddingHorizontal: 16,
                  borderTopWidth: 1,
                  borderColor: t.border,
                }}
              >
                <Copy size={12} bold>
                  {open ? "收起博主" : `查看另外 ${items.length - 3} 位博主`}
                </Copy>
              </Pressable>
            )}
          </Glass>
        );
      })}

      <View style={{ gap: 10, marginTop: 8 }}>
        <Copy size={16} bold>
          观点时间线
        </Copy>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -phone(16) }}
          contentContainerStyle={{ paddingHorizontal: phone(16) }}
        >
          {visibleDays.map((day) => {
            const items = history.filter(
              (o) => o.opinion_date.slice(0, 10) === day,
            );
            const active = selectedDay === day;
            return (
              <View key={day} style={{ width: phone(128) }}>
                <View
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: 20,
                    height: 1,
                    backgroundColor: t.border,
                  }}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setSelectedId(items[0].id)}
                  style={{
                    gap: 6,
                    paddingHorizontal: 10,
                    paddingTop: 12,
                    paddingBottom: 10,
                    marginRight: 4,
                    borderRadius: 20,
                    backgroundColor: active ? t.wash : "transparent",
                  }}
                >
                  <View
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 8,
                      borderWidth: 3,
                      borderColor: t.background,
                      backgroundColor: active ? t.text : t.secondary,
                    }}
                  />
                  <Copy size={14} bold={active} muted={!active} localize={false}>
                    {date(day, true)}
                  </Copy>
                  <Copy size={12} muted>{`${items.length} 条观点`}</Copy>
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
        {days.length > 7 && (
          <Pressable
            accessibilityRole="button"
            onPress={() => setAllDates((v) => !v)}
            style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}
          >
            <Copy size={12} bold>
              {allDates ? "收起历史日期" : `查看全部 ${days.length} 个日期`}
            </Copy>
          </Pressable>
        )}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {dayOpinions.map((o) => {
            const active = selected?.id === o.id;
            return (
              <Pressable
                key={o.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setSelectedId(o.id)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  maxWidth: "100%",
                  minHeight: phone(40),
                  paddingHorizontal: 12,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: active ? t.rim : t.border,
                  backgroundColor: active ? t.wash : "transparent",
                }}
              >
                <Avatar uri={o.channel_avatar_url} size={18} />
                <View style={{ flexShrink: 1 }}>
                  <Copy size={12} bold lines={1} localize={false}>
                    {creatorName(o)}
                  </Copy>
                </View>
                <Dot side={sideOf(o)} size={6} />
                <SymbolView
                  name={{
                    ios: "chevron.right",
                    android: "chevron_right",
                    web: "chevron_right",
                  }}
                  size={9}
                  tintColor={t.secondary}
                />
              </Pressable>
            );
          })}
        </View>
      </View>

      {selected && (
        <View
          style={{
            gap: 14,
            paddingTop: 20,
            borderTopWidth: 1,
            borderColor: t.border,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 12,
            }}
          >
            <View style={{ flex: 1, gap: 10 }}>
              <Copy size={16} bold>
                观点内容
              </Copy>
              <Pressable
                accessibilityRole="link"
                onPress={() =>
                  router.push(
                    `/creator/youtube/${encodeURIComponent(selected.channel_id)}`,
                  )
                }
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <Avatar uri={selected.channel_avatar_url} size={phone(28)} />
                <View style={{ flexShrink: 1 }}>
                  <Copy size={14} bold localize={false}>
                    {creatorName(selected)}
                  </Copy>
                </View>
              </Pressable>
            </View>
            <View style={{ alignItems: "flex-end", gap: 8 }}>
              <Copy size={12} muted localize={false}>
                {date(selected.opinion_date)}
              </Copy>
              {sideOf(selected) === "neutral" ? (
                <Copy size={14} bold muted>
                  {selected.sentiment === "mixed" ? "分歧" : "中性"}
                </Copy>
              ) : (
                <OpinionStrength value={selected.direction_score} />
              )}
            </View>
          </View>
          {(!!selected.time_horizon || selected.confidence != null) && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 20 }}>
              {!!selected.time_horizon && (
                <View style={{ flexDirection: "row", gap: 6, flexShrink: 1 }}>
                  <Copy size={12} muted>
                    时间范围
                  </Copy>
                  <View style={{ flexShrink: 1 }}>
                    <Copy size={12} bold localize={false}>
                      {selected.time_horizon}
                    </Copy>
                  </View>
                </View>
              )}
              {selected.confidence != null && (
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <Copy size={12} muted>
                    置信度
                  </Copy>
                  <Copy size={12} bold localize={false}>
                    {`${Math.round(selected.confidence * 100)}%`}
                  </Copy>
                </View>
              )}
            </View>
          )}
          {!!selected.summary && (
            <Copy size={14} localize={false}>
              {selected.summary}
            </Copy>
          )}
          {!!selected.thesis && selected.thesis !== selected.summary && (
            <View style={{ gap: 4 }}>
              <Copy size={12} bold muted>
                投资判断
              </Copy>
              <Copy size={14} localize={false}>
                {selected.thesis}
              </Copy>
            </View>
          )}
          {[
            ["核心依据", selected.key_points],
            ["提到的风险", selected.risks],
          ].map(([label, list]) =>
            Array.isArray(list) && list.length ? (
              <View key={label as string} style={{ gap: 6 }}>
                <Copy size={12} bold muted>
                  {label as string}
                </Copy>
                {list.map((item, index) => (
                  <View key={index} style={{ flexDirection: "row", gap: 8 }}>
                    <Copy size={14} localize={false}>
                      •
                    </Copy>
                    <View style={{ flex: 1 }}>
                      <Copy size={14} localize={false}>
                        {item}
                      </Copy>
                    </View>
                  </View>
                ))}
              </View>
            ) : null,
          )}
          {!selected.summary && !selected.thesis && (
            <Copy size={14} muted>
              查看原始视频了解这条观点。
            </Copy>
          )}
          {!!(selected.video_url || selected.video_id) && (
            <Pressable
              accessibilityRole="link"
              onPress={() =>
                void Linking.openURL(
                  selected.video_url ||
                    `https://www.youtube.com/watch?v=${encodeURIComponent(selected.video_id!)}`,
                )
              }
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <SymbolView
                name={{
                  ios: "arrow.up.right.square",
                  android: "open_in_new",
                  web: "open_in_new",
                }}
                size={15}
                tintColor={t.text}
              />
              <View style={{ flex: 1 }}>
                <Copy size={14} bold localize={!selected.video_title}>
                  {selected.video_title || "查看原始视频"}
                </Copy>
              </View>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}
