// The Web's Markets page (components/decision/Market.tsx) on a phone: no page heading,
// a pill tab bar (overview, trends, calendar, macro), then the overview sections.
import { useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Filters } from "../../components/Content";
import {
  ComparisonTable,
  InstrumentRow,
  ViewToggle,
  type RangeKey,
} from "../../components/MarketCards";
import { OpinionStrength } from "../../components/OpinionStrength";
import { StockWatch } from "../../components/StockWatch";
import {
  Copy,
  EmbeddedPage,
  Glass,
  Page,
  Skeleton,
  phone,
  styles,
} from "../../components/UI";
import { catalogue } from "../../lib/featureApi";
import { BENCHMARKS, MARKET_GROUPS } from "../../lib/marketBenchmarks";
import { MARKET_RANGES } from "../../lib/marketObservations";
import { useTheme } from "../../lib/theme";
import { useResource } from "../../lib/useResource";
import { usePreferences } from "../../state/Preferences";
import Calendar from "../calendar";
import Macro from "../macro";

const TABS = [
  ["overview", "市场概览"],
  ["trends", "市场走势"],
  ["calendar", "事件日历"],
  ["macro", "宏观指标"],
] as const;

export default function Markets() {
  const [tab, setTab] = useState("overview");
  const [revision, setRevision] = useState(0);
  return (
    <Page title="行情" hideTitle onRefresh={() => setRevision((v) => v + 1)}>
      <Filters values={TABS} value={tab} onChange={setTab} />
      {tab === "overview" ? (
        <Overview revision={revision} />
      ) : (
        <EmbeddedPage key={`${tab}:${revision}`}>
          {tab === "trends" ? (
            <Trends revision={revision} />
          ) : tab === "calendar" ? (
            <Calendar />
          ) : (
            <Macro />
          )}
        </EmbeddedPage>
      )}
    </Page>
  );
}

/** The Web's MarketRangeControls at phone size: a compact range track and a view switch. */
function RangeControls({
  range,
  setRange,
  view,
  setView,
}: {
  range: RangeKey;
  setRange: (range: RangeKey) => void;
  view: "card" | "list";
  setView: (view: "card" | "list") => void;
}) {
  const { locale } = usePreferences();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      {view === "card" ? (
        <View style={{ maxWidth: phone(156), flexShrink: 1 }}>
          <Filters
            size="sm"
            maxWidth={phone(156)}
            values={MARKET_RANGES.map(
              (item) => [item.key, locale === "en" ? item.en : item.zh] as const,
            )}
            value={range}
            onChange={(value) => setRange(value as RangeKey)}
          />
        </View>
      ) : null}
      <ViewToggle value={view} onChange={setView} />
    </View>
  );
}

function Overview({ revision }: { revision: number }) {
  const [range, setRange] = useState<RangeKey>("1D");
  const [view, setView] = useState<"card" | "list">("card");
  return (
    <>
      <View style={{ gap: 12 }}>
        <View style={[styles.row, { gap: 8 }]}>
          <Copy size={20} bold>
            市场指数
          </Copy>
          <RangeControls
            range={range}
            setRange={setRange}
            view={view}
            setView={setView}
          />
        </View>
        {view === "card" ? (
          <InstrumentRow
            instruments={BENCHMARKS}
            range={range}
            revision={revision}
          />
        ) : (
          <ComparisonTable instruments={BENCHMARKS} revision={revision} />
        )}
      </View>
      <StockWatch revision={revision} range={range} />
      <CreatorUpdates revision={revision} />
      <Copy size={12} muted>
        研究从事实开始。市场数据与创作者观点不构成投资建议。
      </Copy>
    </>
  );
}

/** The Web's Market trends tab: sectors, styles and cross-assets as card rows. */
function Trends({ revision }: { revision: number }) {
  const { locale } = usePreferences();
  const [range, setRange] = useState<RangeKey>("1D");
  const [view, setView] = useState<"card" | "list">("card");
  const groups = MARKET_GROUPS.filter((group) => group.key !== "indices");
  return (
    <>
      <View style={{ alignItems: "flex-end" }}>
        <RangeControls
          range={range}
          setRange={setRange}
          view={view}
          setView={setView}
        />
      </View>
      {view === "list" ? (
        <ComparisonTable
          instruments={groups.flatMap((group) => group.instruments)}
          revision={revision}
        />
      ) : (
        groups.map((group) => (
          <View key={group.key} style={{ gap: 12 }}>
            <Copy size={20} bold localize={false}>
              {locale === "en" ? group.en : group.zh}
            </Copy>
            <InstrumentRow
              instruments={group.instruments}
              range={range}
              revision={revision}
            />
          </View>
        ))
      )}
      <Copy size={12} muted>
        ETF 是行业或风格的代表，不是指数点位。收益率与利差使用百分点变动；FRED
        为每日观测数据，不提供盘中走势。
      </Copy>
    </>
  );
}

/** The Web's "Creator updates": the five latest opinion shifts, newest first. */
function CreatorUpdates({ revision }: { revision: number }) {
  const t = useTheme();
  const r = useResource(`market-creator-updates:${revision}`, (signal) =>
    catalogue(signal),
  );
  const consensus = new Map(
    (r.data?.stocks ?? []).map((stock) => [stock.ticker, stock]),
  );
  const shifts = [...(r.data?.changes ?? [])]
    .sort((a, b) => b.current_date.localeCompare(a.current_date))
    .slice(0, 5);
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.row}>
        <Copy size={18} bold>
          博主新动态
        </Copy>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="查看全部观点"
          onPress={() => router.navigate("/opinions")}
          hitSlop={6}
          style={({ pressed }) => ({
            width: 38,
            height: 38,
            borderRadius: 19,
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
            size={14}
            tintColor={t.text}
          />
        </Pressable>
      </View>
      <Glass style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
        {r.loading && !r.data ? (
          <View style={{ gap: 12, paddingVertical: 12 }}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={16} />
            ))}
          </View>
        ) : r.error && !r.data ? (
          <View style={{ paddingVertical: 16, alignItems: "center", gap: 8 }}>
            <Copy size={14}>暂时无法加载博主动态。</Copy>
          </View>
        ) : !shifts.length ? (
          <View style={{ paddingVertical: 16, alignItems: "center" }}>
            <Copy size={14} muted>
              暂时没有博主新动态。
            </Copy>
          </View>
        ) : (
          shifts.map((shift, index) => (
            <Pressable
              key={shift.ticker}
              accessibilityRole="button"
              onPress={() =>
                router.push(`/stock/${encodeURIComponent(shift.ticker)}`)
              }
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                minHeight: 44,
                borderTopWidth: index ? 1 : 0,
                borderColor: t.border,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Copy size={14} bold localize={false}>
                {shift.ticker}
              </Copy>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <OpinionStrength
                  value={consensus.get(shift.ticker)?.avg_score}
                />
                <View
                  style={{ width: 1, height: 12, backgroundColor: t.border }}
                />
                {shift.change == null ? (
                  <Copy size={12} muted>
                    首次覆盖
                  </Copy>
                ) : (
                  <OpinionStrength value={shift.change} change />
                )}
              </View>
            </Pressable>
          ))
        )}
      </Glass>
    </View>
  );
}
