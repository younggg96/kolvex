// The Web's Reddit heat ranking (app/dashboard/reddit-opinions) at phone size: heading
// with notes, filter and refresh; then one list card of ranked rows that expand.
import { useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { demoMode } from "../lib/config";
import { isSymbol } from "../lib/models";
import {
  REDDIT_COMMUNITIES,
  mentionChange,
  redditRanking,
  selectRedditStocks,
  type RedditCommunity,
  type RedditSort,
  type RedditStock,
} from "../lib/reddit";
import { useTheme } from "../lib/theme";
import { useResource } from "../lib/useResource";
import { usePreferences } from "../state/Preferences";
import { useWatchlist } from "../state/Watchlist";
import { CompanyLogo } from "./CompanyLogo";
import { OptionChip, OptionGroup, OptionSheet } from "./OptionSheet";
import { Button, Copy, Failure, Glass, Skeleton, styles } from "./UI";

const SORTS: [RedditSort, string][] = [
  ["mentions", "提及量最多"],
  ["mentionChange", "提及量增幅最大"],
  ["rankChange", "排名升幅最大"],
  ["upvotes", "获赞数最多"],
];
const communityLabel = (value: RedditCommunity) =>
  value === "all-stocks" ? "全部股票社区" : `r/${value}`;

function IconButton({
  icon,
  label,
  onPress,
  active = false,
  disabled = false,
}: {
  icon: { ios: string; android: string; web: string };
  label: string;
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => ({
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed || active ? t.wash : "transparent",
        opacity: disabled ? 0.4 : 1,
      })}
    >
      <SymbolView
        name={icon as never}
        size={16}
        tintColor={active ? t.text : t.secondary}
      />
    </Pressable>
  );
}

export function RedditHeat({ revision }: { revision: number }) {
  const t = useTheme();
  const { locale } = usePreferences();
  const [community, setCommunity] = useState<RedditCommunity>("all-stocks");
  const [sort, setSort] = useState<RedditSort>("mentions");
  const [onlySaved, setOnlySaved] = useState(false);
  const [reload, setReload] = useState(0);
  const [filters, setFilters] = useState(false);
  const [notes, setNotes] = useState(false);
  const list = useWatchlist();
  const resource = useResource(
    `reddit:${community}:${revision}:${reload}`,
    (signal) =>
      demoMode
        ? Promise.resolve({ results: [], fetchedAt: "", community })
        : redditRanking(community, signal, revision + reload > 0),
  );
  const all = resource.data?.results ?? [];
  const rows = selectRedditStocks(
    all,
    "",
    sort,
    onlySaved ? list.symbols : undefined,
  );
  const filtered =
    community !== "all-stocks" || sort !== "mentions" || onlySaved;
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.row}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Copy size={24} bold>
            Reddit 热度榜
          </Copy>
          <IconButton
            icon={{ ios: "info.circle", android: "info", web: "info" }}
            label="查看统计方法"
            active={notes}
            onPress={() => setNotes((v) => !v)}
          />
        </View>
        <View style={{ flexDirection: "row", gap: 2 }}>
          <IconButton
            icon={{
              ios: "line.3.horizontal.decrease",
              android: "filter_list",
              web: "filter_list",
            }}
            label="筛选"
            active={filtered}
            onPress={() => setFilters(true)}
          />
          <IconButton
            icon={{
              ios: "arrow.clockwise",
              android: "refresh",
              web: "refresh",
            }}
            label="刷新"
            disabled={resource.loading}
            onPress={() => setReload((v) => v + 1)}
          />
        </View>
      </View>
      {notes && (
        <Glass style={{ padding: 14, gap: 6 }}>
          <Copy
            size={12}
            muted
          >{`${communityLabel(community)} · 当前榜单前 100 个代码 · 过去 24 小时`}</Copy>
          <Copy size={12} muted>
            ApeWisdom 汇总所选 Reddit 社区的讨论。本页展示来源排名前 100
            个代码，搜索、排序和关注筛选仅覆盖当前榜单。数据缓存 5
            分钟，变化对比来源提供的 24
            小时前数据。提及量基数缺失或为零时不计算百分比；排序时无对比值的代码置后。代码与名称按来源展示，未作独立证券身份核验。讨论热度不代表看涨或看跌情绪。
          </Copy>
        </Glass>
      )}
      {!!resource.error && (
        <Failure
          message={
            resource.data
              ? "刷新失败，当前仍显示上次获取的数据。请核对获取时间后重试。"
              : "暂时无法获取 Reddit 热度榜，请重试。"
          }
          retry={() => setReload((v) => v + 1)}
        />
      )}
      {!!list.error && <Failure message={list.error} retry={list.refresh} />}
      <Glass style={{ paddingHorizontal: 12, paddingVertical: 4 }}>
        <View
          style={[
            styles.row,
            {
              paddingVertical: 10,
              borderBottomWidth: 1,
              borderColor: t.border,
            },
          ]}
        >
          <Copy size={12} muted>
            代码／公司
          </Copy>
          <View style={{ paddingRight: 22 }}>
            <Copy size={12} muted>
              提及 / 24h
            </Copy>
          </View>
        </View>
        {resource.loading && !resource.data ? (
          <View style={{ gap: 14, paddingVertical: 12 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} height={32} />
            ))}
          </View>
        ) : !rows.length ? (
          <View style={{ paddingVertical: 20 }}>
            <Copy size={14} muted>
              {onlySaved
                ? "当前社区榜单和搜索条件下没有关注代码，其他关注仍会保留。"
                : "数据来源暂未提供排名，请稍后刷新。"}
            </Copy>
          </View>
        ) : (
          rows.map((row, index) => (
            <RedditRow key={row.ticker} row={row} first={index === 0} />
          ))
        )}
      </Glass>
      {!!resource.data?.fetchedAt && (
        <Copy size={12} muted>
          {`数据来源：ApeWisdom · 获取时间 ${new Date(resource.data.fetchedAt).toLocaleString(locale === "en" ? "en-US" : "zh-CN")}`}
        </Copy>
      )}
      <OptionSheet
        title="筛选"
        visible={filters}
        onClose={() => setFilters(false)}
        onReset={
          filtered
            ? () => {
                setCommunity("all-stocks");
                setSort("mentions");
                setOnlySaved(false);
              }
            : undefined
        }
      >
        <OptionGroup
          label="社区"
          options={REDDIT_COMMUNITIES.map(
            (value) => [value, communityLabel(value)] as const,
          )}
          value={community}
          onChange={(value) => setCommunity(value as typeof community)}
        />
        <OptionGroup
          label="排序"
          options={SORTS}
          value={sort}
          onChange={(value) => setSort(value as typeof sort)}
        />
        <View style={{ gap: 8 }}>
          <Copy size={12} muted>
            范围
          </Copy>
          <View style={{ flexDirection: "row" }}>
            <OptionChip
              selected={onlySaved}
              disabled={!list.ready}
              onPress={() => setOnlySaved((v) => !v)}
            >
              {`仅关注 ${list.symbols.length}`}
            </OptionChip>
          </View>
        </View>
      </OptionSheet>
    </View>
  );
}

