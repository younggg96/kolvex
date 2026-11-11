import { usePreferences } from "../state/Preferences";
import { CardsSkeleton } from "../components/Skeletons";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Polyline } from "react-native-svg";
import { indicators, type Indicator } from "../lib/featureApi";
import { indicatorPeriod, indicatorValue } from "../lib/economicIndicators";
import { useTheme } from "../lib/theme";
import { useResource } from "../lib/useResource";
import { useAuth } from "../state/Auth";
import { Copy, Glass, Page, phone } from "../components/UI";
import {
  AuthGate,
  Filters,
  ResourceState,
  SourceLink,
} from "../components/Content";

const FREQUENCY = { daily: "日度", monthly: "月度", quarterly: "季度" };
const COMPARISON = {
  daily: "较前一观测日",
  monthly: "较前月",
  quarterly: "较前季",
};
function methodLabel(i: Indicator) {
  if (i.method === "yoy") return "未季调 · 同比";
  if (i.id === "gdp") return "季调 · 季环比折年率";
  if (i.id === "payrolls") return "季调 · 当月就业人数净增";
  if (i.id === "unemployment") return "季调 · U-3 失业率";
  if (i.method === "spread") return "同日10年收益率减2年收益率";
  return "日度国债固定期限收益率";
}

const skeleton = (
  <CardsSkeleton
    count={3}
    lines={[
      { size: 14, width: "50%" },
      { size: 12, width: "35%" },
    ]}
  />
);

export default function Macro() {
  return (
    <AuthGate title="宏观指标" skeleton={skeleton}>
      <MacroContent />
    </AuthGate>
  );
}

/** One line per indicator; details open in place, as the Web's phone rows do. */
function IndicatorRow({
  indicator,
  years,
  intl,
  last,
}: {
  indicator: Indicator;
  years: number;
  intl: string;
  last: boolean;
}) {
  const t = useTheme();
  const { locale } = usePreferences();
  const [open, setOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  const latest = indicator.history.at(-1)?.date;
  const cutoff = latest
    ? `${Number(latest.slice(0, 4)) - years}${latest.slice(4)}`
    : "";
  const history = indicator.history.filter((p) => p.date >= cutoff);
  const name =
    locale === "en"
      ? indicator.name_en || indicator.name_zh
      : indicator.name_zh || indicator.name_en;
  const rangeChange =
    history.length > 1
      ? history[history.length - 1].value - history[0].value
      : 0;
  const deltaColor =
    indicator.change === null || indicator.change === 0
      ? undefined
      : indicator.change > 0
        ? t.accent
        : t.negative;
  const signed = indicator.id === "payrolls" || indicator.id === "spread";
  const frequency = FREQUENCY[indicator.frequency];
  return (
    <View
      style={{
        paddingVertical: phone(8),
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: t.border,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((value) => !value)}
        style={styles.row}
      >
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Copy size={14} bold lines={1}>
            {name}
          </Copy>
          <Copy size={12} muted localize={false} lines={1}>
            {`${indicatorPeriod(indicator, indicator.period, intl)} · ${frequency}`}
          </Copy>
        </View>
        <View style={{ width: phone(56), height: phone(40) }}>
          {history.length > 1 && (
            <Sparkline
              data={history}
              rangeChange={rangeChange}
              height={phone(40)}
            />
          )}
        </View>
        <View style={{ minWidth: phone(80), alignItems: "flex-end", gap: 2 }}>
          <Copy size={16} bold localize={false}>
            {indicatorValue(indicator.value, indicator.unit, intl, signed)}
          </Copy>
          <Copy size={12} color={deltaColor} localize={false}>
            {indicator.change === null
              ? "—"
              : indicatorValue(
                  indicator.change,
                  indicator.change_unit,
                  intl,
                  true,
                )}
          </Copy>
        </View>
        <Copy size={14} muted localize={false}>
          {open ? "⌃" : "⌄"}
        </Copy>
      </Pressable>
      {open && (
        <View style={{ paddingBottom: phone(12), gap: phone(8) }}>
          <Copy size={12} muted>
            {`${COMPARISON[indicator.frequency]} · ${methodLabel(indicator)}`}
          </Copy>
          {history.length > 1 ? (
            <Sparkline
              data={history}
              rangeChange={rangeChange}
              height={phone(112)}
            />
          ) : (
            <Copy size={12} muted>
              暂无历史走势
            </Copy>
          )}
          {indicator.status !== "ready" && (
            <Copy size={12} muted>
              {indicator.value === null
                ? "数据暂不可用"
                : "延迟数据 · 请以数据所属期为准"}
            </Copy>
          )}
          <SourceLink url={indicator.source_url}>
            {indicator.source} ↗
          </SourceLink>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: recentOpen }}
            onPress={() => setRecentOpen((value) => !value)}
            style={{
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: t.border,
              paddingTop: phone(8),
            }}
          >
            <View style={styles.row}>
              <Copy size={12} muted>
                近期数据
              </Copy>
              <Copy size={14} muted localize={false}>
                {recentOpen ? "⌃" : "⌄"}
              </Copy>
            </View>
          </Pressable>
          {recentOpen &&
            indicator.history
              .slice(-12)
              .reverse()
              .map((point) => (
                <Copy key={point.date} size={12} muted localize={false}>
                  {`${indicatorPeriod(indicator, point.date, intl)} · ${indicatorValue(
                    point.value,
                    indicator.unit,
                    intl,
                    signed,
                  )}`}
                </Copy>
              ))}
        </View>
      )}
    </View>
  );
}

