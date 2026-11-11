import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { useCallback, useRef, useState, type ComponentRef } from "react";
import {
  AppState,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CompanyLogo } from "../../components/CompanyLogo";
import { MiniTrend } from "../../components/MarketCards";
import { QuoteRowsSkeleton } from "../../components/Skeletons";
import {
  Button,
  Chip,
  Copy,
  Failure,
  Glass,
  LoadingStatus,
  Page,
  PendingValue,
  Skeleton,
  phone,
} from "../../components/UI";
import { quote } from "../../lib/api";
import { useText } from "../../lib/i18n";
import { CORE_STOCKS } from "../../lib/marketDiscovery";
import type { Quote } from "../../lib/models";
import { money } from "../../lib/paperTrading";
import { useTheme } from "../../lib/theme";
import { useResource } from "../../lib/useResource";
import { useWatchlist } from "../../state/Watchlist";

const PAGE_SIZE = 20;
const SORTS = [
  ["added", "最近添加"],
  ["symbol", "代码 A–Z"],
  ["gainers", "涨幅优先"],
  ["losers", "跌幅优先"],
] as const;
const companyNames = new Map<string, string>(
  CORE_STOCKS.map(({ symbol, name }) => [symbol, name]),
);
const columns = {
  trend: { width: 60, alignItems: "center" },
  price: { width: 80, alignItems: "flex-end" },
} as const;
const iconSize = phone(16);
const compactButton = phone(36);

async function loadQuotes(symbols: string[], signal: AbortSignal) {
  const quotes: Record<string, Quote> = {};
  for (let start = 0; start < symbols.length && !signal.aborted; start += 8) {
    await Promise.all(
      symbols.slice(start, start + 8).map(async (symbol) => {
        const data = await quote(symbol, signal).catch(() => null);
        if (data) quotes[symbol] = data;
      }),
    );
  }
  return quotes;
}

function IconButton({
  label,
  icon,
  onPress,
  size = compactButton,
  disabled = false,
  glass = false,
  primary = false,
  marked = false,
}: {
  label: string;
  icon: SymbolViewProps["name"];
  onPress: () => void;
  size?: number;
  disabled?: boolean;
  glass?: boolean;
  primary?: boolean;
  marked?: boolean;
}) {
  const t = useTheme();
  const text = useText();
  const symbol = (
    <SymbolView
      name={icon}
      size={iconSize}
      tintColor={primary ? t.onBrand : glass ? t.text : t.secondary}
    />
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={text(label)}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={Math.max(0, (44 - size) / 2)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.center,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: primary ? t.brand : undefined,
          opacity: disabled ? 0.45 : pressed ? 0.65 : 1,
        },
      ]}
    >
      {glass ? (
        <Glass
          style={[
            styles.center,
            { width: size, height: size, borderRadius: size / 2 },
          ]}
        >
          {symbol}
        </Glass>
      ) : (
        symbol
      )}
      {marked && (
        <View
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: phone(10),
            height: phone(10),
            borderRadius: phone(5),
            borderColor: t.background,
            borderWidth: phone(2),
            backgroundColor: t.text,
          }}
        />
      )}
    </Pressable>
  );
}

