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
} from "../lib/marketDiscovery";
import { SymbolView } from "expo-symbols";
import { quote } from "../lib/api";
import {
  BUZZ_SOURCES,
  buzzSymbols,
  loadBuzz,
  type BuzzData,
  type BuzzSource,
} from "../lib/creatorBuzz";
import { useTheme } from "../lib/theme";
import { useResource } from "../lib/useResource";
import { usePreferences } from "../state/Preferences";
import { CompanyLogo } from "./CompanyLogo";
import { MiniTrend, type RangeKey } from "./MarketCards";
import { Sheet } from "./PaperTrading";
import { CardsSkeleton } from "./Skeletons";
import {
  Button,
  Chip,
  Copy,
  Empty,
  Failure,
  Glass,
  LoadingStatus,
  phone,
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

const SCOPES: [Scope, string][] = [
  ["movers", "今日异动"],
  ["active", "放量活跃"],
  ["creators", "博主热议"],
  ["core", "常看美股"],
];

/** The Web's FilterSheetGroup: a small label over wrapping chips. */
function FilterGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly (readonly [string, string])[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Copy size={12} muted>
        {label}
      </Copy>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {options.map(([key, name]) => (
          <Chip
            key={key}
            size="sm"
            selected={key === value}
            onPress={() => onChange(key)}
          >
            {name}
          </Chip>
        ))}
      </View>
    </View>
  );
}

function RoundIcon({
  icon,
  label,
  onPress,
  dot = false,
}: {
  icon: { ios: string; android: string; web: string };
  label: string;
  onPress: () => void;
  dot?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => ({
        width: phone(40),
        height: phone(40),
        borderRadius: 999,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed ? t.wash : "transparent",
      })}
    >
      <SymbolView name={icon as never} size={15} tintColor={t.secondary} />
      {dot && (
        <View
          style={{
            position: "absolute",
            top: 2,
            right: 2,
            width: 9,
            height: 9,
            borderRadius: 5,
            borderWidth: 2,
            borderColor: t.background,
            backgroundColor: t.text,
          }}
        />
      )}
    </Pressable>
  );
}

