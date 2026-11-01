import { View } from "react-native";
import Svg, { Line, Path } from "react-native-svg";
import type { Bar } from "../lib/models";
import { useTheme } from "../lib/theme";
import { Copy, Empty } from "./UI";
export function Chart({ data }: { data: Bar[] }) {
  const t = useTheme();
  const values = data
    .map((b) => b.close)
    .filter((v): v is number => v != null && Number.isFinite(v));
  if (values.length < 2)
    return (
      <Empty title="暂无历史行情" message="数据源尚未提供此区间的价格。" />
    );
  const min = Math.min(...values);
  const span = Math.max(...values) - min || 1;
  const path = values
    .map(
      (v, i) =>
        `${i ? "L" : "M"}${8 + (i / (values.length - 1)) * 304},${174 - ((v - min) / span) * 150}`,
    )
    .join(" ");
  const color = values[values.length - 1] >= values[0] ? t.accent : t.negative;
  return (
    <View
      accessibilityLabel={`历史收盘价折线图，${data[0].date} 至 ${data[data.length - 1].date}，起点 ${values[0].toFixed(2)}，终点 ${values[values.length - 1].toFixed(2)} 美元`}
    >
      <Svg width="100%" height={200} viewBox="0 0 320 200" accessible={false}>
        {[24, 99, 174].map((y) => (
          <Line
            key={y}
            x1={0}
            x2={320}
            y1={y}
            y2={y}
            stroke={t.border}
            strokeDasharray="3 5"
          />
        ))}
        <Path
          d={path}
          stroke={color}
          strokeWidth={2.5}
          fill="none"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </Svg>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Copy size={12} muted>
          {data[0].date}
        </Copy>
        <Copy size={12} muted>
          {data[data.length - 1].date}
        </Copy>
      </View>
    </View>
  );
}
