import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { history, quote } from "../../lib/api";
import { isSymbol, number, percent } from "../../lib/models";
import { useResource } from "../../lib/useResource";
import { useTheme } from "../../lib/theme";
import { useWatchlist } from "../../state/Watchlist";
import { StockContent } from "../../components/StockContent";
import { Chart } from "../../components/Chart";
import {
  Button,
  Copy,
  Failure,
  Glass,
  Page,
  Section,
  Skeleton,
  styles,
} from "../../components/UI";
export default function Stock() {
  const params = useLocalSearchParams<{ symbol: string; tab?: string }>();
  const symbol = (
    typeof params.symbol === "string" ? params.symbol : ""
  ).toUpperCase();
  const valid = isSymbol(symbol);
  const t = useTheme();
  const list = useWatchlist();
  const [period, setPeriod] = useState("1mo");
  const q = useResource(symbol, (signal) =>
    valid
      ? quote(symbol, signal)
      : Promise.reject(new Error("股票代码无效，请返回行情重新搜索。")),
  );
  const bars = useResource(`${symbol}:${period}`, (signal) =>
    valid ? history(symbol, period, signal) : Promise.resolve([]),
  );
  const saved = list.symbols.includes(symbol);
  return (
    <Page
      title={symbol || "股票详情"}
      subtitle={`${q.data?.name ?? "股票研究"} · ${q.data?.currency || "币种未提供"}`}
      refreshing={q.loading && !!q.data}
      onRefresh={() => {
        q.refresh();
        bars.refresh();
      }}
    >
      {q.error && <Failure message={q.error} retry={q.refresh} />}
      {q.loading && !q.data ? (
        <Skeleton />
      ) : (
        <View style={{ gap: 4 }}>
          <Copy size={48} bold>
            {number(q.data?.current_price)}
          </Copy>
          <Copy
            size={18}
            color={(q.data?.change_percent ?? 0) < 0 ? t.negative : t.accent}
          >
            {number(q.data?.change)} ({percent(q.data?.change_percent)})
          </Copy>
          <Copy size={12} muted>
            最新可用报价 · 涨跌相对前收盘
          </Copy>
        </View>
      )}
      <Glass material style={{ padding: 8 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Button
            onPress={() =>
              router.push(`/technical/${encodeURIComponent(symbol)}`)
            }
          >
            K 线、指标与 AI 画线
          </Button>
          <Button
            disabled={!valid || !list.ready || list.pending}
            selected={saved}
            onPress={() => list.toggle(symbol)}
          >
            {saved ? "★ 已加入自选" : "☆ 加入自选"}
          </Button>
          <Button
            disabled={!valid}
            onPress={() =>
              router.push({ pathname: "/chat", params: { ticker: symbol } })
            }
          >
            向 Kolvex 提问
          </Button>
        </View>
      </Glass>
      {list.error && <Failure message={list.error} />}
      <Glass style={{ padding: 16, gap: 16 }}>
        {bars.loading ? (
          <Skeleton />
        ) : bars.error ? (
          <Failure message={bars.error} retry={bars.refresh} />
        ) : (
          <Chart
            data={bars.data ?? []}
            currency={q.data?.currency ?? undefined}
          />
        )}
        <View style={styles.row}>
          {[
            ["1mo", "1 个月"],
            ["3mo", "3 个月"],
            ["1y", "1 年"],
          ].map(([value, label]) => (
            <Button
              key={value}
              selected={period === value}
              onPress={() => setPeriod(value)}
            >
              {label}
            </Button>
          ))}
        </View>
      </Glass>
      <Section title="交易概览" />
      <Glass style={{ padding: 20, gap: 16 }}>
        {[
          ["开盘", q.data?.open],
          ["日内最高", q.data?.day_high],
          ["日内最低", q.data?.day_low],
          ["成交量", q.data?.volume],
        ].map(([label, value]) => (
          <View key={String(label)} style={styles.row}>
            <Copy size={14} muted>
              {label}
            </Copy>
            <Copy>
              {number(
                typeof value === "number" ? value : null,
                label === "成交量" ? 0 : 2,
              )}
            </Copy>
          </View>
        ))}
      </Glass>
      {valid && (
        <StockContent
          symbol={symbol}
          currency={q.data?.currency ?? undefined}
          companyName={q.data?.name}
          initialTab={typeof params.tab === "string" ? params.tab : undefined}
        />
      )}
      <Copy size={12} muted>
        缺失数据以 — 显示。历史图为每日收盘价，不代表实时或盘中走势。
      </Copy>
    </Page>
  );
}
