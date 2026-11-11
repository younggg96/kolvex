// The Web's "Stock watch" panel (components/decision/StockObservationList.tsx) for the
// market-wide lists: today's movers, volume surges and the curated core list.
import { useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import {
  CORE_STOCKS,
  STOCK_SECTORS,
  currentMarketDiscovery,
  fetchMarketDiscovery,
  type DiscoveryStock,
} from "../lib/marketDiscovery";
import {
  BUZZ_SOURCES,
  buzzSymbols,
  loadBuzz,
  type BuzzSource,
} from "../lib/creatorBuzz";
import { useTheme } from "../lib/theme";
import { useResource } from "../lib/useResource";
import { usePreferences } from "../state/Preferences";
import { Filters } from "./Content";
import { QuoteRow } from "./Quotes";
import { CardsSkeleton } from "./Skeletons";
import {
  Button,
  Copy,
  Empty,
  Failure,
  Glass,
  LoadingStatus,
  Section,
  styles,
} from "./UI";

type Scope = "movers" | "active" | "creators" | "core";
const PAGE = 10;
const SORTS: Record<Scope, [string, string][]> = {
  movers: [
    ["move", "今日波动"],
    ["gainers", "涨幅优先"],
    ["losers", "跌幅优先"],
  ],
  active: [
    ["volume", "放量倍数"],
    ["move", "今日波动"],
    ["gainers", "涨幅优先"],
    ["losers", "跌幅优先"],
  ],
  creators: [
    ["heat", "近期讨论 · 7 天"],
    ["latest", "最新观点"],
  ],
  core: [["default", "名单顺序"]],
};
const DESCRIPTIONS: Record<Scope, string> = {
  movers: "Yahoo 涨跌榜候选 · 按快照涨跌排序",
  active: "活跃股候选 · 成交量至少为3个月日均的1.5倍",
  creators:
    "YouTube 观点（7天）+ Reddit 提及（24小时）+ X 帖子（7天）· 按各来源名次综合排序",
  core: "精选观察名单 · 名单内排序",
};
const EMPTY: Record<Scope, string> = {
  movers: "来源榜单中暂时没有符合条件的异动股票。",
  active: "本交易日活跃候选中，暂无成交量达到全天日均1.5倍的股票，可稍后刷新。",
  creators: "近 7 天暂时没有博主观点更新。",
  core: "这个列表暂时没有股票。",
};

export function StockWatch({ revision }: { revision: number }) {
  const [scope, setScope] = useState<Scope>("movers");
  const [sort, setSort] = useState("move");
  const [sector, setSector] = useState("all");
  const [source, setSource] = useState<BuzzSource>("all");
  const [rows, setRows] = useState(PAGE);
  const [showNotes, setShowNotes] = useState(false);
  const changeScope = (next: string) => {
    setScope(next as Scope);
    setSort(SORTS[next as Scope][0][0]);
    setSector("all");
    setSource("all");
    setRows(PAGE);
  };
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.row}>
        <Section title="股票观察" />
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: showNotes }}
          accessibilityLabel="名单说明"
          onPress={() => setShowNotes((v) => !v)}
          hitSlop={8}
          style={{
            minWidth: 44,
            minHeight: 44,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Copy muted localize={false}>
            ⓘ
          </Copy>
        </Pressable>
      </View>
      <Filters
        values={[
          ["movers", "今日异动"],
          ["active", "放量活跃"],
          ["creators", "博主热议"],
          ["core", "常看美股"],
        ]}
        value={scope}
        onChange={changeScope}
      />
      {scope === "core" ? (
        <Filters
          values={STOCK_SECTORS.map((item) => [item.key, item.zh] as const)}
          value={sector}
          onChange={(value) => {
            setSector(value);
            setRows(PAGE);
          }}
        />
      ) : (
        <Filters
          values={
            scope === "creators" && source === "reddit"
              ? SORTS.creators.slice(0, 1)
              : SORTS[scope]
          }
          value={sort}
          onChange={(value) => {
            setSort(value);
            setRows(PAGE);
          }}
        />
      )}
      {scope === "creators" && (
        <Filters
          values={BUZZ_SOURCES}
          value={source}
          onChange={(value) => {
            setSource(value as BuzzSource);
            // Reddit rankings carry no per-post dates, so there is no "latest" order for them.
            if (value === "reddit") setSort("heat");
            setRows(PAGE);
          }}
        />
      )}
      <Copy size={12} muted>
        {scope === "creators" && sort === "latest"
          ? "按原文发布时间 · 包含历史观点"
          : scope === "creators" && source === "reddit"
            ? "Reddit 近 24 小时股票提及 · 来自 ApeWisdom"
            : scope === "creators" && source === "x"
              ? "已收录 X 博主帖子中的股票代码 · 近 7 天"
              : scope === "creators" && source === "youtube"
                ? "近 7 天发布的观点"
                : DESCRIPTIONS[scope]}
      </Copy>
      {showNotes && (scope === "movers" || scope === "active") && (
        <Glass style={{ padding: 16, gap: 8 }}>
          <Copy size={12} muted>
            来自 Yahoo Finance
            筛选候选，并非全市场完整排名。范围为美元美股，股价至少5美元、市值至少20亿美元、当日成交量至少2万股；每个来源榜单最多100只，页面可见时每分钟更新。右侧报价单独刷新。
          </Copy>
          {scope === "active" && (
            <Copy size={12} muted>
              放量倍数 = 当日累计成交量 /
              3个月全天日均成交量，不是与平常同一时刻比较；开盘初期可能暂无符合条件的股票。
            </Copy>
          )}
        </Glass>
      )}
      {scope === "creators" ? (
        <BuzzList
          source={source}
          sort={sort === "latest" && source !== "reddit" ? "latest" : "heat"}
          rows={rows}
          revision={revision}
          more={() => setRows((v) => v + PAGE)}
        />
      ) : scope === "core" ? (
        <CoreList
          sector={sector}
          rows={rows}
          revision={revision}
          more={() => setRows((v) => v + PAGE)}
        />
      ) : (
        <DiscoveryList
          scope={scope}
          sort={sort}
          rows={rows}
          revision={revision}
          more={() => setRows((v) => v + PAGE)}
        />
      )}
    </View>
  );
}

