import { View } from "react-native";
import { ChartCardSkeleton, FormSkeleton } from "../../components/Skeletons";
import { useChartGestures } from "../../lib/useChartGestures";
import { useRef, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { apiRequest } from "../../lib/http";
import { useResource } from "../../lib/useResource";
import { validBars } from "../../lib/technicalData";
import { isSymbol } from "../../lib/models";
import type {
  PriceBar,
  Drawing,
  AiTechnicalAnalysis,
} from "../../lib/technicalTypes";
import {
  indicatorOrder,
  type IndicatorKey,
} from "../../lib/technicalIndicators";
import { Page, Button, Copy, Glass } from "../../components/UI";
import { Filters, ResourceState, AuthGate } from "../../components/Content";
import { CandleGraph } from "../../components/CandleGraph";
import {
  DrawingEditor,
  type DrawingEditorHandle,
} from "../../components/DrawingEditor";
import { useAuth } from "../../state/Auth";
import { TechnicalAI } from "../../components/TechnicalAI";
import { KronosForecast } from "../../components/KronosForecast";
export default function Technical() {
  const p = useLocalSearchParams<{ symbol: string }>();
  const symbol = (p.symbol || "").toUpperCase();
  return isSymbol(symbol) ? (
    <Workspace key={symbol} symbol={symbol} />
  ) : (
    <Page title="技术图表">
      <Copy>股票代码无效。</Copy>
    </Page>
  );
}
function Workspace({ symbol }: { symbol: string }) {
  const [period, setPeriod] = useState("1y");
  const [interval, setInterval] = useState("1d");
  const [offset, setOffset] = useState(0);
  const [count, setCount] = useState("60");
  const [selected, setSelected] = useState<number>();
  const [enabled, setEnabled] = useState<IndicatorKey[]>(["volume", "ema20"]);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [analysis, setAnalysis] = useState<AiTechnicalAnalysis>();
  const [showAI, setShowAI] = useState(true);
  const [tool, setTool] = useState<Drawing["type"]>("trend");
  const [drawMode, setDrawMode] = useState(false);
  const editor = useRef<DrawingEditorHandle>(null);
  const signedIn = !!useAuth().session;
  const r = useResource(
    `technical:${symbol}:${period}:${interval}`,
    async (signal) => {
      const data = await apiRequest<{ data: PriceBar[] }>(
        `/market/history/${encodeURIComponent(symbol)}?period=${period}&interval=${interval}`,
        { signal },
      );
      return validBars(data.data);
    },
  );
  const bars = r.data || [];
  const gestures = useChartGestures(
    { length: bars.length, count: Number(count), offset },
    (next) => {
      setCount(String(next.count));
      setOffset(next.offset);
      setSelected(Math.max(0, next.length - next.offset - 1));
    },
  );
  const start = Math.max(0, bars.length - Number(count) - offset);
  const current = Math.min(bars.length - 1, selected ?? bars.length - 1);
  return (
    <Page
      title={`${symbol} 技术图表`}
      subtitle="原生 K 线、指标与云端画线。"
      onRefresh={r.refresh}
      refreshing={r.loading}
      scrollEnabled={!drawMode}
    >
      <Filters
        values={[
          ["1mo", "1 个月"],
          ["3mo", "3 个月"],
          ["1y", "1 年"],
          ["5y", "5 年"],
        ]}
        value={period}
        onChange={(v) => {
          setPeriod(v);
          setOffset(0);
          setSelected(undefined);
        }}
      />
      <Filters
        values={[
          ["1h", "小时"],
          ["1d", "日线"],
          ["1wk", "周线"],
          ["1mo", "月线"],
        ]}
        value={interval}
        onChange={(v) => {
          setInterval(v);
          setOffset(0);
          setSelected(undefined);
        }}
      />
      <Filters
        values={[
          ["30", "放大 · 30 根"],
          ["60", "60 根"],
          ["120", "缩小 · 120 根"],
        ]}
        value={count}
        onChange={setCount}
      />
      <ResourceState skeleton={<ChartCardSkeleton />}
        resource={r}
        empty={!bars.length}
        message="数据源未提供此周期 K 线"
      />
      {!!bars.length && (
        <Glass style={{ padding: 12, gap: 12 }}>
          <View
            {...(drawMode ? {} : gestures.panHandlers)}
            onLayout={gestures.onLayout}
          >
            <CandleGraph
              bars={bars}
              start={start}
              count={Number(count)}
              selected={current}
              onSelect={(i) => {
                setSelected(i);
                if (i < start)
                  setOffset(Math.max(0, bars.length - Number(count) - i));
                if (i >= start + Number(count))
                  setOffset(Math.max(0, bars.length - 1 - i));
              }}
              enabled={enabled}
              drawings={drawings}
              draw={
                drawMode
                  ? {
                      single: tool === "hline" || tool === "vline",
                      onComplete: (points) => editor.current?.add(tool, points),
                    }
                  : undefined
              }
              analysis={
                showAI && analysis?.interval === interval ? analysis : undefined
              }
            />
          </View>
          <Copy size={12} muted>
            {drawMode
              ? "拖动绘制两点画线，水平线和垂直线轻点放置。"
              : "横向拖动浏览 K 线，双指缩放；也可使用窗口和前后按钮。"}
          </Copy>
          {signedIn && (
            <Button selected={drawMode} onPress={() => setDrawMode((v) => !v)}>
              {drawMode ? "完成绘制" : "在图上绘制"}
            </Button>
          )}
          <Copy size={12} muted>{`当前窗口：${count} 根`}</Copy>
          <Button
            disabled={start === 0}
            onPress={() =>
              setOffset((v) =>
                Math.min(
                  Math.max(0, bars.length - Number(count)),
                  v + Number(count),
                ),
              )
            }
          >
            更早 K 线
          </Button>
          <Button
            disabled={offset === 0}
            onPress={() => setOffset((v) => Math.max(0, v - Number(count)))}
          >
            较新 K 线
          </Button>
        </Glass>
      )}
      {analysis && (
        <>
          <Button selected={showAI} onPress={() => setShowAI((v) => !v)}>
            {showAI ? "隐藏 AI 叠加" : "显示 AI 叠加"}
          </Button>
          {analysis.interval !== interval && (
            <Copy muted>
              此分析属于 {analysis.interval} 周期，切换到对应周期后才叠加。
            </Copy>
          )}
        </>
      )}
      {indicatorOrder.map((k) => (
        <Button
          key={k}
          selected={enabled.includes(k)}
          onPress={() =>
            setEnabled((v) =>
              v.includes(k) ? v.filter((x) => x !== k) : [...v, k],
            )
          }
        >
          {k.toUpperCase()}
        </Button>
      ))}
      <Copy size={12} muted>
        指标使用与 Web 相同的计算。缺少完整预热区间时以 — 显示；VWAP
        在日线及更长周期以首根为锚。
      </Copy>
      <AuthGate inline title="画线与 AI 技术研究" skeleton={<FormSkeleton fields={2} />}>
        <DrawingEditor
          symbol={symbol}
          bar={bars[current]}
          onChange={setDrawings}
          type={tool}
          setType={setTool}
          ref={editor}
        />
        <TechnicalAI
          symbol={symbol}
          period={period}
          interval={interval}
          onResult={setAnalysis}
        />
        <KronosForecast symbol={symbol} />
      </AuthGate>
    </Page>
  );
}