export default function Watchlist() {
  const t = useTheme();
  const text = useText();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const list = useWatchlist();
  const { q: query = "", sort: sortParam } = useLocalSearchParams<{
    q?: string;
    sort?: string;
  }>();
  const sort = SORTS.find(([key]) => key === sortParam) ?? SORTS[0];
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const [ticker, setTicker] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [notice, setNotice] = useState("");
  const [sortOpen, setSortOpen] = useState(false);
  const [pagination, setPagination] = useState({
    query,
    sort: sort[0],
    count: PAGE_SIZE,
  });
  const [revision, setRevision] = useState(0);
  const rows =
    pagination.query === query && pagination.sort === sort[0]
      ? pagination.count
      : PAGE_SIZE;
  const canEdit = list.cloud && list.ready && !list.pending;
  const showTrend = width >= 400;
  const quotes = useResource(
    `watchlist-quotes:${list.symbols.join(",")}`,
    (signal) => loadQuotes(list.symbols, signal),
    30_000,
  );
  const refreshQuotes = quotes.refresh;
  const hasSymbols = list.symbols.length > 0;
  useFocusEffect(
    useCallback(() => {
      if (!hasSymbols || quotes.loading) return;
      const interval = setInterval(() => {
        if (AppState.currentState === "active") refreshQuotes();
      }, 15_000);
      return () => clearInterval(interval);
    }, [hasSymbols, quotes.loading, refreshQuotes]),
  );

  const term = query.trim().replace(/^\$/, "").toLowerCase();
  const filtered = list.symbols
    .slice()
    .reverse()
    .filter((symbol) => {
      return `${symbol} ${quotes.data?.[symbol]?.name ?? companyNames.get(symbol) ?? ""}`
        .toLowerCase()
        .includes(term);
    })
    .sort((left, right) => {
      if (sort[0] === "added") return 0;
      if (sort[0] === "symbol") return left.localeCompare(right);
      const a = quotes.data?.[left]?.change_percent;
      const b = quotes.data?.[right]?.change_percent;
      if (a == null || !Number.isFinite(a))
        return b == null || !Number.isFinite(b) ? left.localeCompare(right) : 1;
      if (b == null || !Number.isFinite(b)) return -1;
      return sort[0] === "gainers" ? b - a : a - b;
    });
  const unavailable =
    !quotes.loading &&
    list.symbols.some((symbol) => quotes.data?.[symbol]?.current_price == null);

  function refresh() {
    refreshQuotes();
    setRevision((value) => value + 1);
  }

  function updateSort(value: (typeof SORTS)[number][0]) {
    router.setParams({ sort: value === "added" ? "" : value });
    setPagination({ query, sort: value, count: PAGE_SIZE });
  }

  async function addTicker() {
    if (!canEdit) return;
    const symbol = ticker.trim().replace(/^\$/, "").toUpperCase();
    setNotice("");
    if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol)) {
      setInvalid(true);
      input.current?.focus();
      return;
    }
    if (list.symbols.includes(symbol)) {
      setNotice(`${symbol} 已在自选股中`);
      input.current?.focus();
      return;
    }
    if (await list.add(symbol)) {
      setTicker("");
      setInvalid(false);
      router.setParams({ q: "" });
      setPagination({ query: "", sort: sort[0], count: PAGE_SIZE });
      setNotice(`已将 ${symbol} 加入自选股`);
      input.current?.focus();
    }
  }

  return (
    <Page
      title="自选股"
      hideTitle
      refreshing={list.pending}
      onRefresh={() => {
        list.refresh();
        refresh();
      }}
    >
      <View
        style={{ gap: phone(24), marginHorizontal: 2, paddingTop: phone(8) }}
      >
        <View style={[styles.row, { alignItems: "flex-start" }]}>
          <Copy size={24} bold>
            自选股
          </Copy>
          <IconButton
            label="刷新自选股行情"
            icon={{
              ios: "arrow.clockwise",
              android: "refresh",
              web: "refresh",
            }}
            disabled={!list.ready || quotes.loading || !hasSymbols}
            onPress={refresh}
          />
        </View>
        <View style={{ gap: phone(8) }}>
          <Copy size={14}>添加股票</Copy>
          <View
            style={[styles.row, { gap: phone(8), alignItems: "flex-start" }]}
          >
            <Glass
              style={{
                flex: 1,
                borderRadius: 999,
                flexDirection: "row",
                alignItems: "center",
                paddingLeft: 14,
              }}
            >
              <TextInput
                ref={input}
                accessibilityLabel={text("添加股票")}
                editable={!list.pending}
                value={ticker}
                onChangeText={(value) => {
                  setTicker(value);
                  setInvalid(false);
                  setNotice("");
                }}
                placeholder={text("输入股票代码，如 AAPL、BRK-B")}
                placeholderTextColor={t.secondary}
                autoCapitalize="characters"
                autoCorrect={false}
                spellCheck={false}
                maxLength={20}
                returnKeyType="go"
                submitBehavior="submit"
                onSubmitEditing={() => void addTicker()}
                style={{
                  flex: 1,
                  minHeight: 44,
                  color: t.text,
                  fontSize: 16,
                  paddingVertical: phone(8),
                  paddingRight: ticker ? 0 : phone(44),
                }}
              />
              {!!ticker && (
                <IconButton
                  label="清空股票代码"
                  icon={{ ios: "xmark", android: "close", web: "close" }}
                  size={phone(44)}
                  onPress={() => {
                    setTicker("");
                    setInvalid(false);
                    setNotice("");
                    input.current?.focus();
                  }}
                />
              )}
            </Glass>
            <Button
              variant="primary"
              block={false}
              label="添加"
              disabled={!canEdit}
              onPress={() => void addTicker()}
              icon={
                <SymbolView
                  name={{ ios: "plus", android: "add", web: "add" }}
                  size={iconSize}
                  tintColor={t.onBrand}
                />
              }
            >
              添加
            </Button>
          </View>
          <View accessibilityLiveRegion="polite">
            <Copy size={12} muted color={invalid ? t.negative : undefined}>
              {invalid
                ? "请输入有效的股票代码，如 AAPL、BRK-B。"
                : notice || "与 Reddit 关注共用，登录后同步到账号。"}
            </Copy>
          </View>
        </View>
        {!!list.error && <Failure message={list.error} retry={list.refresh} />}
        {!list.ready && !list.error && (
          <Glass style={{ padding: 12, gap: 12 }}>
            <LoadingStatus>
              <Skeleton height={compactButton} />
              <QuoteRowsSkeleton />
            </LoadingStatus>
          </Glass>
        )}
        {list.ready && !hasSymbols && !list.error && (
          <Glass style={{ paddingVertical: 64, alignItems: "center", gap: 16 }}>
            <SymbolView
              name={{ ios: "star", android: "star", web: "star" }}
              size={phone(32)}
              tintColor={t.secondary}
            />
            <Copy size={18} bold>
              还没有自选股
            </Copy>
            <View style={{ paddingTop: phone(8) }}>
              <Button onPress={() => router.navigate("/")}>浏览行情</Button>
            </View>
          </Glass>
        )}
        {hasSymbols && (
          <View style={{ gap: phone(12) }}>
            <Glass clear style={{ padding: 12 }}>
              <View style={styles.row}>
                <Copy
                  size={12}
                  muted
                >{`已显示 ${Math.min(rows, filtered.length)} / ${filtered.length} 只`}</Copy>
                <IconButton
                  label={`排序 · ${text(sort[1])}`}
                  icon={{
                    ios: "slider.horizontal.3",
                    android: "tune",
                    web: "tune",
                  }}
                  glass
                  marked={sort[0] !== "added"}
                  onPress={() => setSortOpen(true)}
                />
              </View>
              <View style={{ marginTop: phone(12) }}>
                <Copy size={12} muted>
                  自选名单 · 名单内排序
                </Copy>
              </View>
              {unavailable && (
                <View style={{ marginTop: phone(12), gap: phone(8) }}>
                  <Copy size={14} muted>
                    部分报价暂不可用，请检查代码或重试，自选股仍会保留。
                  </Copy>
                  <Button onPress={refresh}>重试报价</Button>
                </View>
              )}
              <View
                style={[
                  styles.row,
                  {
                    marginTop: phone(12),
                    gap: phone(4),
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderColor: t.border,
                  },
                ]}
              >
                <View style={[styles.columns, { paddingVertical: phone(12) }]}>
                  <View style={{ flex: 1 }}>
                    <Copy size={12} muted>
                      股票
                    </Copy>
                  </View>
                  {showTrend && (
                    <View style={columns.trend}>
                      <Copy size={12} muted>
                        走势 · 1天
                      </Copy>
                    </View>
                  )}
                  <View style={columns.price}>
                    <Copy size={12} muted>
                      价格 / 今日
                    </Copy>
                  </View>
                </View>
                <View style={[styles.center, { width: compactButton }]}>
                  <Copy size={12} muted>
                    自选
                  </Copy>
                </View>
              </View>
              {filtered.slice(0, rows).map((symbol) => {
                const current = quotes.data?.[symbol];
                const move = current?.change_percent;
                const hasMove = move != null && Number.isFinite(move);
                const name = current?.name || companyNames.get(symbol);
                return (
                  <View key={symbol} style={[styles.row, { gap: phone(4) }]}>
                    <Pressable
                      accessibilityRole="link"
                      onPress={() =>
                        router.push({
                          pathname: "/stock/[symbol]",
                          params: { symbol, from: "watchlist" },
                        })
                      }
                      style={({ pressed }) => [
                        styles.columns,
                        {
                          paddingVertical: phone(8),
                          borderRadius: phone(16),
                          backgroundColor: pressed ? t.wash : undefined,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.row,
                          { flex: 1, minWidth: 0, gap: phone(8) },
                        ]}
                      >
                        <CompanyLogo symbol={symbol} size={phone(32)} />
                        <View style={{ flex: 1, gap: phone(1) }}>
                          <Copy bold lines={1} localize={false}>
                            {symbol}
                          </Copy>
                          <Copy size={12} muted lines={1} localize={!name}>
                            {name || "查看个股详情"}
                          </Copy>
                        </View>
                      </View>
                      {showTrend && (
                        <View style={columns.trend}>
                          <MiniTrend
                            symbol={symbol}
                            range="1D"
                            revision={revision}
                          />
                        </View>
                      )}
                      <View style={[columns.price, { gap: phone(1) }]}>
                        {quotes.loading && !current ? (
                          <PendingValue height={phone(40)} />
                        ) : (
                          <>
                            <Copy localize={false}>
                              {money(current?.current_price)}
                            </Copy>
                            <Copy
                              size={12}
                              bold
                              localize={false}
                              color={
                                !hasMove || move === 0
                                  ? t.secondary
                                  : move > 0
                                    ? t.accent
                                    : t.negative
                              }
                            >
                              {hasMove
                                ? `${move > 0 ? "+" : move < 0 ? "−" : ""}${Math.abs(move).toFixed(2)}%`
                                : "—"}
                            </Copy>
                          </>
                        )}
                      </View>
                    </Pressable>
                    <IconButton
                      glass
                      label={`将 ${symbol} 移出自选股`}
                      icon={{ ios: "star.fill", android: "star", web: "star" }}
                      disabled={!canEdit}
                      onPress={() => {
                        void list.remove(symbol).then((removed) => {
                          if (removed) input.current?.focus();
                        });
                      }}
                    />
                  </View>
                );
              })}
              {filtered.length === 0 && (
                <View
                  style={{
                    alignItems: "center",
                    gap: phone(16),
                    paddingVertical: phone(48),
                  }}
                >
                  <Copy size={14} muted>
                    没有符合搜索条件的自选股。
                  </Copy>
                  <Button onPress={() => router.setParams({ q: "" })}>
                    清除搜索
                  </Button>
                </View>
              )}
              {filtered.length > rows && (
                <View
                  style={{ alignItems: "center", paddingVertical: phone(16) }}
                >
                  <Button
                    onPress={() =>
                      setPagination({
                        query,
                        sort: sort[0],
                        count: rows + PAGE_SIZE,
                      })
                    }
                  >
                    加载更多
                  </Button>
                </View>
              )}
            </Glass>
            <Copy size={12} muted>
              报价来自现有行情数据源，可能存在延迟；缺失报价显示为横线。
            </Copy>
          </View>
        )}
      </View>
      <Modal
        visible={sortOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSortOpen(false)}
      >
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            onPress={() => setSortOpen(false)}
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: "rgba(0,0,0,0.55)" },
            ]}
          />
          <Glass
            material
            style={{
              padding: 20,
              gap: 16,
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
            }}
          >
            <View
              accessibilityViewIsModal
              style={{ gap: phone(16), paddingBottom: insets.bottom }}
            >
              <View style={styles.row}>
                <Copy bold>排序</Copy>
                <IconButton
                  label="关闭"
                  icon={{ ios: "xmark", android: "close", web: "close" }}
                  primary
                  onPress={() => setSortOpen(false)}
                />
              </View>
              <View style={{ gap: phone(8) }}>
                <Copy size={12} muted>
                  排序
                </Copy>
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: phone(8),
                  }}
                >
                  {SORTS.map(([value, label]) => (
                    <Chip
                      key={value}
                      size="md"
                      selected={sort[0] === value}
                      onPress={() => updateSort(value)}
                    >
                      {label}
                    </Chip>
                  ))}
                </View>
              </View>
              <View
                style={[styles.row, { gap: phone(8), marginTop: phone(4) }]}
              >
                {sort[0] !== "added" && (
                  <Button onPress={() => updateSort("added")}>重置</Button>
                )}
                <View style={{ flex: 1 }}>
                  <Button variant="primary" onPress={() => setSortOpen(false)}>
                    完成
                  </Button>
                </View>
              </View>
            </View>
          </Glass>
        </View>
      </Modal>
    </Page>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  columns: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: phone(8),
  },
  center: { alignItems: "center", justifyContent: "center" },
});
