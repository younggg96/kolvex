// The Web's stock workspace (components/decision/StockWorkspace.tsx) at phone size:
// a back link, logo and name, "ticker · exchange · currency", the watch star, the price
// with its change and New York time, then the pill tabs over the price card and panels.
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { CompanyLogo } from "../../components/CompanyLogo";
import { StockContent } from "../../components/StockContent";
import { StockPriceCard } from "../../components/StockPriceCard";
import { TextLine } from "../../components/Skeletons";
import { Copy, Failure, LoadingStatus, Page, phone } from "../../components/UI";
import { apiRequest } from "../../lib/http";
import { BENCHMARKS } from "../../lib/marketBenchmarks";
import { isSymbol } from "../../lib/models";
import { useTheme } from "../../lib/theme";
import { useResource } from "../../lib/useResource";
import { usePreferences } from "../../state/Preferences";
import { useWatchlist } from "../../state/Watchlist";

type StockQuote = {
  symbol: string;
  name?: string;
  exchange?: string | null;
  currency?: string | null;
  current_price: number | null;
  change: number | null;
  change_percent: number | null;
  market_time?: number | null;
  market_state?: string | null;
  pre_market_price?: number | null;
  pre_market_time?: number | null;
  post_market_price?: number | null;
  post_market_time?: number | null;
};

// Prices read "$7,520.93" in both languages, as on the Web.
const money = (value: number, currency: string, _locale?: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);

const nyTime = (seconds: number, locale: string, timeOnly = false) => {
  const date = new Date(seconds * 1000);
  const options: Intl.DateTimeFormatOptions = {
    timeZone: "America/New_York",
    timeZoneName: "short",
  };
  return timeOnly
    ? date.toLocaleTimeString(locale === "en" ? "en-US" : "zh-CN", options)
    : date.toLocaleString(locale === "en" ? "en-US" : "zh-CN", options);
};

function BackLink({ label }: { label: string }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="link"
      hitSlop={10}
      onPress={() =>
        router.canGoBack() ? router.back() : router.navigate("/")
      }
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        gap: 4,
        minHeight: 32,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <SymbolView
        name={{
          ios: "chevron.left",
          android: "chevron_left",
          web: "chevron_left",
        }}
        size={12}
        weight="semibold"
        tintColor={t.secondary}
      />
      <Copy size={14} muted>
        {label}
      </Copy>
    </Pressable>
  );
}

function WatchButton({ symbol }: { symbol: string }) {
  const t = useTheme();
  const list = useWatchlist();
  const saved = list.symbols.includes(symbol);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        saved ? `将 ${symbol} 移出自选股` : `将 ${symbol} 加入自选股`
      }
      accessibilityState={{ selected: saved, disabled: !list.ready }}
      disabled={!list.ready || list.pending}
      onPress={() => list.toggle(symbol)}
      hitSlop={4}
      style={({ pressed }) => ({
        width: phone(44),
        height: phone(44),
        borderRadius: 999,
        borderWidth: 1,
        borderColor: t.rim,
        alignItems: "center",
        justifyContent: "center",
        opacity: !list.ready ? 0.5 : pressed ? 0.6 : 1,
      })}
    >
      <SymbolView
        name={{
          ios: saved ? "star.fill" : "star",
          android: "star",
          web: "star",
        }}
        size={15}
        tintColor={saved ? t.text : t.secondary}
      />
    </Pressable>
  );
}

export default function Stock() {
  const params = useLocalSearchParams<{
    symbol: string;
    tab?: string;
    from?: string;
  }>();
  const symbol = (
    typeof params.symbol === "string" ? params.symbol : ""
  ).toUpperCase();
  const valid = isSymbol(symbol);
  const t = useTheme();
  const { locale } = usePreferences();
  const list = useWatchlist();
  const [revision, setRevision] = useState(0);
  const benchmark = BENCHMARKS.find((item) => item.symbol === symbol);
  const q = useResource(`stock-quote:${symbol}:${revision}`, (signal) =>
    valid
      ? apiRequest<StockQuote>(`/market/quote/${encodeURIComponent(symbol)}`, {
          signal,
        })
      : Promise.reject(new Error("股票代码无效，请返回行情重新搜索。")),
  );
  const quote = q.data;
  const currency = quote?.currency || "USD";
  const name = benchmark
    ? locale === "en"
      ? benchmark.en
      : benchmark.zh
    : quote?.name || symbol;
  const up = (quote?.change ?? 0) >= 0;
  // The Web shows the extended-hours price beside the close when there is one.
  const extended =
    quote?.post_market_price != null && quote.post_market_time
      ? {
          price: quote.post_market_price,
          time: quote.post_market_time,
          label: "盘后",
        }
      : quote?.pre_market_price != null && quote.pre_market_time
        ? {
            price: quote.pre_market_price,
            time: quote.pre_market_time,
            label: "盘前",
          }
        : null;
  return (
    <Page
      title={symbol || "股票详情"}
      hideTitle
      refreshing={q.loading && !!q.data}
      onRefresh={() => setRevision((v) => v + 1)}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ gap: 12 }}>
        <BackLink label={params.from === "watchlist" ? "自选股" : "行情"} />
        <View
          style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}
        >
          <CompanyLogo symbol={symbol} size={phone(40)} />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Copy size={18} bold lines={2} localize={false}>
              {name}
            </Copy>
            <Copy size={12} muted localize={false}>
              {[symbol, quote?.exchange, currency].filter(Boolean).join(" · ")}
            </Copy>
          </View>
          {valid && <WatchButton symbol={symbol} />}
        </View>
        {!!q.error && <Failure message={q.error} retry={q.refresh} />}
        {q.loading && !quote ? (
          <LoadingStatus>
            <View style={{ gap: 4 }}>
              <TextLine size={24} width="40%" />
              <TextLine size={12} width="30%" />
            </View>
          </LoadingStatus>
        ) : quote ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 24 }}>
            <View style={{ gap: 2 }}>
              <Copy size={24} bold localize={false}>
                {quote.current_price == null
                  ? "—"
                  : money(quote.current_price, currency, locale)}
              </Copy>
              {quote.change != null && quote.change_percent != null && (
                <Copy
                  size={12}
                  bold
                  localize={false}
                  color={up ? t.accent : t.negative}
                >
                  {`${up ? "+" : "−"}${Math.abs(quote.change).toFixed(2)} (${up ? "+" : "−"}${Math.abs(quote.change_percent).toFixed(2)}%)`}
                </Copy>
              )}
              <Copy size={11} muted localize={!quote.market_time}>
                {quote.market_time
                  ? nyTime(quote.market_time, locale)
                  : "最新可用报价"}
              </Copy>
            </View>
            {extended && (
              <View style={{ gap: 2 }}>
                <Copy size={20} bold localize={false}>
                  {money(extended.price, currency, locale)}
                </Copy>
                <View style={{ flexDirection: "row", gap: 4 }}>
                  <Copy size={11} muted>
                    {extended.label}
                  </Copy>
                  <Copy size={11} muted localize={false}>
                    {`· ${nyTime(extended.time, locale, true)}`}
                  </Copy>
                </View>
              </View>
            )}
          </View>
        ) : null}
        {!!list.error && <Failure message={list.error} />}
      </View>
      {valid && (
        <StockContent
          key={`${symbol}:${revision}`}
          symbol={symbol}
          currency={currency}
          companyName={quote?.name}
          initialTab={typeof params.tab === "string" ? params.tab : undefined}
          chart={
            <StockPriceCard
              symbol={symbol}
              currency={currency}
              revision={revision}
            />
          }
        />
      )}
    </Page>
  );
}
