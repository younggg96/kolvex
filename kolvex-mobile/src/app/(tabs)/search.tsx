import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ResultRowsSkeleton, TextLine } from "../../components/Skeletons";
import type { ComponentRef, ReactNode } from "react";
import {
  Keyboard,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Chip, Copy, LoadingStatus } from "../../components/UI";
import {
  Pill,
  PillRow,
  ResultRow,
  SearchGroup,
} from "../../components/search/SearchSections";
import { useDockSearch } from "../../components/Dock";
import { briefs, news, reports } from "../../lib/contentApi";
import type { TradingAnalysis } from "../../lib/contentTypes";
import { catalogue, xCreators } from "../../lib/featureApi";
import { useText } from "../../lib/i18n";
import { safeExternal } from "../../lib/links";
import { companyNames, isSymbol } from "../../lib/models";
import { redditRanking } from "../../lib/reddit";
import {
  useSearchHistory,
  type SearchHistoryItem,
} from "../../lib/useSearchHistory";
import { useTheme } from "../../lib/theme";
import { useResource } from "../../lib/useResource";
import { useAuth } from "../../state/Auth";
import { useWatchlist } from "../../state/Watchlist";

type Filter = "all" | "stocks" | "creators" | "research";
type StockResult = { ticker: string; name: string };

const PILL_COUNT = 8;
const NEWS_COUNT = 3;
const BRIEF_COUNT = 2;
const RESULT_LIMIT = 8;
const RESEARCH_LIMIT = 5;
const RESEARCH_DEBOUNCE_MS = 250;
/** Fallback until the dock reports how tall its recent-search strip rendered. */
const RECENT_FALLBACK_HEIGHT = 52;
const X_ICON = { ios: "xmark", android: "close", web: "close" } as const;
const FILTERS: [Filter, string][] = [
  ["all", "全部"],
  ["stocks", "股票"],
  ["creators", "创作者"],
  ["research", "AI 研究"],
];

const go = (href: string) => router.push(href as never);
const stockHref = (ticker: string) => `/stock/${encodeURIComponent(ticker)}`;
const reportItem = (report: TradingAnalysis) => ({
  href: `/report/${encodeURIComponent(report.id)}`,
  title: `${report.ticker} 研究报告`,
  detail: report.trade_date,
});

/** Lower scores list first; null means the stock doesn't match. */
function stockMatchScore({ ticker, name }: StockResult, query: string) {
  const symbol = ticker.toLowerCase();
  const company = name.toLowerCase();
  if (symbol === query) return 0;
  if (symbol.startsWith(query)) return 1;
  if (company.startsWith(query)) return 2;
  if (company.includes(` ${query}`)) return 3;
  return company.includes(query) ? 4 : null;
}

function WatchToggle({ ticker }: { ticker: string }) {
  const t = useTheme();
  const text = useText();
  const { symbols, pending, toggle } = useWatchlist();
  const watched = symbols.includes(ticker);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: watched, disabled: pending }}
      accessibilityLabel={text(
        watched ? `从自选移除 ${ticker}` : `将 ${ticker} 加入自选`,
      )}
      disabled={pending}
      onPress={() => toggle(ticker)}
      style={{
        width: 44,
        height: 44,
        marginRight: -8,
        alignItems: "center",
        justifyContent: "center",
        opacity: pending ? 0.4 : 1,
      }}
    >
      <SymbolView
        name={
          watched
            ? { ios: "star.fill", android: "star", web: "star" }
            : { ios: "star", android: "star", web: "star" }
        }
        size={22}
        tintColor={watched ? t.accent : t.secondary}
      />
    </Pressable>
  );
}

