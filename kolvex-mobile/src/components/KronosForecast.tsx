import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import Svg, { Line, Path } from "react-native-svg";
import {
  FORECAST_HORIZON,
  klineForecast,
  type KlineForecast,
} from "../lib/stockExtrasApi";
import { useText } from "../lib/i18n";
import { useTheme } from "../lib/theme";
import { useAuth } from "../state/Auth";
import { Filters } from "./Content";
import { Button, Copy, Failure, Glass, Section, styles } from "./UI";

const ERRORS: Record<string, string> = {
  not_configured: "预测模型尚未在后端配置。",
  unauthorized: "登录后可查看 K 线预测。",
  unavailable: "预测暂时不可用，请稍后重试。",
};
const signed = (value: number) =>
  `${value > 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
const W = 320;
const H = 160;

/** Experimental model output: median path and a P10–P90 closing band. Runs on request. */
export function KronosForecast({ symbol }: { symbol: string }) {
  const t = useTheme();
  const text = useText();
  const user = useAuth().session!.user.id;
  const [interval, setInterval] = useState("1d");
  const [data, setData] = useState<KlineForecast | null>(null);
  const [request, setRequest] = useState<{ pending: boolean; error?: string }>({
    pending: false,
  });
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const run = (next: string) => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setRequest({ pending: true });
    klineForecast(symbol, next, user, current.signal)
      .then((value) => {
        if (current.signal.aborted) return;
        setData(value);
        setRequest({ pending: false });
      })
      .catch((failure) => {
        if (!current.signal.aborted)
          setRequest({
            pending: false,
            error: failure instanceof Error ? failure.message : "unavailable",
          });
      });
  };
  const shown = data?.interval === interval ? data : null;
  const chart = (() => {
    if (!shown?.points.length) return null;
    const closes = [shown.last_close, ...shown.points.map((p) => p.close)];
    const lows = [shown.last_close, ...shown.points.map((p) => p.close_p10)];
    const highs = [shown.last_close, ...shown.points.map((p) => p.close_p90)];
    const min = Math.min(...lows);
    const span = Math.max(...highs) - min || 1;
    const x = (i: number) => 4 + (i / (closes.length - 1)) * (W - 8);
    const y = (v: number) => H - 8 - ((v - min) / span) * (H - 16);
    const line = (values: number[]) =>
      values.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join("");
    const band = `${line(highs)}${[...lows]
      .reverse()
      .map((v, i) => `L${x(lows.length - 1 - i)},${y(v)}`)
      .join("")}Z`;
    return { median: line(closes), band, base: y(shown.last_close) };
  })();
  const up = (shown?.summary.median_return ?? 0) >= 0;
  return (
    <Glass style={{ padding: 16, gap: 12 }}>
      <Section title="Kronos K 线预测（实验）" />
      <Filters
        values={[
          ["1d", "日线"],
          ["1wk", "周线"],
        ]}
        value={interval}
        onChange={setInterval}
        disabled={request.pending}
      />
      <Button disabled={request.pending} onPress={() => run(interval)}>
        {request.pending
          ? "预测中…"
          : shown
            ? "重新预测"
            : `预测未来 ${FORECAST_HORIZON} 根 K 线`}
      </Button>
      {request.pending && (
        <Copy size={12} muted>
          模型推理可能需要一两分钟。
        </Copy>
      )}
      {!!request.error && (
        <Failure message={ERRORS[request.error] ?? ERRORS.unavailable} />
      )}
      {shown && chart && (
        <>
          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel={`${text("预测中位收益")} ${signed(shown.summary.median_return)}，P10 ${signed(shown.summary.p10_return)}，P90 ${signed(shown.summary.p90_return)}`}
          >
            <Svg
              width="100%"
              height={180}
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="none"
              accessible={false}
            >
              <Path d={chart.band} fill={t.secondary} opacity={0.18} />
              <Line
                x1={0}
                x2={W}
                y1={chart.base}
                y2={chart.base}
                stroke={t.border}
                strokeDasharray="3 5"
              />
              <Path
                d={chart.median}
                stroke={up ? t.chartUp : t.chartDown}
                strokeWidth={2}
                fill="none"
                strokeLinejoin="round"
              />
            </Svg>
            <View style={styles.row}>
              <Copy size={12} muted localize={false}>
                {shown.context_end}
              </Copy>
              <Copy size={12} muted localize={false}>
                {shown.points[shown.points.length - 1].date}
              </Copy>
            </View>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 12 }}>
            {(
              [
                ["中位收益", signed(shown.summary.median_return)],
                ["上涨概率", `${(shown.summary.prob_up * 100).toFixed(0)}%`],
                ["P10 收益", signed(shown.summary.p10_return)],
                ["P90 收益", signed(shown.summary.p90_return)],
              ] as const
            ).map(([label, value]) => (
              <View key={label} style={{ width: "50%", gap: 2 }}>
                <Copy size={12} muted>
                  {label}
                </Copy>
                <Copy size={15} bold localize={false}>
                  {value}
                </Copy>
              </View>
            ))}
          </View>
          <Copy size={12} muted localize={false}>
            {`${shown.model} · ${shown.samples} samples · lookback ${shown.lookback}`}
          </Copy>
        </>
      )}
      <Copy size={12} muted>
        实验性模型输出：实线为中位路径，阴影为收盘价 P10–P90
        区间。不是预测承诺，也不是交易建议。
      </Copy>
    </Glass>
  );
}
