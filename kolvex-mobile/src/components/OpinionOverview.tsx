import { useState } from "react";
import { Pressable, View } from "react-native";
import Svg, { Line, Polyline } from "react-native-svg";
import type { Catalogue } from "../lib/featureApi";
import { describeStrength } from "../lib/opinionStrength";
import { useTheme } from "../lib/theme";
import { OpinionStrength } from "./OpinionStrength";
import { Copy, Glass, Section } from "./UI";
/** Distribution and a −100…+100 trend with no numeric axis, as on the Web. */
export function OpinionOverview({
  summary,
  daily,
}: {
  summary?: Catalogue["summary"];
  daily?: Catalogue["daily"];
}) {
  const t = useTheme();
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number>();
  const total = summary?.total_opinions ?? 0;
  if (!summary || !total) return null;
  const mixed = Math.max(
    total -
      summary.bullish_count -
      summary.bearish_count -
      summary.neutral_count,
    0,
  );
  const rows = [
    { label: "看涨", count: summary.bullish_count, color: t.chartUp },
    { label: "中性", count: summary.neutral_count, color: t.secondary },
    ...(mixed ? [{ label: "分歧", count: mixed, color: t.border }] : []),
    { label: "看跌", count: summary.bearish_count, color: t.chartDown },
  ];
  const points = daily ?? [];
  const height = 120;
  const y = (value: number) =>
    8 + ((100 - Math.max(-100, Math.min(100, value))) / 200) * (height - 16);
  const x = (index: number) =>
    points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
  const point = active === undefined ? undefined : points[active];
  const tone = describeStrength(summary.avg_score).tone;
  return (
    <Glass style={{ padding: 20, gap: 12 }}>
      <Section title="博主观点分布" />
      <OpinionStrength value={point ? point.avg_score : summary.avg_score} />
      <Copy size={12} muted>
        {point ? `${point.date} · ${point.total} 条观点` : `${total} 条观点`}
      </Copy>
      {points.length > 1 && (
        <Pressable
          accessibilityRole="image"
          accessibilityLabel="观点走势"
          onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
          onPress={(event) =>
            setActive(
              width
                ? Math.round(
                    (Math.max(0, Math.min(width, event.nativeEvent.locationX)) /
                      width) *
                      (points.length - 1),
                  )
                : undefined,
            )
          }
          style={{ height }}
        >
          {width > 0 && (
            <Svg width={width} height={height} accessible={false}>
              <Line x1={0} x2={width} y1={y(0)} y2={y(0)} stroke={t.border} />
              <Polyline
                fill="none"
                strokeWidth={2}
                stroke={
                  tone === "positive"
                    ? t.chartUp
                    : tone === "negative"
                      ? t.chartDown
                      : t.secondary
                }
                points={points
                  .map((item, index) => `${x(index)},${y(item.avg_score)}`)
                  .join(" ")}
              />
              {active !== undefined && (
                <Line
                  x1={x(active)}
                  x2={x(active)}
                  y1={0}
                  y2={height}
                  stroke={t.secondary}
                  strokeDasharray="4 4"
                />
              )}
            </Svg>
          )}
        </Pressable>
      )}
      {rows.map((row) => {
        const share = Math.round((row.count / total) * 100);
        return (
          <View
            key={row.label}
            style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
          >
            <View style={{ width: 44 }}>
              <Copy size={13} muted>
                {row.label}
              </Copy>
            </View>
            <View
              style={{
                flex: 1,
                height: 8,
                borderRadius: 4,
                overflow: "hidden",
                backgroundColor: t.tint,
              }}
            >
              <View
                style={{
                  width: `${share}%`,
                  height: "100%",
                  backgroundColor: row.color,
                }}
              />
            </View>
            <View style={{ width: 44, alignItems: "flex-end" }}>
              <Copy size={13} bold localize={false}>
                {share}%
              </Copy>
            </View>
          </View>
        );
      })}
    </Glass>
  );
}
