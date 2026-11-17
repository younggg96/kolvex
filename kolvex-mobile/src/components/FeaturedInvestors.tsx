import { useState, type ReactNode } from "react";
import { Linking, Pressable, View } from "react-native";
import { router } from "expo-router";
import Svg, { Line, Polyline } from "react-native-svg";
import {
  FEATURED_INSTITUTIONS,
  PELOSI_TRADES_PATH,
  RETURN_RANGES,
  featuredHoldings,
  houseDisclosureUrl,
  pelosiDisclosures,
  stockReturnPath,
  stockReturnPoints,
  type AdjustedHistory,
  type PelosiDisclosure,
  type PortfolioPerformance,
  type ReturnPoint,
  type ReturnRange,
} from "../lib/featuredInvestors";
import { signedPercent } from "../lib/format";
import { institutionKey, type InstitutionManager } from "../lib/freeResearch";
import { institution, managers } from "../lib/freeResearchApi";
import { apiRequest } from "../lib/http";
import { useTheme } from "../lib/theme";
import { useResource } from "../lib/useResource";
import { useAuth } from "../state/Auth";
import { usePreferences } from "../state/Preferences";
import { Filters } from "./Content";
import { Note, SecLink, useFormat } from "./SecResearch";
import { InvestorAvatar } from "./Superinvestors";
import {
  Button,
  Copy,
  Failure,
  Glass,
  LoadingStatus,
  Section,
  Skeleton,
  phone,
} from "./UI";

const PELOSI = "pelosi";

export default function FeaturedInvestors() {
  const { locale } = usePreferences();
  const [selected, setSelected] = useState(
    String(FEATURED_INSTITUTIONS[0].cik),
  );
  const list = useResource("featured-investors", managers, 55_000);
  const manager = list.data?.managers.find(
    ({ cik }) => String(cik) === selected,
  );
  return (
    <View style={{ gap: phone(16) }}>
      <Section title="明星投资者" />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: phone(8) }}>
        {FEATURED_INSTITUTIONS.map(({ cik, en, zh }) => (
          <Button
            key={cik}
            size="sm"
            selected={selected === String(cik)}
            onPress={() => setSelected(String(cik))}
          >
            <Copy bold localize={false}>
              {locale === "zh" ? zh : en}
            </Copy>
          </Button>
        ))}
        <Button
          size="sm"
          selected={selected === PELOSI}
          onPress={() => setSelected(PELOSI)}
        >
          佩洛西
        </Button>
      </View>
      <Glass style={{ padding: 16, gap: 16 }}>
        {selected === PELOSI ? (
          <PelosiPanel />
        ) : manager ? (
          <InstitutionPanel key={manager.id} manager={manager} />
        ) : (
          <FeaturedStatus
            loading={list.loading}
            error={list.error}
            retry={list.refresh}
            unavailable="名单中暂无这家机构的申报。"
          />
        )}
      </Glass>
    </View>
  );
}

function FeaturedStatus({
  loading,
  error,
  retry,
  unavailable,
}: {
  loading?: boolean;
  error?: string;
  retry?: () => void;
  unavailable: string;
}) {
  if (loading) {
    return (
      <LoadingStatus>
        <Skeleton height={76} radius={12} />
      </LoadingStatus>
    );
  }
  if (error) return <Failure message={error} retry={retry} />;
  return <Note>{unavailable}</Note>;
}