function Sparkline({
  data,
  rangeChange,
  height,
}: {
  data: { date: string; value: number }[];
  rangeChange: number;
  height: number;
}) {
  const t = useTheme();
  const values = data.map((p) => p.value);
  const low = Math.min(...values);
  const span = Math.max(...values) - low || 1;
  const points = values
    .map(
      (v, i) =>
        `${(i / (values.length - 1)) * 100},${96 - ((v - low) / span) * 92}`,
    )
    .join(" ");
  const stroke =
    rangeChange > 0 ? t.chartUp : rangeChange < 0 ? t.chartDown : t.secondary;
  return (
    <Svg
      width="100%"
      height={height}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      accessible={false}
    >
      <Polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}

function MacroContent() {
  const { locale } = usePreferences();
  const intl = locale === "en" ? "en-US" : "zh-CN";
  const user = useAuth().session!.user.id;
  const [years, setYears] = useState("3");
  const r = useResource(`macro:${user}`, (s) => indicators(user, s));
  const data = r.data;
  return (
    <Page title="宏观指标" onRefresh={r.refresh} refreshing={r.loading}>
      <Filters
        stretch
        values={[
          ["1", "1 年"],
          ["3", "3 年"],
          ["5", "5 年"],
        ]}
        value={years}
        onChange={setYears}
      />
      <ResourceState
        resource={r}
        skeleton={skeleton}
        message="暂无可用宏观数据"
      />
      {data?.status !== "ready" && data && (
        <Copy muted>部分数据可能延迟或尚未准备完成，请以数据所属期为准。</Copy>
      )}
      {data && (
        <Glass style={{ paddingHorizontal: 12 }}>
          {data.indicators.map((i, index) => (
            <IndicatorRow
              key={i.id}
              indicator={i}
              years={Number(years)}
              intl={intl}
              last={index === data.indicators.length - 1}
            />
          ))}
        </Glass>
      )}
      <Copy size={12} muted>
        指标升降不是投资收益。官方数据可修订，走势图采用当前可用版本。最近检查：
        {data?.fetched_at
          ? `${new Intl.DateTimeFormat(intl, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(new Date(data.fetched_at))} UTC`
          : "未提供"}
      </Copy>
    </Page>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: phone(8),
    minHeight: phone(56),
  },
});