function BuzzList({
  source,
  sort,
  rows,
  revision,
  more,
}: {
  source: BuzzSource;
  sort: "heat" | "latest";
  rows: number;
  revision: number;
  more: () => void;
}) {
  const resource = useResource(`creator-buzz:${revision}`, loadBuzz, 45_000);
  const data = resource.data;
  if (resource.loading && !data)
    return (
      <LoadingStatus label="正在加载股票">
        <CardsSkeleton
          count={4}
          lines={[
            { size: 16, width: "30%" },
            { size: 12, width: "60%" },
          ]}
        />
      </LoadingStatus>
    );
  if (!data)
    return <Failure message="博主线索暂不可用。" retry={resource.refresh} />;
  const list = buzzSymbols(data, source, sort);
  const missing =
    (source === "all" || source === "youtube") && !data.youtube
      ? true
      : (source === "all" || source === "reddit") && !data.reddit
        ? true
        : (source === "all" || source === "x") && !data.x;
  return (
    <View style={{ gap: 8 }}>
      {missing && (
        <Glass style={{ padding: 12, gap: 8 }}>
          <Copy size={12} muted>
            部分来源暂时不可用，当前只显示已取得的讨论。
          </Copy>
          <Button onPress={resource.refresh} disabled={resource.loading}>
            重试
          </Button>
        </Glass>
      )}
      {!list.length ? (
        <Empty
          title="暂无内容"
          message={
            sort === "latest"
              ? "暂时没有带原文日期的博主观点。"
              : source === "reddit"
                ? "最新 Reddit 榜单暂时没有股票提及。"
                : source === "x"
                  ? "近 7 天收录的 X 帖子中暂时没有股票代码。"
                  : "近 7 天暂时没有博主观点更新。"
          }
        />
      ) : (
        list
          .slice(0, rows)
          .map((symbol) => (
            <QuoteRow key={symbol} symbol={symbol} revision={revision} />
          ))
      )}
      {list.length > rows && <Button onPress={more}>显示更多</Button>}
    </View>
  );
}

function CoreList({
  sector,
  rows,
  revision,
  more,
}: {
  sector: string;
  rows: number;
  revision: number;
  more: () => void;
}) {
  const list = CORE_STOCKS.filter(
    (stock) => sector === "all" || stock.sector === sector,
  );
  return (
    <View style={{ gap: 8 }}>
      {list.slice(0, rows).map((stock) => (
        <QuoteRow
          key={stock.symbol}
          symbol={stock.symbol}
          revision={revision}
        />
      ))}
      {list.length > rows && <Button onPress={more}>显示更多</Button>}
    </View>
  );
}

