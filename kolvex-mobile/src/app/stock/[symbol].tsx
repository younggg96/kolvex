// The Web's stock workspace (components/decision/StockWorkspace.tsx) at phone size:
// a pinned back button and watch star, logo and name, "ticker · exchange · currency", the watch star, the price
// with its change and New York time, then the pill tabs over the price card and panels.
import { useState } from "react";
import { View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { CompanyLogo } from "../../components/CompanyLogo";
import { StockContent } from "../../components/StockContent";
import { StockPriceCard } from "../../components/StockPriceCard";
import { TextLine } from "../../components/Skeletons";
import {
  Copy,
  Failure,
  GlassIconButton,
  LoadingStatus,
  Page,
  phone,
} from "../../components/UI";
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

/** "11/11 16:00 EST": New York market time, the same in both languages. */
const nyTime = (seconds: number, timeOnly = false) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    ...(timeOnly ? {} : { month: "2-digit", day: "2-digit" }),
  })
    .format(new Date(seconds * 1000))
    .replace(",", "");

const signed = (value: number, digits = 2) =>
  `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(digits)}`;

function WatchButton({ symbol }: { symbol: string }) {
  const t = useTheme();
  const list = useWatchlist();
  const saved = list.symbols.includes(symbol);
  return (
    <GlassIconButton
      icon={{ ios: saved ? "star.fill" : "star", android: "star", web: "star" }}
      label={saved ? `将 ${symbol} 移出自选股` : `将 ${symbol} 加入自选股`}
      selected={saved}
      tint={saved ? t.text : t.secondary}
      disabled={!list.ready || list.pending}
      onPress={() => list.toggle(symbol)}
    />
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
  const extendedChange =
    extended && quote?.current_price
      ? ((extended.price - quote.current_price) / quote.current_price) * 100
      : null;
  return (
    <Page
      title={symbol || "股票详情"}
      hideTitle
      refreshing={q.loading && !!q.data}
      onRefresh={() => setRevision((v) => v + 1)}
      // Back and the watch star stay pinned while the page scrolls, like a nav bar.
      floatingHeader={
        <View
          style={{
            minHeight: phone(48),
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <GlassIconButton
            icon={{
              ios: "chevron.left",
              android: "chevron_left",
              web: "chevron_left",
            }}
            label={params.from === "watchlist" ? "自选股" : "行情"}
            onPress={() =>
              router.canGoBack() ? router.back() : router.navigate("/")
            }
          />
          {valid && <WatchButton symbol={symbol} />}
        </View>
      }
    >
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ gap: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <CompanyLogo symbol={symbol} size={phone(48)} />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Copy size={20} bold lines={2} localize={false}>
              {name}
            </Copy>
            <Copy size={13} muted localize={false}>
              {[name === symbol ? null : symbol, quote?.exchange, currency]
                .filter(Boolean)
                .join(" · ")}
            </Copy>
          </View>
        </View>
        {!!q.error && <Failure message={q.error} retry={q.refresh} />}
        {q.loading && !quote ? (
          <LoadingStatus>
            <View style={{ gap: 6 }}>
              <TextLine size={34} width="45%" />
              <TextLine size={14} width="35%" />
            </View>
          </LoadingStatus>
        ) : quote ? (
          <View style={{ gap: 6 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "baseline",
                flexWrap: "wrap",
                columnGap: 10,
              }}
            >
              <Copy size={34} bold localize={false}>
                {quote.current_price == null
                  ? "—"
                  : money(quote.current_price, currency, locale)}
              </Copy>
              {quote.change != null && quote.change_percent != null && (
                <Copy
                  size={16}
                  bold
                  localize={false}
                  color={up ? t.accent : t.negative}
                >
                  {`${signed(quote.change)} (${signed(quote.change_percent)}%)`}
                </Copy>
              )}
            </View>
            <Copy size={12} muted localize={!quote.market_time}>
              {quote.market_time ? nyTime(quote.market_time) : "最新可用报价"}
            </Copy>
            {extended && (
              <View
                style={{
                  alignSelf: "flex-start",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 4,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: t.wash,
                }}
              >
                <Copy size={12} muted>
                  {extended.label}
                </Copy>
                <Copy size={13} bold localize={false}>
                  {money(extended.price, currency, locale)}
                </Copy>
                {extendedChange != null && (
                  <Copy
                    size={12}
                    bold
                    localize={false}
                    color={extendedChange >= 0 ? t.accent : t.negative}
                  >
                    {`${signed(extendedChange)}%`}
                  </Copy>
                )}
                <Copy size={12} muted localize={false}>
                  {nyTime(extended.time, true)}
                </Copy>
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