export function StockWatch({
  revision,
  range = "1D",
}: {
  revision: number;
  range?: RangeKey;
}) {
  const t = useTheme();
  const { locale } = usePreferences();
  const [scope, setScope] = useState<Scope>("movers");
  const [sort, setSort] = useState("move");
  const [sector, setSector] = useState("all");
  const [source, setSource] = useState<BuzzSource>("all");
  const [rows, setRows] = useState(PAGE);
  const [showNotes, setShowNotes] = useState(false);
  const [filtering, setFiltering] = useState(false);
  const changeScope = (next: string) => {
    setScope(next as Scope);
    setSort(SORTS[next as Scope][0][0]);
    setSector("all");
    setSource("all");
    setRows(PAGE);
  };
  const filtered =
    scope !== "movers" ||
    sort !== SORTS[scope][0][0] ||
    sector !== "all" ||
    source !== "all";
  const description =
    scope === "creators" && sort === "latest"
      ? "按原文发布时间 · 包含历史观点"
      : scope === "creators" && source === "reddit"
        ? "Reddit 近 24 小时股票提及 · 来自 ApeWisdom"
        : scope === "creators" && source === "x"
          ? "已收录 X 博主帖子中的股票代码 · 近 7 天"
          : scope === "creators" && source === "youtube"
            ? "近 7 天发布的观点"
            : DESCRIPTIONS[scope];
  return (
    <Glass style={{ padding: 16, gap: 10 }}>
      <View style={styles.row}>
        <Copy size={20} bold>
          股票观察
        </Copy>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
          <RoundIcon
            icon={{ ios: "info.circle", android: "info", web: "info" }}
            label="名单说明"
            onPress={() => setShowNotes((v) => !v)}
          />
          <RoundIcon
            icon={{
              ios: "slider.horizontal.3",
              android: "tune",
              web: "tune",
            }}
            label="筛选股票"
            dot={filtered}
            onPress={() => setFiltering(true)}
          />
        </View>
      </View>
      {showNotes && (
        <View
          style={{
            gap: 6,
            padding: 12,
            borderRadius: phone(16),
            backgroundColor: t.wash,
          }}
        >
          <Copy size={12}>{description}</Copy>
          {(scope === "movers" || scope === "active") && (
            <Copy size={12} muted>
              来自 Yahoo Finance
              筛选候选，并非全市场完整排名。范围为美元美股，股价至少5美元、市值至少20亿美元、当日成交量至少2万股；每个来源榜单最多100只，页面可见时每分钟更新。右侧报价单独刷新。
            </Copy>
          )}
          {scope === "active" && (
            <Copy size={12} muted>
              放量倍数 = 当日累计成交量 /
              3个月全天日均成交量，不是与平常同一时刻比较；开盘初期可能暂无符合条件的股票。
            </Copy>
          )}
        </View>
      )}
      {scope === "creators" ? (
        <BuzzList
          source={source}
          sort={sort === "latest" && source !== "reddit" ? "latest" : "heat"}
          rows={rows}
          range={range}
          revision={revision}
          more={() => setRows((v) => v + PAGE)}
        />
      ) : scope === "core" ? (
        <CoreList
          sector={sector}
          rows={rows}
          range={range}
          revision={revision}
          more={() => setRows((v) => v + PAGE)}
        />
      ) : (
        <DiscoveryList
          scope={scope}
          sort={sort}
          rows={rows}
          range={range}
          revision={revision}
          more={() => setRows((v) => v + PAGE)}
        />
      )}
      <Sheet
        title="筛选股票"
        visible={filtering}
        onClose={() => setFiltering(false)}
      >
        <FilterGroup
          label="名单"
          options={SCOPES}
          value={scope}
          onChange={changeScope}
        />
        {scope === "core" && (
          <FilterGroup
            label="行业"
            options={STOCK_SECTORS.map(
              (item) => [item.key, locale === "en" ? item.en : item.zh] as const,
            )}
            value={sector}
            onChange={(value) => {
              setSector(value);
              setRows(PAGE);
            }}
          />
        )}
        {scope === "creators" && (
          <FilterGroup
            label="来源"
            options={BUZZ_SOURCES}
            value={source}
            onChange={(value) => {
              setSource(value as BuzzSource);
              // Reddit rankings carry no per-post dates, so there is no "latest" order for them.
              if (value === "reddit") setSort("heat");
              setRows(PAGE);
            }}
          />
        )}
        <FilterGroup
          label="排序"
          options={
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
        <View style={{ flexDirection: "row", gap: 8 }}>
          {filtered && (
            <Button onPress={() => changeScope("movers")}>重置</Button>
          )}
          <View style={{ flex: 1 }}>
            <Button selected onPress={() => setFiltering(false)}>
              完成
            </Button>
          </View>
        </View>
      </Sheet>
    </Glass>
  );
}

/** The Web's observation row: logo, ticker and tag, name, trend, price and change. */
function WatchRow({
  symbol,
  name,
  tag,
  price,
  changePercent,
  range,
  revision,
  first,
}: {
  symbol: string;
  name?: string;
  tag?: string | null;
  price?: number | null;
  changePercent?: number | null;
  range: RangeKey;
  revision: number;
  first: boolean;
}) {
  const t = useTheme();
  const { locale } = usePreferences();
  const known = price != null;
  const q = useResource(`watch-quote:${symbol}:${revision}`, (signal) =>
    known ? Promise.resolve(null) : quote(symbol, signal),
  );
  const value = price ?? q.data?.current_price ?? null;
  const move = known ? changePercent : (q.data?.change_percent ?? null);
  const region = locale === "en" ? "en-US" : "zh-CN";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${symbol} ${name ?? ""}`}
      onPress={() => router.push(`/stock/${encodeURIComponent(symbol)}`)}
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
      <CompanyLogo symbol={symbol} size={phone(32)} />
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <Copy size={14} bold localize={false}>
            {symbol}
          </Copy>
          {!!tag && (
            <View
              style={{
                paddingHorizontal: phone(6),
                paddingVertical: 1,
                borderRadius: 999,
                backgroundColor: t.wash,
                flexShrink: 1,
              }}
            >
              <Copy size={11} muted lines={1}>
                {tag}
              </Copy>
            </View>
          )}
        </View>
        <Copy size={11} muted lines={1} localize={false}>
          {name ?? q.data?.name ?? ""}
        </Copy>
      </View>
      <View style={{ width: phone(60) }}>
        <MiniTrend
          symbol={symbol}
          range={range}
          revision={revision}
          positive={range === "1D" && move != null ? move >= 0 : undefined}
        />
      </View>
      <View style={{ width: phone(80), alignItems: "flex-end", gap: 1 }}>
        <Copy size={14} bold localize={false}>
          {value == null
            ? "—"
            : new Intl.NumberFormat(region, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }).format(value)}
        </Copy>
        <Copy
          size={11}
          bold
          localize={false}
          color={move == null ? t.secondary : move < 0 ? t.negative : t.accent}
        >
          {move == null
            ? "—"
            : `${move > 0 ? "+" : move < 0 ? "−" : ""}${Math.abs(move).toFixed(2)}%`}
        </Copy>
      </View>
    </Pressable>
  );
}

function BuzzList({
  source,
  sort,
  rows,
  range,
  revision,
  more,
}: {
  source: BuzzSource;
  sort: "heat" | "latest";
  rows: number;
  range: RangeKey;
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
        <View>
          {list.slice(0, rows).map((symbol, index) => (
            <WatchRow
              key={symbol}
              symbol={symbol}
              name={buzzName(data, symbol)}
              tag={buzzTag(data, symbol, source)}
              range={range}
              revision={revision}
              first={index === 0}
            />
          ))}
        </View>
      )}
      {list.length > rows && <Button onPress={more}>显示更多</Button>}
    </View>
  );
}

function CoreList({
  sector,
  rows,
  range,
  revision,
  more,
}: {
  sector: string;
  rows: number;
  range: RangeKey;
  revision: number;
  more: () => void;
}) {
  const list = CORE_STOCKS.filter(
    (stock) => sector === "all" || stock.sector === sector,
  );
  return (
    <View style={{ gap: 8 }}>
      <View>
        {list.slice(0, rows).map((stock, index) => (
          <WatchRow
            key={stock.symbol}
            symbol={stock.symbol}
            name={stock.name}
            tag={STOCK_SECTORS.find((item) => item.key === stock.sector)?.zh}
            range={range}
            revision={revision}
            first={index === 0}
          />
        ))}
      </View>
      {list.length > rows && <Button onPress={more}>显示更多</Button>}
    </View>
  );
}

function DiscoveryList({
  scope,
  sort,
  rows,
  range,
  revision,
  more,
}: {
  scope: "movers" | "active";
  sort: string;
  rows: number;
  range: RangeKey;
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
        <View>
          {items.slice(0, rows).map((item, index) => (
            <WatchRow
              key={item.symbol}
              symbol={item.symbol}
              name={item.name}
              price={item.price}
              changePercent={item.changePercent}
              tag={
                scope === "active" && item.volumeMultiple != null
                  ? `${item.volumeMultiple.toFixed(2)}倍量`
                  : null
              }
              range={range}
              revision={revision}
              first={index === 0}
            />
          ))}
        </View>
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

function buzzName(data: BuzzData, symbol: string) {
  return (
    data.youtube?.find((row) => row.ticker === symbol)?.company_name ??
    data.reddit?.find((row) => row.ticker === symbol)?.name
  );
}

/** The Web's stockEntryTag for creator scope: the chosen source's count comes first. */
function buzzTag(data: BuzzData, symbol: string, source: BuzzSource) {
  const youtube = data.youtube?.find((row) => row.ticker === symbol)
    ?.discussion_heat?.recent;
  const reddit = data.reddit?.find((row) => row.ticker === symbol)?.mentions;
  const x = data.x?.find((row) => row.ticker === symbol)?.posts;
  const tags = {
    youtube: youtube ? `${youtube}条观点` : null,
    reddit: reddit ? `Reddit ${reddit.toLocaleString("en-US")}` : null,
    x: x ? `X ${x}帖` : null,
  };
  const keys = ["youtube", "reddit", "x"] as const;
  const order =
    source === "all" ? keys : [source, ...keys.filter((key) => key !== source)];
  return order.map((key) => tags[key]).find(Boolean) ?? null;
}
