import { useState } from "react";
import Svg, {
  Line,
  Rect,
  Polyline,
  Polygon,
  Text as SvgText,
} from "react-native-svg";
import { View } from "react-native";
import { useText } from "../lib/i18n";
import { useTheme } from "../lib/theme";
import type {
  PriceBar,
  Drawing,
  AiTechnicalAnalysis,
} from "../lib/technicalTypes";
import {
  computeIndicators,
  rsi,
  macd,
  kdj,
  type IndicatorKey,
} from "../lib/technicalIndicators";
import { Filters } from "./Content";
import { Copy, Button } from "./UI";
import { number } from "../lib/models";
const colors: Record<string, string> = {
  ema5: "#14B8A6",
  ema20: "#A855F7",
  ema50: "#3B82F6",
  ema200: "#7DAFCD",
  vwap: "#EC4899",
  bb: "#94A3B8",
};
export function CandleGraph({
  bars,
  start,
  count,
  selected,
  onSelect,
  enabled,
  drawings = [],
  analysis,
}: {
  bars: PriceBar[];
  start: number;
  count: number;
  selected: number;
  onSelect: (i: number) => void;
  enabled: IndicatorKey[];
  drawings?: Drawing[];
  analysis?: AiTechnicalAnalysis;
}) {
  const t = useTheme();
  const [oscillatorMode, setOscillatorMode] = useState("rsi");
  const visible = bars.slice(start, start + count);
  if (!visible.length) return <Copy>此区间暂无有效 K 线。</Copy>;
  const indicators = computeIndicators(bars, false);
  const max = Math.max(...visible.map((b) => b.high));
  const min = Math.min(...visible.map((b) => b.low));
  const span = max - min || Math.max(Math.abs(max) * 0.01, 1);
  const y = (price: number) => 220 - ((price - min) / span) * 200;
  const dx = 300 / visible.length;
  const x = (i: number) => 10 + (i + 0.5) * dx;
  const maxVolume = Math.max(0, ...visible.map((b) => b.volume ?? 0)) || 1;
  const first = Date.parse(visible[0].date) / 1000;
  const last = Date.parse(visible.at(-1)!.date) / 1000;
  const timeX = (time: number) =>
    10 + ((time - first) / (last - first || 1)) * 300;
  const bar = bars[Math.min(bars.length - 1, Math.max(0, selected))];
  const path = (values: (number | null)[]) =>
    values
      .slice(start, start + count)
      .map((v, i) => (v === null ? null : `${x(i)},${y(v)}`))
      .filter(Boolean)
      .join(" ");
  const oscillator = {
    rsi: rsi(bars.map((b) => b.close)),
    macd: macd(bars.map((b) => b.close)).histogram,
    kdj: kdj(bars).j,
  };
  return (
    <View style={{ gap: 12 }}>
      <Copy size={12} muted>
        {visible[0].date.slice(0, 10)} — {visible.at(-1)!.date.slice(0, 10)}
      </Copy>
      <Svg
        width="100%"
        height={260}
        viewBox="0 0 320 260"
        accessible={false}
        aria-hidden={true}
      >
        {[0, 0.5, 1].map((p) => (
          <Line
            key={p}
            x1={8}
            x2={312}
            y1={y(min + span * p)}
            y2={y(min + span * p)}
            stroke={t.border}
          />
        ))}
        {visible.map((b, i) => {
          const color = b.close >= b.open ? t.chartUp : t.chartDown;
          return (
            <ReactBar
              key={b.date}
              x={x(i)}
              width={Math.max(dx * 0.65, 1)}
              high={y(b.high)}
              low={y(b.low)}
              open={y(b.open)}
              close={y(b.close)}
              color={color}
              onPress={() => onSelect(start + i)}
            />
          );
        })}
        {enabled
          .filter((k) => k !== "volume")
          .flatMap((k) =>
            k === "bb"
              ? [
                  indicators.bb.upper,
                  indicators.bb.middle,
                  indicators.bb.lower,
                ].map((line, i) => (
                  <Polyline
                    key={`${k}${i}`}
                    points={path(line)}
                    stroke={colors[k]}
                    strokeWidth={1}
                    fill="none"
                  />
                ))
              : [
                  <Polyline
                    key={k}
                    points={path(indicators[k] as (number | null)[])}
                    stroke={colors[k]}
                    strokeWidth={1.2}
                    fill="none"
                  />,
                ],
          )}
        {enabled.includes("volume") &&
          visible.map((b, i) => (
            <Rect
              key={`v${i}`}
              x={x(i) - dx / 3}
              y={255 - ((b.volume ?? 0) / maxVolume) * 22}
              width={Math.max(dx * 0.6, 1)}
              height={((b.volume ?? 0) / maxVolume) * 22}
              fill={b.close >= b.open ? t.chartUp : t.chartDown}
              opacity={0.5}
            />
          ))}
        {selected >= start && selected < start + count && (
          <Line
            x1={x(selected - start)}
            x2={x(selected - start)}
            y1={10}
            y2={245}
            stroke={t.secondary}
            strokeDasharray="3,3"
          />
        )}
        {drawings.map((d) => (
          <DrawingShape
            key={d.id}
            drawing={d}
            x={timeX}
            y={y}
            foreground={t.text}
          />
        ))}
        {analysis?.levels.map((level, i) => (
          <Line
            key={`a${i}`}
            x1={8}
            x2={312}
            y1={y(level.price)}
            y2={y(level.price)}
            stroke={level.kind === "support" ? t.chartUp : t.chartDown}
            strokeDasharray="4,3"
          />
        ))}
        {analysis?.trendlines.map((line, i) => (
          <Line
            key={`at${i}`}
            x1={timeX(Date.parse(line.start.date) / 1000)}
            y1={y(line.start.price)}
            x2={timeX(Date.parse(line.end.date) / 1000)}
            y2={y(line.end.price)}
            stroke={t.secondary}
          />
        ))}
        {analysis?.overlays?.map((o, i) => {
          const points = o.points
            .map((p) => `${timeX(Date.parse(p.date) / 1000)},${y(p.price)}`)
            .join(" ");
          return o.shape === "area" ? (
            <Polygon
              key={`o${i}`}
              points={points}
              fill={t.secondary}
              opacity={0.18}
            />
          ) : (
            <Polyline
              key={`o${i}`}
              points={points}
              fill="none"
              stroke={t.secondary}
              strokeWidth={1.5}
            />
          );
        })}
      </Svg>
      {bar && (
        <Copy size={12}>
          选中 {bar.date} · 开 {number(bar.open)} · 高 {number(bar.high)} · 低{" "}
          {number(bar.low)} · 收 {number(bar.close)} · 量{" "}
          {number(bar.volume, 0)}
        </Copy>
      )}
      <View style={{ flexDirection: "row", gap: 12 }}>
        <Button
          disabled={selected <= 0}
          onPress={() => onSelect(Math.max(0, selected - 1))}
        >
          上一根
        </Button>
        <Button
          disabled={selected >= bars.length - 1}
          onPress={() => onSelect(Math.min(bars.length - 1, selected + 1))}
        >
          下一根
        </Button>
      </View>
      <Copy size={12} muted>
        {enabled
          .filter((k) => k !== "volume")
          .map(
            (k) =>
              `${k.toUpperCase()} ${k === "bb" ? number(indicators.bb.middle[selected]) : number((indicators[k] as (number | null)[])[selected])}`,
          )
          .join(" · ")}
      </Copy>
      <Copy size={12} muted>
        RSI14 {number(oscillator.rsi[selected])} · MACD 柱{" "}
        {number(oscillator.macd[selected])} · KDJ J{" "}
        {number(oscillator.kdj[selected])}
      </Copy>
      <Filters
        values={[
          ["rsi", "RSI14"],
          ["macd", "MACD 柱"],
          ["kdj", "KDJ J"],
        ]}
        value={oscillatorMode}
        onChange={setOscillatorMode}
      />
      <OscillatorPlot
        values={oscillator[oscillatorMode as keyof typeof oscillator].slice(
          start,
          start + count,
        )}
        color={t.secondary}
        border={t.border}
      />
    </View>
  );
}
function ReactBar({
  x,
  width,
  high,
  low,
  open,
  close,
  color,
  onPress,
}: {
  x: number;
  width: number;
  high: number;
  low: number;
  open: number;
  close: number;
  color: string;
  onPress: () => void;
}) {
  return (
    <>
      <Line x1={x} x2={x} y1={high} y2={low} stroke={color} />
      <Rect
        x={x - width / 2}
        y={Math.min(open, close)}
        width={width}
        height={Math.max(Math.abs(open - close), 1)}
        fill={color}
        onPress={onPress}
      />
    </>
  );
}
function DrawingShape({
  drawing: d,
  x,
  y,
  foreground,
}: {
  drawing: Drawing;
  x: (time: number) => number;
  y: (price: number) => number;
  foreground: string;
}) {
  const a = d.points[0];
  const b = d.points[1] || a;
  if (!a) return null;
  const color = d.color.includes("var(") ? foreground : d.color;
  const x1 = x(a.time),
    x2 = x(b.time),
    y1 = y(a.price),
    y2 = y(b.price);
  if (![x1, x2, y1, y2].every(Number.isFinite)) return null;
  const line = (
    ax: number,
    ay: number,
    bx: number,
    by: number,
    key = "line",
  ) => (
    <Line
      key={key}
      x1={ax}
      y1={ay}
      x2={bx}
      y2={by}
      stroke={color}
      strokeWidth={1.5}
    />
  );
  if (d.type === "hline") return line(0, y1, 320, y1);
  if (d.type === "vline") return line(x1, 0, x1, 240);
  if (d.type === "rect")
    return (
      <Rect
        x={Math.min(x1, x2)}
        y={Math.min(y1, y2)}
        width={Math.abs(x2 - x1)}
        height={Math.abs(y2 - y1)}
        stroke={color}
        fill="none"
      />
    );
  if (d.type === "fib" || d.type === "fibext")
    return (
      <>
        {(d.type === "fib"
          ? [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]
          : [1, 1.272, 1.618, 2, 2.618]
        ).map((r) =>
          line(
            Math.min(x1, x2),
            y(a.price + (b.price - a.price) * r),
            320,
            y(a.price + (b.price - a.price) * r),
            String(r),
          ),
        )}
      </>
    );
  const slope = x1 === x2 ? 0 : (y2 - y1) / (x2 - x1);
  const left = d.type === "extended" ? 0 : x1;
  const right = ["ray", "extended"].includes(d.type) ? 320 : x2;
  return (
    <>
      {line(left, y1 + (left - x1) * slope, right, y1 + (right - x1) * slope)}
      {d.type === "measure" && (
        <SvgText
          x={Math.max(0, Math.min(x2, 220))}
          y={Math.max(12, Math.min(y2, 235))}
          fill={color}
          fontSize={10}
        >
          {number(b.price - a.price)} /{" "}
          {a.price === 0
            ? "—"
            : `${number(((b.price - a.price) / Math.abs(a.price)) * 100)}%`}
        </SvgText>
      )}
      {d.label && (
        <SvgText
          x={Math.max(0, Math.min(x1, 240))}
          y={Math.max(12, Math.min(y1, 235))}
          fill={color}
          fontSize={10}
        >
          {d.label}
        </SvgText>
      )}
    </>
  );
}

function OscillatorPlot({
  values,
  color,
  border,
}: {
  values: (number | null)[];
  color: string;
  border: string;
}) {
  const text = useText();
  const finite = values.filter(
    (v): v is number => v !== null && Number.isFinite(v),
  );
  if (!finite.length) return <Copy muted>完整预热区间不足。</Copy>;
  const min = Math.min(0, ...finite),
    max = Math.max(...finite),
    span = max - min || 1;
  const points = values
    .map((v, i) =>
      v === null
        ? null
        : `${10 + (i / (values.length - 1 || 1)) * 300},${90 - ((v - min) / span) * 80}`,
    )
    .filter(Boolean)
    .join(" ");
  return (
    <Svg
      width="100%"
      height={110}
      viewBox="0 0 320 110"
      accessibilityLabel={text("所选技术指标走势，具体值见选中 K 线资料。")}
    >
      <Line
        x1={10}
        x2={310}
        y1={90 - ((0 - min) / span) * 80}
        y2={90 - ((0 - min) / span) * 80}
        stroke={border}
      />
      <Polyline points={points} stroke={color} strokeWidth={1.5} fill="none" />
    </Svg>
  );
}