function InstitutionPanel({ manager }: { manager: InstitutionManager }) {
  const t = useTheme();
  const f = useFormat();
  const { locale } = usePreferences();
  const [selected, setSelected] = useState<string>();
  const [mode, setMode] = useState("stock");
  const resource = useResource(
    `featured-holdings:${manager.id}`,
    (signal) => institution(manager.id, signal),
    55_000,
  );
  const data = resource.error ? undefined : resource.data;
  const filing = data?.filing;
  const rows = data && filing ? featuredHoldings(data.holdings) : [];
  const chartable = rows.filter((row) => stockReturnPath(row.ticker));
  const active =
    chartable.find((row) => row.cusip === selected) ?? chartable[0];
  return (
    <>
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: phone(12) }}
      >
        <InvestorAvatar id={manager.id} name={manager.name} />
        <View style={{ flex: 1, gap: phone(4) }}>
          <Copy size={18} bold localize={false}>
            {locale === "zh"
              ? (manager.profile?.zhName ?? manager.name)
              : manager.name}
          </Copy>
          {!!filing && (
            <Copy
              size={12}
              muted
              localize={false}
            >{`13F · ${f.date(filing.period)}`}</Copy>
          )}
        </View>
      </View>
      <Button
        size="sm"
        onPress={() =>
          router.push(`/superinvestor/${encodeURIComponent(manager.id)}`)
        }
      >
        查看全部持仓
      </Button>
      <View
        style={{
          gap: phone(8),
          borderTopWidth: 1,
          borderColor: t.border,
          paddingTop: phone(12),
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            gap: phone(8),
          }}
        >
          <Copy bold>前五大披露持仓</Copy>
          {!!filing && <SecLink href={filing.source_url} label="SEC 原文" />}
        </View>
        {rows.length && !resource.loading ? (
          rows.map((row) => (
            <SelectionRow
              key={row.cusip}
              selected={mode === "stock" && row.cusip === active?.cusip}
              onPress={
                stockReturnPath(row.ticker)
                  ? () => {
                      setSelected(row.cusip);
                      setMode("stock");
                    }
                  : undefined
              }
            >
              <View style={{ flex: 1, gap: phone(4) }}>
                <Copy bold localize={false}>
                  {row.ticker ?? row.cusip}
                </Copy>
                <Copy size={12} muted localize={false}>
                  {row.issuer}
                </Copy>
              </View>
              <View style={{ alignItems: "flex-end", gap: phone(4) }}>
                <Copy bold localize={false}>
                  {f.percent(row.weight)}
                </Copy>
                <View
                  style={{
                    width: phone(64),
                    height: phone(4),
                    backgroundColor: t.wash,
                    overflow: "hidden",
                    borderRadius: 2,
                  }}
                >
                  <View
                    style={{
                      width: `${row.weight * 100}%`,
                      height: "100%",
                      backgroundColor: t.brand,
                    }}
                  />
                </View>
              </View>
            </SelectionRow>
          ))
        ) : (
          <FeaturedStatus
            {...resource}
            unavailable="当前申报暂无股票持仓数据。"
          />
        )}
        <Note>占比以该份 13F 中非期权的股份类持仓总市值为基准，含 ETF。</Note>
      </View>
      <Filters
        size="sm"
        value={mode}
        onChange={setMode}
        values={[
          ["stock", "个股"],
          ["portfolio", "13F 模拟组合"],
        ]}
      />
      {mode === "portfolio" ? (
        <PortfolioCurve manager={manager.id} />
      ) : data && !resource.loading ? (
        <StockCurve ticker={active?.ticker} />
      ) : null}
    </>
  );
}

function SelectionRow({
  selected,
  onPress,
  children,
}: {
  selected: boolean;
  onPress?: () => void;
  children: ReactNode;
}) {
  const t = useTheme();
  const style = {
    flex: 1,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    gap: phone(12),
    minHeight: phone(48),
    padding: phone(8),
    backgroundColor: selected ? t.wash : undefined,
    borderRadius: 8,
  };
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        style,
        pressed && { backgroundColor: t.washStrong },
      ]}
    >
      {children}
    </Pressable>
  ) : (
    <View style={style}>{children}</View>
  );
}

function PelosiPanel() {
  const f = useFormat();
  const auth = useAuth();
  const user = auth.session?.user.id;
  const [selected, setSelected] = useState<number>();
  const [failedSource, setFailedSource] = useState<number>();
  const resource = useResource(`featured-pelosi:${user}`, (signal) =>
    apiRequest<{ trades: PelosiDisclosure[] }>(PELOSI_TRADES_PATH, {
      authenticated: true,
      expectedUser: user,
      signal,
    }),
  );
  const rows =
    resource.data && !resource.error
      ? pelosiDisclosures(resource.data.trades)
      : [];
  const chartable = rows.filter((row) => stockReturnPath(row.ticker));
  const active = chartable.find((row) => row.id === selected) ?? chartable[0];
  const directions = {
    buy: "买入",
    sell: "卖出",
    exchange: "交换",
    other: "其他",
  };
  return (
    <>
      <Copy size={18} bold>
        南希·佩洛西
      </Copy>
      <Note>美国众议院交易披露</Note>
      <Copy bold>近期披露交易</Copy>
      {rows.length && !resource.loading ? (
        rows.map((row) => {
          const source = houseDisclosureUrl(row.source_url);
          return (
            <View
              key={row.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: phone(8),
              }}
            >
              <SelectionRow
                selected={row.id === active?.id}
                onPress={
                  stockReturnPath(row.ticker)
                    ? () => setSelected(row.id)
                    : undefined
                }
              >
                <View style={{ flex: 1, gap: phone(4) }}>
                  <Copy bold localize={false}>
                    {row.ticker || "—"}
                  </Copy>
                  <Copy size={12} muted>
                    {directions[row.direction]}
                  </Copy>
                  <Copy size={12} muted localize={false}>
                    {f.date(row.trade_date)}
                  </Copy>
                </View>
                <Copy size={12} localize={false}>
                  {row.amount_range ?? "—"}
                </Copy>
              </SelectionRow>
              {!!source && (
                <Button
                  size="sm"
                  onPress={() => {
                    setFailedSource(undefined);
                    void Linking.openURL(source).catch(() =>
                      setFailedSource(row.id),
                    );
                  }}
                >
                  原文
                </Button>
              )}
            </View>
          );
        })
      ) : (
        <FeaturedStatus
          {...resource}
          unavailable="暂无可用的众议院交易披露。"
        />
      )}
      {failedSource !== undefined && (
        <Failure message="无法打开链接，请稍后重试。" />
      )}
      <Note>披露仅提供交易金额区间，无法计算持仓占比或交易收益。</Note>
      {!!resource.data && !resource.loading && !resource.error && (
        <StockCurve ticker={active?.ticker} />
      )}
    </>
  );
}