function RedditRow({ row, first }: { row: RedditStock; first: boolean }) {
  const t = useTheme();
  const list = useWatchlist();
  const [open, setOpen] = useState(false);
  const change = mentionChange(row);
  const changeLabel =
    row.previousMentions === null
      ? "此前未上榜"
      : change === null
        ? "无对比基数"
        : `${change > 0 ? "+" : ""}${Math.round(change)}%`;
  const rankChange =
    row.previousRank === null
      ? "此前未上榜"
      : row.previousRank - row.rank > 0
        ? `上升 ${row.previousRank - row.rank}`
        : row.previousRank - row.rank < 0
          ? `下降 ${row.rank - row.previousRank}`
          : "持平";
  const saved = list.symbols.includes(row.ticker);
  return (
    <View style={{ borderTopWidth: first ? 0 : 1, borderColor: t.border }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          minHeight: 56,
          paddingVertical: 8,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <View style={{ width: 20, alignItems: "center" }}>
          <Copy size={12} muted localize={false}>
            {String(row.rank)}
          </Copy>
        </View>
        <CompanyLogo symbol={row.ticker} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Copy size={14} bold localize={false}>
            {row.ticker}
          </Copy>
          <Copy size={12} muted lines={1} localize={false}>
            {row.name}
          </Copy>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Copy size={14} bold localize={false}>
            {row.mentions.toLocaleString("en-US")}
          </Copy>
          <Copy size={12} muted>
            {changeLabel}
          </Copy>
        </View>
        <SymbolView
          name={{
            ios: open ? "chevron.up" : "chevron.down",
            android: "expand_more",
            web: "expand_more",
          }}
          size={12}
          tintColor={t.secondary}
        />
      </Pressable>
      {open && (
        <View style={{ gap: 10, paddingLeft: 30, paddingBottom: 14 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 20 }}>
            {(
              [
                ["提及量变化", changeLabel],
                ["排名变化", rankChange],
                ["获赞数", row.upvotes.toLocaleString("en-US")],
              ] as const
            ).map(([label, value]) => (
              <View key={label} style={{ gap: 2 }}>
                <Copy size={12} muted>
                  {label}
                </Copy>
                <Copy size={12} localize={false}>
                  {value}
                </Copy>
              </View>
            ))}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {isSymbol(row.ticker) && (
              <Button
                onPress={() =>
                  router.push(`/stock/${encodeURIComponent(row.ticker)}`)
                }
              >
                {`打开 ${row.ticker} 行情页`}
              </Button>
            )}
            <Button
              selected={saved}
              disabled={!list.ready || list.pending}
              onPress={() => list.toggle(row.ticker)}
            >
              {saved ? "已关注" : "关注"}
            </Button>
          </View>
        </View>
      )}
    </View>
  );
}