function DiscoveryList({
  scope,
  sort,
  rows,
  revision,
  more,
}: {
  scope: "movers" | "active";
  sort: string;
  rows: number;
  revision: number;
  more: () => void;
}) {
  const resource = useResource(
    `market-discovery:${revision}`,
    fetchMarketDiscovery,
    30_000,
  );
  const data = currentMarketDiscovery(resource.data);
  const board = data?.[scope];
  const items = [...(board?.items ?? [])].sort((a, b) =>
    sort === "volume"
      ? (b.volumeMultiple ?? 0) - (a.volumeMultiple ?? 0) ||
        a.symbol.localeCompare(b.symbol)
      : sort === "gainers"
        ? b.changePercent - a.changePercent
        : sort === "losers"
          ? a.changePercent - b.changePercent
          : Math.abs(b.changePercent) - Math.abs(a.changePercent),
  );
  if (resource.loading && !resource.data)
    return (
      <LoadingStatus label="正在加载股票">
        <CardsSkeleton
          count={4}
          lines={[
            { size: 16, width: "30%" },
            { size: 12, width: "60%" },
          ]}
        />
      </LoadingStatus>
    );
  if (!board || (resource.error && !resource.data))
    return <Failure message="股票榜单暂时不可用。" retry={resource.refresh} />;
  return (
    <View style={{ gap: 8 }}>
      {(board.stale || board.partial) && (
        <Glass style={{ padding: 12, gap: 8 }}>
          <Copy size={12} muted>
            {board.stale
              ? "更新暂不可用，显示最多15分钟内的榜单快照。"
              : "部分来源榜单暂不可用，当前仅显示已取得的候选。"}
          </Copy>
          <Button onPress={resource.refresh} disabled={resource.loading}>
            重试榜单
          </Button>
        </Glass>
      )}
      {!items.length ? (
        <Empty title="暂无内容" message={EMPTY[scope]} />
      ) : (
        <Glass style={{ paddingHorizontal: 16 }}>
          {items.slice(0, rows).map((item, index) => (
            <DiscoveryRow
              key={item.symbol}
              item={item}
              first={index === 0}
              showVolume={scope === "active"}
            />
          ))}
        </Glass>
      )}
      {items.length > rows && <Button onPress={more}>显示更多</Button>}
      {!!board.fetchedAt && <FetchedAt value={board.fetchedAt} />}
    </View>
  );
}

function FetchedAt({ value }: { value: string }) {
  const { locale } = usePreferences();
  const time = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "zh-CN", {
    timeZone: "America/New_York",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
  return (
    <View style={{ flexDirection: "row", gap: 4 }}>
      <Copy size={12} muted>
        榜单获取时间
      </Copy>
      <Copy size={12} muted localize={false}>
        {`· ${time}`}
      </Copy>
      <Copy size={12} muted>
        纽约时间
      </Copy>
    </View>
  );
}

function DiscoveryRow({
  item,
  first,
  showVolume,
}: {
  item: DiscoveryStock;
  first: boolean;
  showVolume: boolean;
}) {
  const t = useTheme();
  const { locale } = usePreferences();
  const region = locale === "en" ? "en-US" : "zh-CN";
  const price = new Intl.NumberFormat(region, {
    style: "currency",
    currency: "USD",
  }).format(item.price);
  // Hermes ignores signDisplay, so the sign is written out as on the Web.
  const change = `${item.changePercent > 0 ? "+" : ""}${new Intl.NumberFormat(
    region,
    { style: "percent", maximumFractionDigits: 2 },
  ).format(item.changePercent / 100)}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.symbol} ${item.name}`}
      onPress={() => router.push(`/stock/${encodeURIComponent(item.symbol)}`)}
      style={({ pressed }) => [
        styles.row,
        {
          minHeight: 60,
          paddingVertical: 10,
          borderTopWidth: first ? 0 : 1,
          borderColor: t.border,
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Copy bold localize={false}>
          {item.symbol}
        </Copy>
        <Copy size={12} muted lines={1} localize={false}>
          {item.name}
        </Copy>
      </View>
      <View style={{ alignItems: "flex-end", gap: 2 }}>
        <Copy size={14} bold localize={false}>
          {price}
        </Copy>
        <Copy
          size={12}
          bold
          localize={false}
          color={item.changePercent < 0 ? t.negative : t.accent}
        >
          {change}
        </Copy>
        {showVolume && item.volumeMultiple != null && (
          <Copy size={12} muted localize={false}>
            {`${item.volumeMultiple.toFixed(1)}×`}
          </Copy>
        )}
      </View>
    </Pressable>
  );
}