function StockCurve({ ticker }: { ticker?: string | null }) {
  const path = stockReturnPath(ticker);
  if (!ticker || !path) return <Note>暂无可查询历史行情的股票代码。</Note>;
  return <StockHistory ticker={ticker} path={path} />;
}

function StockHistory({ ticker, path }: { ticker: string; path: string }) {
  const [range, setRange] = useState<ReturnRange>("6m");
  const resource = useResource(
    path,
    (signal) => apiRequest<AdjustedHistory>(path, { signal }),
    25_000,
  );
  const points = resource.data ? stockReturnPoints(resource.data, range) : [];
  const labels = { "3m": "3个月", "6m": "6个月", "1y": "1年" };
  return (
    <View style={{ gap: phone(12) }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: phone(8) }}>
        <Copy bold localize={false}>
          {ticker}
        </Copy>
        <Copy bold>个股收益</Copy>
      </View>
      <Filters
        size="sm"
        value={range}
        values={RETURN_RANGES.map((value) => [value, labels[value]])}
        onChange={(value) => {
          const range = RETURN_RANGES.find((option) => option === value);
          if (range) setRange(range);
        }}
      />
      {resource.loading || resource.error || points.length < 2 ? (
        <FeaturedStatus {...resource} unavailable="该区间的行情数据不足。" />
      ) : (
        <ReturnPlot points={points} />
      )}
      <Note>
        来源为 Yahoo Finance 复权日收盘价，区间内首个可用收盘价记为 0%。
      </Note>
    </View>
  );
}

/** 13F simulated return vs SPY; also shown on each institution's detail screen. */
export function PortfolioCurve({ manager }: { manager: string }) {
  const path = `${institutionKey(manager).replace(/^\/api/, "")}/performance`;
  const resource = useResource(path, (signal) =>
    apiRequest<PortfolioPerformance>(path, { signal }),
  );
  const performance = resource.data;
  const points =
    performance?.status === "ready"
      ? performance.points.map((point) => ({
          date: point.date,
          value: point.value * 100,
          benchmark: point.benchmark * 100,
        }))
      : [];
  return (
    <View style={{ gap: phone(12) }}>
      <Copy bold>13F 模拟收益对比 SPY</Copy>
      {resource.loading || resource.error || points.length < 2 ? (
        <FeaturedStatus
          {...resource}
          unavailable={
            performance?.status === "pending"
              ? "正在等待首次计算。"
              : "有可用行情的季度不足。"
          }
        />
      ) : (
        <ReturnPlot points={points} benchmark />
      )}
      <Note>
        按季度末披露持仓回看，申报晚于季度末。模拟不计期权和费用，结果可能与基金实际业绩不同。
      </Note>
    </View>
  );
}

function ReturnPlot({
  points,
  benchmark,
}: {
  points: ReturnPoint[];
  benchmark?: boolean;
}) {
  const t = useTheme();
  const f = useFormat();
  const first = points[0];
  const last = points[points.length - 1];
  const width = 320;
  const height = 150;
  const values = points.flatMap((point) =>
    point.benchmark === undefined
      ? [point.value]
      : [point.value, point.benchmark],
  );
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const start = Date.parse(first.date);
  const duration = Date.parse(last.date) - start || 1;
  const y = (value: number) =>
    max === min ? height / 2 : 4 + ((max - value) / (max - min)) * (height - 8);
  const line = (key: "value" | "benchmark") =>
    points
      .flatMap((point) => {
        const value = point[key];
        return value === undefined
          ? []
          : [
              `${((Date.parse(point.date) - start) / duration) * width},${y(value)}`,
            ];
      })
      .join(" ");
  return (
    <View style={{ gap: phone(4) }}>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          gap: phone(8),
        }}
      >
        <Copy
          bold
          size={24}
          localize={false}
          color={benchmark ? t.text : last.value < 0 ? t.negative : t.accent}
        >
          {signedPercent(last.value)}
        </Copy>
        {!!benchmark && (
          <Copy
            size={13}
            muted
            localize={false}
          >{`SPY ${signedPercent(last.benchmark)}`}</Copy>
        )}
      </View>
      <Copy
        size={12}
        muted
        localize={false}
      >{`${f.date(first.date)} – ${f.date(last.date)}`}</Copy>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Svg
          width="100%"
          height={phone(height)}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
        >
          <Line
            x1={0}
            x2={width}
            y1={y(0)}
            y2={y(0)}
            stroke={t.secondary}
            strokeDasharray="3 4"
            opacity={0.5}
          />
          <Polyline
            points={line("value")}
            fill="none"
            stroke={benchmark || last.value >= 0 ? t.chartUp : t.chartDown}
            strokeWidth={2}
          />
          {!!benchmark && (
            <Polyline
              points={line("benchmark")}
              fill="none"
              stroke={t.secondary}
              strokeDasharray="5 4"
              strokeWidth={2}
            />
          )}
        </Svg>
      </View>
    </View>
  );
}
