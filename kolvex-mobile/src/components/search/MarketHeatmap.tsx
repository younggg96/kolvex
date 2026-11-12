// The Search tab's market heatmap: the curated core stocks grouped by sector, each
// tile sized by market cap and coloured by its change, like a sector map.
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { quote } from "../../lib/api";
import { CORE_STOCKS, STOCK_SECTORS } from "../../lib/marketDiscovery";
import type { Quote } from "../../lib/models";
import { changeColor, treemap, type Rect } from "../../lib/treemap";
import { useResource } from "../../lib/useResource";
import { usePreferences } from "../../state/Preferences";
import { Copy, Skeleton } from "../UI";
import { DiscoverySection } from "./DiscoveryCards";

const GAP = 2;
const LABEL = 18;

async function loadQuotes(signal: AbortSignal) {
  const quotes: Record<string, Quote> = {};
  await Promise.all(
    CORE_STOCKS.map(async ({ symbol }) => {
      const data = await quote(symbol, signal).catch(() => null);
      if (data) quotes[symbol] = data;
    }),
  );
  if (!Object.keys(quotes).length) throw new Error("No quotes");
  return quotes;
}

/** Market cap, square-rooted so the mega caps don't crowd the smaller names out. */
function weight(q: Quote | undefined) {
  const value = q?.market_cap ?? 0;
  return Number.isFinite(value) && value > 0 ? Math.sqrt(value) : 0;
}

const inset = (rect: Rect, by: number): Rect => ({
  x: rect.x + by,
  y: rect.y + by,
  w: Math.max(0, rect.w - by * 2),
  h: Math.max(0, rect.h - by * 2),
});

export function MarketHeatmap({
  onOpen,
}: {
  onOpen: (stock: { ticker: string; name: string }) => void;
}) {
  const { locale } = usePreferences();
  const [width, setWidth] = useState(0);
  const height = Math.round(width * 0.95);
  const resource = useResource("search-heatmap", loadQuotes, 20_000);
  const quotes = resource.data;

  const tiles = useMemo(() => {
    if (!quotes || !width) return null;
    const fallback = (() => {
      const known = CORE_STOCKS.map((stock) => weight(quotes[stock.symbol]))
        .filter((value) => value > 0)
        .sort((a, b) => a - b);
      return known[Math.floor(known.length / 2)] ?? 1;
    })();
    const sectors = STOCK_SECTORS.filter((sector) => sector.key !== "all")
      .map((sector) => {
        const stocks = CORE_STOCKS.filter(
          (stock) => stock.sector === sector.key,
        ).map((stock) => ({
          ...stock,
          quote: quotes[stock.symbol],
          value: weight(quotes[stock.symbol]) || fallback,
        }));
        return {
          ...sector,
          stocks,
          value: stocks.reduce((sum, stock) => sum + stock.value, 0),
        };
      })
      .filter((sector) => sector.stocks.length);
    return treemap(sectors, { x: 0, y: 0, w: width, h: height }).map(
      (sector) => {
        const box = inset(sector, GAP / 2);
        const labelled = box.h > 64 && box.w > 56;
        const body = labelled
          ? { ...box, y: box.y + LABEL, h: box.h - LABEL }
          : box;
        return {
          sector,
          labelled,
          box,
          stocks: treemap(sector.stocks, body).map((stock) => ({
            ...stock,
            ...inset(stock, GAP / 2),
          })),
        };
      },
    );
  }, [quotes, width, height]);

  if (resource.error && !quotes) return null;
  return (
    <DiscoverySection title="市场热力图">
      <View
        onLayout={(event) =>
          setWidth(Math.round(event.nativeEvent.layout.width))
        }
        style={{
          height: height || undefined,
          aspectRatio: height ? undefined : 1 / 0.95,
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        {!tiles ? (
          <Skeleton width="100%" height={height || 300} radius={16} />
        ) : (
          tiles.map(({ sector, labelled, box, stocks }) => (
            <View key={sector.key}>
              {labelled && (
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    left: box.x + 4,
                    top: box.y,
                    width: box.w - 8,
                    height: LABEL,
                    justifyContent: "center",
                  }}
                >
                  <Copy size={11} bold muted lines={1} localize={false}>
                    {locale === "en" ? sector.en : sector.zh}
                  </Copy>
                </View>
              )}
              {stocks.map((stock) => (
                <Tile key={stock.symbol} stock={stock} onOpen={onOpen} />
              ))}
            </View>
          ))
        )}
      </View>
      <Copy size={11} muted>
        面积按市值，颜色按今日涨跌幅
      </Copy>
    </DiscoverySection>
  );
}

function Tile({
  stock,
  onOpen,
}: {
  stock: Rect & { symbol: string; name: string; quote?: Quote };
  onOpen: (stock: { ticker: string; name: string }) => void;
}) {
  const change = stock.quote?.change_percent;
  const big = stock.w > 96 && stock.h > 72;
  const showSymbol = stock.w > 30 && stock.h > 22;
  const showChange = showSymbol && stock.h > 40 && stock.w > 40;
  // Narrow tiles drop a decimal so the change fits on one line.
  const digits = stock.w < 64 ? 1 : 2;
  const percent =
    change == null || !Number.isFinite(change)
      ? "—"
      : `${change > 0 ? "+" : ""}${change.toFixed(digits)}%`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${stock.symbol} ${percent}`}
      onPress={() => onOpen({ ticker: stock.symbol, name: stock.name })}
      style={({ pressed }) => ({
        position: "absolute",
        left: stock.x,
        top: stock.y,
        width: stock.w,
        height: stock.h,
        borderRadius: 6,
        alignItems: "center",
        justifyContent: "center",
        padding: 2,
        backgroundColor: changeColor(change),
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {showSymbol && (
        <Copy
          size={big ? 17 : 12}
          bold
          lines={1}
          localize={false}
          color="#FFFFFF"
        >
          {stock.symbol}
        </Copy>
      )}
      {showChange && (
        <Copy size={big ? 13 : 11} lines={1} localize={false} color="#FFFFFF">
          {percent}
        </Copy>
      )}
    </Pressable>
  );
}
