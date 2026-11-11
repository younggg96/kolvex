// The Web's MarketWatchlistCard (components/decision/MarketWatchlistCard.tsx) on a phone:
// the six most recently saved stocks, grouped by sector, with price and daily change.
import { useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { quote } from "../lib/api";
import { stockFacts } from "../lib/contentApi";
import { CORE_STOCKS, STOCK_SECTORS } from "../lib/marketDiscovery";
import type { Quote } from "../lib/models";
import { money } from "../lib/paperTrading";
import { useTheme } from "../lib/theme";
import { useResource } from "../lib/useResource";
import { usePreferences } from "../state/Preferences";
import { useWatchlist } from "../state/Watchlist";
import { CompanyLogo } from "./CompanyLogo";
import { Button, Copy, Glass, Skeleton, phone, styles } from "./UI";

const PREVIEW_SIZE = 6;
const EXTRA_SECTORS: Record<string, { en: string; zh: string }> = {
  crypto: { en: "Crypto", zh: "加密资产" },
  materials: { en: "Materials", zh: "原材料" },
  real_estate: { en: "Real estate", zh: "房地产" },
};
/** Yahoo Finance sector names → the Web's grouping keys. */
const YAHOO_SECTORS: Record<string, string> = {
  technology: "technology",
  "communication services": "communication",
  "consumer cyclical": "consumer",
  "consumer defensive": "consumer",
  "financial services": "financials",
  healthcare: "healthcare",
  energy: "energy",
  industrials: "industrials",
  utilities: "utilities",
  "basic materials": "materials",
  "real estate": "real_estate",
};
const core = new Map<string, string>(
  CORE_STOCKS.map((stock) => [stock.symbol, stock.sector]),
);

async function loadPreview(symbols: string[], signal: AbortSignal) {
  const quotes: Record<string, Quote> = {};
  const sectors: Record<string, string> = {};
  await Promise.all(
    symbols.map(async (symbol) => {
      const [data, facts] = await Promise.all([
        quote(symbol, signal).catch(() => null),
        symbol.endsWith("-USD") || core.has(symbol)
          ? null
          : stockFacts(symbol, signal).catch(() => null),
      ]);
      if (data) quotes[symbol] = data;
      sectors[symbol] = symbol.endsWith("-USD")
        ? "crypto"
        : (core.get(symbol) ??
          YAHOO_SECTORS[facts?.sector?.trim().toLowerCase() ?? ""] ??
          "other");
    }),
  );
  return { quotes, sectors };
}

/** The Web's outline icon link beside a section title (h-11 on desktop, smaller on phones). */
export function ArrowLink({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const t = useTheme();
  const size = phone(36);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={Math.max(0, (44 - size) / 2)}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1,
        borderColor: t.rim,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed ? t.wash : "transparent",
      })}
    >
      <SymbolView
        name={{
          ios: "arrow.up.right",
          android: "north_east",
          web: "north_east",
        }}
        size={phone(14)}
        tintColor={t.text}
      />
    </Pressable>
  );
}

export function MarketWatchlist({ revision }: { revision: number }) {
  const t = useTheme();
  const { locale } = usePreferences();
  const { symbols: saved, ready } = useWatchlist();
  const symbols = saved.slice(-PREVIEW_SIZE).reverse();
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const r = useResource(
    `market-watchlist:${revision}:${symbols.join(",")}`,
    (signal) => loadPreview(symbols, signal),
  );
  const groups = new Map<string, string[]>();
  for (const symbol of symbols) {
    const sector = r.data?.sectors[symbol] ?? "pending";
    groups.set(sector, [...(groups.get(sector) ?? []), symbol]);
  }
  const label = (key: string) => {
    const sector =
      STOCK_SECTORS.find((item) => item.key === key) ?? EXTRA_SECTORS[key];
    return sector
      ? locale === "en"
        ? sector.en
        : sector.zh
      : locale === "en"
        ? "Other stocks"
        : "其他股票";
  };
  const row = (symbol: string, first: boolean) => {
    const q = r.data?.quotes[symbol];
    const change = q?.change_percent;
    return (
      <Pressable
        key={symbol}
        accessibilityRole="link"
        accessibilityLabel={symbol}
        onPress={() =>
          router.push({ pathname: "/stock/[symbol]", params: { symbol } })
        }
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          minHeight: 44,
          borderTopWidth: first ? 0 : 1,
          borderColor: t.border,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <CompanyLogo symbol={symbol} size={phone(24)} />
        <View style={{ flex: 1 }}>
          <Copy size={14} bold lines={1} localize={false}>
            {symbol}
          </Copy>
        </View>
        {r.loading && !q ? (
          <Skeleton width={96} height={14} />
        ) : (
          <>
            <Copy size={14} localize={false}>
              {q?.current_price != null ? money(q.current_price) : "—"}
            </Copy>
            <View style={{ minWidth: phone(56), alignItems: "flex-end" }}>
              <Copy
                size={12}
                localize={false}
                color={
                  change == null
                    ? t.secondary
                    : change >= 0
                      ? t.accent
                      : t.negative
                }
              >
                {change == null
                  ? "—"
                  : `${change >= 0 ? "+" : "−"}${Math.abs(change).toFixed(2)}%`}
              </Copy>
            </View>
          </>
        )}
      </Pressable>
    );
  };
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.row}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Copy size={18} bold>
            自选股
          </Copy>
          {ready && (
            <View
              style={{
                borderRadius: 999,
                backgroundColor: t.wash,
                paddingHorizontal: 8,
                paddingVertical: 2,
              }}
            >
              <Copy size={12} muted localize={false}>
                {`${symbols.length}/${saved.length}`}
              </Copy>
            </View>
          )}
        </View>
        <ArrowLink
          label="查看全部自选股"
          onPress={() => router.push("/watchlist")}
        />
      </View>
      <Glass clear style={{ padding: 12 }}>
        {!ready ? (
          <View style={{ gap: 12, paddingVertical: 8 }}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={16} />
            ))}
          </View>
        ) : !symbols.length ? (
          <View style={{ alignItems: "center", gap: 12, paddingVertical: 16 }}>
            <Copy size={14} bold>
              添加第一只自选股
            </Copy>
            <Button size="sm" onPress={() => router.push("/watchlist")}>
              管理自选股
            </Button>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {[...groups].map(([sector, stocks]) =>
              sector === "pending" ? (
                <View key={sector}>
                  {stocks.map((symbol, i) => row(symbol, i === 0))}
                </View>
              ) : (
                <View key={sector}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: !closed[sector] }}
                    onPress={() =>
                      setClosed((value) => ({
                        ...value,
                        [sector]: !value[sector],
                      }))
                    }
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      minHeight: 32,
                    }}
                  >
                    <SymbolView
                      name={{
                        ios: closed[sector] ? "chevron.right" : "chevron.down",
                        android: closed[sector]
                          ? "chevron_right"
                          : "expand_more",
                        web: closed[sector] ? "chevron_right" : "expand_more",
                      }}
                      size={phone(11)}
                      tintColor={t.secondary}
                    />
                    <Copy size={12} muted localize={false}>
                      {label(sector)}
                    </Copy>
                  </Pressable>
                  {!closed[sector] &&
                    stocks.map((symbol, i) => row(symbol, i === 0))}
                </View>
              ),
            )}
          </View>
        )}
      </Glass>
    </View>
  );
}