/** Recent searches sit directly above the dock field; the screen leaves them room. */
function RecentSearches({
  history,
  onClear,
  onMeasure,
}: {
  history: SearchHistoryItem[];
  onClear: () => void;
  onMeasure: (height: number) => void;
}) {
  const t = useTheme();
  const text = useText();
  if (history.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      onLayout={(event) => onMeasure(event.nativeEvent.layout.height)}
      style={{ marginHorizontal: -16, flexGrow: 0 }}
      contentContainerStyle={{
        gap: 8,
        paddingHorizontal: 16,
        paddingBottom: 8,
        alignItems: "center",
      }}
    >
      <Copy size={14} muted>
        最近搜索
      </Copy>
      {history.map((item) => (
        <Pressable
          key={item.href}
          accessibilityRole="button"
          onPress={() => {
            go(item.href);
          }}
          style={({ pressed }) => ({
            height: 36,
            maxWidth: 220,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingLeft: 12,
            paddingRight: 4,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: t.border,
            backgroundColor: pressed ? t.border : t.tint,
          })}
        >
          <Copy size={14} localize={false} lines={1}>
            {item.title}
          </Copy>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={text(`从最近搜索中移除 ${item.title}`)}
            onPress={() => onClear()}
            hitSlop={8}
            style={{
              width: 28,
              height: 28,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <SymbolView name={X_ICON} size={12} tintColor={t.secondary} />
          </Pressable>
        </Pressable>
      ))}
      <Pressable
        accessibilityRole="button"
        onPress={onClear}
        style={{
          minHeight: 44,
          justifyContent: "center",
          paddingHorizontal: 4,
        }}
      >
        <Copy size={14} muted>
          清除
        </Copy>
      </Pressable>
    </ScrollView>
  );
}

export default function Search() {
  const t = useTheme();
  const text = useText();
  const insets = useSafeAreaInsets();
  const user = useAuth().session?.user.id;
  const [value, setValue] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [submitFailed, setSubmitFailed] = useState(false);
  const [recentHeight, setRecentHeight] = useState(RECENT_FALLBACK_HEIGHT);
  const [research, setResearch] = useState<{
    ticker: string;
    items: TradingAnalysis[];
  } | null>(null);
  const { history, replace: setHistory, remember } = useSearchHistory(user);

  const opinions = useResource("search-opinions", (signal) =>
    catalogue(signal),
  );
  const reddit = useResource("search-reddit", (signal) =>
    redditRanking("all-stocks", signal),
  );
  const creators = useResource("search-x-creators", xCreators);
  const latestReports = useResource(`search-reports:${user}`, (signal) =>
    user
      ? reports(signal, user, 0, "", PILL_COUNT)
      : Promise.resolve({ items: [] as TradingAnalysis[] }),
  );
  const latestNews = useResource("search-news", (signal) => news(signal));
  const latestBriefs = useResource(`search-briefs:${user}`, (signal) =>
    user ? briefs(signal, user, 1, "all") : Promise.resolve(null),
  );

  function open(item: { title: string; detail: string; href: string }) {
    remember(item);
    go(item.href);
  }
  const openStock = ({ ticker, name }: StockResult) =>
    open({ title: name, detail: ticker, href: stockHref(ticker) });
  function openExternal(link: string) {
    const safe = safeExternal(link);
    if (safe) void Linking.openURL(safe).catch(() => undefined);
  }

  const query = value.trim().toLowerCase();
  const stockCatalogue = useMemo(() => {
    const stocks = new Map<string, StockResult>();
    for (const [ticker, name] of Object.entries(companyNames))
      stocks.set(ticker, { ticker, name });
    for (const stock of opinions.data?.stocks ?? [])
      if (!stocks.has(stock.ticker))
        stocks.set(stock.ticker, { ticker: stock.ticker, name: stock.ticker });
    for (const stock of reddit.data?.results ?? [])
      stocks.set(stock.ticker, { ticker: stock.ticker, name: stock.name });
    return [...stocks.values()];
  }, [opinions.data, reddit.data]);

  const stockResults = useMemo(() => {
    if (!query) return [];
    const matches = stockCatalogue
      .map((stock) => ({ stock, score: stockMatchScore(stock, query) }))
      .filter(
        (match): match is { stock: StockResult; score: number } =>
          match.score !== null,
      )
      .sort((a, b) => a.score - b.score)
      .map((match) => match.stock);
    // Tickers outside the catalogue still open directly: coverage doesn't limit lookup.
    const typed = query.toUpperCase();
    if (isSymbol(typed) && !matches.some((stock) => stock.ticker === typed))
      matches.unshift({ ticker: typed, name: typed });
    return matches.slice(0, RESULT_LIMIT);
  }, [stockCatalogue, query]);

  const creatorResults = useMemo(() => {
    if (!query) return [];
    const youtube = (opinions.data?.creators ?? [])
      .filter((creator) => creator.channel_title?.toLowerCase().includes(query))
      .map((creator) => ({
        key: `youtube:${creator.channel_id}`,
        title: creator.channel_title || creator.channel_id,
        detail: "YouTube",
        href: `/creator/youtube/${encodeURIComponent(creator.channel_id)}`,
      }));
    const x = (creators.data?.creators ?? [])
      .filter(
        (creator) =>
          creator.display_name?.toLowerCase().includes(query) ||
          creator.username.toLowerCase().includes(query),
      )
      .map((creator) => ({
        key: `x:${creator.username}`,
        title: creator.display_name || `@${creator.username}`,
        detail: `@${creator.username}`,
        href: `/creator/x/${encodeURIComponent(creator.username)}`,
      }));
    return [...youtube, ...x].slice(0, RESULT_LIMIT);
  }, [opinions.data, creators.data, query]);

  const youtubePicks = useMemo(
    () =>
      [...(opinions.data?.stocks ?? [])]
        .sort((a, b) => b.total_opinions - a.total_opinions)
        .slice(0, PILL_COUNT),
    [opinions.data],
  );
  const youtubeCreatorPicks = useMemo(
    () =>
      [...(opinions.data?.creators ?? [])]
        .sort((a, b) => b.total_opinions - a.total_opinions)
        .slice(0, PILL_COUNT),
    [opinions.data],
  );
  const redditPicks = (reddit.data?.results ?? []).slice(0, PILL_COUNT);
  const xPicks = (creators.data?.creators ?? []).slice(0, PILL_COUNT);
  const reportPicks = latestReports.data?.items ?? [];
  const newsPicks = (latestNews.data?.articles ?? [])
    .filter((article) => safeExternal(article.link))
    .sort((a, b) => (b.publish_time ?? 0) - (a.publish_time ?? 0))
    .slice(0, NEWS_COUNT);
  const briefPicks = (latestBriefs.data?.items ?? []).slice(0, BRIEF_COUNT);

  const topTicker = stockResults[0]?.ticker;
  useEffect(() => {
    if (!topTicker || !user) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      reports(controller.signal, user, 0, topTicker, RESEARCH_LIMIT)
        .then((response) =>
          setResearch({ ticker: topTicker, items: response.items }),
        )
        .catch(() => {
          if (!controller.signal.aborted)
            setResearch({ ticker: topTicker, items: [] });
        });
    }, RESEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [topTicker, user]);
  const researchResults =
    research && research.ticker === topTicker ? research.items : [];

  const catalogueLoading =
    opinions.loading || reddit.loading || creators.loading;
  const catalogueFailed = Boolean(
    opinions.error || reddit.error || creators.error,
  );
  const picksLoading =
    catalogueLoading ||
    latestReports.loading ||
    latestNews.loading ||
    latestBriefs.loading;
  const showStocks =
    (filter === "all" || filter === "stocks") && stockResults.length > 0;
  const showCreators =
    (filter === "all" || filter === "creators") && creatorResults.length > 0;
  const showResearch =
    (filter === "all" || filter === "research") && researchResults.length > 0;
  const hasResults = showStocks || showCreators || showResearch;

  const stockPick = (stock: StockResult) =>
    openStock({ ticker: stock.ticker, name: stock.name });

  // Bottom-up: results above the dock, then recent searches, then the discovery
  // blocks (most specific first) so the primary content sits closest to the hand.
  let lists: ReactNode[];
  if (query) {
    const groups: ReactNode[] = [];
    if (showStocks)
      groups.push(
        <SearchGroup title="股票" key="stocks">
          <View>
            {stockResults.map((stock) => (
              <ResultRow
                key={stock.ticker}
                title={stock.name}
                detail={
                  stock.name === stock.ticker
                    ? text("打开股票页")
                    : stock.ticker
                }
                onPress={() => openStock(stock)}
                trailing={<WatchToggle ticker={stock.ticker} />}
              />
            ))}
          </View>
        </SearchGroup>,
      );
    if (showCreators)
      groups.push(
        <SearchGroup title="创作者" key="creators">
          <View>
            {creatorResults.map(({ key, ...creator }) => (
              <ResultRow
                key={key}
                title={creator.title}
                detail={creator.detail}
                onPress={() => open(creator)}
              />
            ))}
          </View>
        </SearchGroup>,
      );
    if (showResearch)
      groups.push(
        <SearchGroup title="AI 研究" key="research">
          <View>
            {researchResults.map((report) => {
              const item = reportItem(report);
              return (
                <ResultRow
                  key={report.id}
                  title={text(item.title)}
                  detail={item.detail}
                  onPress={() => open(item)}
                />
              );
            })}
          </View>
        </SearchGroup>,
      );
    if (catalogueLoading && !hasResults)
      groups.push(
        <LoadingStatus key="loading">
          <View style={{ gap: 12 }}>
            <TextLine size={16} width={48} />
            <ResultRowsSkeleton count={5} trailing />
          </View>
        </LoadingStatus>,
      );
    if (!catalogueLoading && !hasResults)
      groups.push(
        <Copy size={14} muted key="empty">
          {filter === "all"
            ? `没有找到“${value.trim()}”。试试股票代码或公司名称。`
            : "这个分类下没有结果，切换到“全部”看看其他内容。"}
        </Copy>,
      );
    if (catalogueFailed)
      groups.push(
        <Copy size={14} muted key="partial">
          部分来源暂时不可用，结果可能不完整。
        </Copy>,
      );
    lists = [...groups.reverse()];
    lists.push(
      <ScrollView
        key="filters"
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={{ marginHorizontal: -16, maxHeight: 44 }}
        contentContainerStyle={{ gap: 4, paddingHorizontal: 16 }}
      >
        {FILTERS.map(([key, label]) => (
          <Chip
            key={key}
            selected={filter === key}
            onPress={() => setFilter(key)}
          >
            {label}
          </Chip>
        ))}
      </ScrollView>,
    );
  } else {
    const blocks: ReactNode[] = [];
    if (youtubePicks.length > 0)
      blocks.push(
        <SearchGroup
          key="youtube-stocks"
          title="YouTube 博主热议"
          action="查看全部"
          onAction={() => go("/opinions")}
        >
          <PillRow>
            {youtubePicks.map((stock) => (
              <Pill
                key={stock.ticker}
                label={stock.ticker}
                onPress={() =>
                  stockPick({ ticker: stock.ticker, name: stock.ticker })
                }
              />
            ))}
          </PillRow>
        </SearchGroup>,
      );
    if (youtubeCreatorPicks.length > 0)
      blocks.push(
        <SearchGroup
          key="youtube-creators"
          title="YouTube 热门博主"
          action="查看全部"
          onAction={() => go("/creators")}
        >
          <PillRow>
            {youtubeCreatorPicks.map((creator) => {
              const name = creator.channel_title || creator.channel_id;
              return (
                <Pill
                  key={creator.channel_id}
                  label={name}
                  onPress={() =>
                    open({
                      title: name,
                      detail: "YouTube",
                      href: `/creator/youtube/${encodeURIComponent(creator.channel_id)}`,
                    })
                  }
                />
              );
            })}
          </PillRow>
        </SearchGroup>,
      );
    if (redditPicks.length > 0)
      blocks.push(
        <SearchGroup
          key="reddit"
          title="Reddit 讨论最热"
          action="查看全部"
          onAction={() => go("/opinions")}
        >
          <PillRow>
            {redditPicks.map((stock) => (
              <Pill
                key={stock.ticker}
                label={stock.ticker}
                onPress={() => stockPick(stock)}
              />
            ))}
          </PillRow>
        </SearchGroup>,
      );
    if (xPicks.length > 0)
      blocks.push(
        <SearchGroup
          key="x"
          title="X 创作者"
          action="查看全部"
          onAction={() => go("/creators")}
        >
          <PillRow>
            {xPicks.map((creator) => {
              const title = creator.display_name || `@${creator.username}`;
              return (
                <Pill
                  key={creator.username}
                  label={title}
                  onPress={() =>
                    open({
                      title,
                      detail: `@${creator.username}`,
                      href: `/creator/x/${encodeURIComponent(creator.username)}`,
                    })
                  }
                />
              );
            })}
          </PillRow>
        </SearchGroup>,
      );
    if (reportPicks.length > 0)
      blocks.push(
        <SearchGroup
          key="reports"
          title="最新研究"
          action="查看全部"
          onAction={() => go("/research")}
        >
          <PillRow>
            {reportPicks.map((report) => {
              const item = reportItem(report);
              return (
                <Pill
                  key={report.id}
                  label={text(item.title)}
                  onPress={() => open(item)}
                />
              );
            })}
          </PillRow>
        </SearchGroup>,
      );
    if (newsPicks.length > 0)
      blocks.push(
        <SearchGroup
          key="news"
          title="最新新闻"
          action="查看全部"
          onAction={() => go("/news")}
        >
          <View>
            {newsPicks.map((article) => (
              <ResultRow
                key={article.id ?? article.uuid ?? article.link}
                title={article.title_zh || article.title}
                detail={article.publisher ?? text("新闻来源")}
                onPress={() => openExternal(article.link)}
              />
            ))}
          </View>
        </SearchGroup>,
      );
    if (briefPicks.length > 0)
      blocks.push(
        <SearchGroup
          key="briefs"
          title="最新日报"
          action="查看全部"
          onAction={() => go("/briefs")}
        >
          <View>
            {briefPicks.map((brief) => {
              const item = {
                href: `/brief/${encodeURIComponent(brief.id)}`,
                title: brief.headline || brief.title,
                detail: brief.brief_date,
              };
              return (
                <ResultRow
                  key={brief.id}
                  title={item.title}
                  detail={item.detail}
                  onPress={() => open(item)}
                />
              );
            })}
          </View>
        </SearchGroup>,
      );
    if (picksLoading)
      blocks.push(
        <LoadingStatus key="loading">
          <View style={{ gap: 12 }}>
            <TextLine size={16} width={120} />
            <ResultRowsSkeleton count={5} />
          </View>
        </LoadingStatus>,
      );
    lists = blocks.reverse();
    const recent = [
      ...history.map((item) => ({
        key: `history:${item.href}`,
        title: item.title,
        detail: item.detail,
        onPress: () => open(item),
      })),
      ...stockResults.slice(0, PILL_COUNT).map((stock) => ({
        key: `stock:${stock.ticker}`,
        title: stock.name,
        detail: stock.ticker,
        onPress: () => stockPick(stock),
      })),
      ...creatorResults.slice(0, PILL_COUNT).map((creator) => ({
        key: `creator:${creator.key}`,
        title: creator.title,
        detail: creator.detail,
        onPress: () => open(creator),
      })),
    ].slice(0, PILL_COUNT);
    // A compact strip keeps the workspace bottom-first: long lists push the
    // newest block off-screen, while chips stay a single row.
    if (recent.length > 0)
      lists.unshift(
        <SearchGroup
          key="recent"
          title="最近搜索"
          action="清除"
          onAction={() => setHistory([])}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={{ marginHorizontal: -16 }}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
          >
            {recent.map((item) => (
              <Pill key={item.key} label={item.title} onPress={item.onPress} />
            ))}
          </ScrollView>
        </SearchGroup>,
      );
  }

  function changeValue(next: string) {
    setValue(next);
    setSubmitFailed(false);
  }
  function submit() {
    const top = stockResults[0];
    if (!top) {
      if (query) setSubmitFailed(true);
      return;
    }
    remember({
      title: top.name,
      detail: top.ticker,
      href: stockHref(top.ticker),
    });
    changeValue("");
    openStock(top);
  }
  function cancel() {
    Keyboard.dismiss();
    changeValue("");
    if (router.canGoBack()) router.back();
    else router.navigate("/");
  }
  // The dock renders the field above the keyboard; back clears the query first.
  function back() {
    if (!value) return true;
    changeValue("");
    return false;
  }

  const field = useRef<ComponentRef<typeof TextInput>>(null);
  const { hold, release } = useDockSearch("search", {
    field: (
      <View
        style={{
          flex: 1,
          height: 46,
          flexDirection: "row",
          alignItems: "center",
          borderRadius: 23,
          borderWidth: 1,
          borderColor: t.border,
          backgroundColor: t.tint,
          paddingLeft: 14,
        }}
      >
        <SymbolView
          name={{ ios: "magnifyingglass", android: "search", web: "search" }}
          size={18}
          tintColor={t.text}
        />
        <TextInput
          ref={field}
          value={value}
          onChangeText={changeValue}
          onSubmitEditing={submit}
          accessibilityLabel={text("搜索股票和创作者")}
          placeholder={text("搜索股票、公司、创作者")}
          placeholderTextColor={t.secondary}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          returnKeyType="search"
          maxLength={40}
          style={{
            flex: 1,
            height: "100%",
            paddingHorizontal: 12,
            fontSize: 16,
            color: t.text,
          }}
        />
        {!!value && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={text("清空搜索")}
            onPress={() => {
              changeValue("");
              field.current?.focus();
            }}
            style={{
              width: 44,
              height: 44,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <SymbolView
              name={{ ios: "xmark", android: "close", web: "close" }}
              size={14}
              tintColor={t.secondary}
            />
          </Pressable>
        )}
      </View>
    ),
    recent: (
      <RecentSearches
        history={history}
        onClear={() => setHistory([])}
        onMeasure={setRecentHeight}
      />
    ),
    onCancel: cancel,
    onBack: back,
  });

  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  useFocusEffect(
    useCallback(() => {
      hold();
      return () => release();
    }, [hold, release]),
  );

  return (
    <ScrollView
      ref={scroll}
      style={{ flex: 1, backgroundColor: t.background }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      // The dock grows by its field and the recent searches above it; both
      // keyboard insets and this padding keep the lists clear of it.
      automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingTop: Platform.OS === "android" ? insets.top + 16 : 16,
        paddingBottom:
          insets.bottom + 100 + (history.length ? recentHeight : 0),
        flexGrow: 1,
        justifyContent: "space-between",
        gap: 24,
      }}
    >
      {submitFailed && (
        <View accessibilityRole="alert" style={{ paddingLeft: 16 }}>
          <Copy size={14} color={t.negative}>
            没有匹配的股票。试试股票代码，如 AAPL、BRK-B。
          </Copy>
        </View>
      )}
      {lists}
    </ScrollView>
  );
}
