"use client";

import { useState } from "react";
import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useFreeResearch } from "@/components/decision/SecData";
import { useFinancialFormat } from "@/components/decision/StockFinancialData";
import { useCopy } from "@/components/decision/shared";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RETURN_RANGES,
  stockReturnPoints,
  type AdjustedHistory,
  type PortfolioPerformance,
  type ReturnPoint,
  type ReturnRange,
} from "@/lib/featuredInvestors";
import { signedPercent } from "@/lib/format";
import { institutionKey } from "@/lib/freeResearch";
import { cn } from "@/lib/utils";

export function SpotlightStatus({
  loading,
  text,
  retry,
}: {
  loading?: boolean;
  text: string;
  retry?: () => void;
}) {
  const c = useCopy();
  return (
    <div
      role={retry && !loading ? "alert" : "status"}
      className="space-y-3 rounded-xl bg-muted/35 p-4"
    >
      <p className="text-sm text-muted-foreground">{text}</p>
      {loading ? (
        <Skeleton className="h-20 rounded-lg" />
      ) : retry ? (
        <Button variant="outline" size="sm" onClick={retry}>
          {c("Retry", "重试")}
        </Button>
      ) : null}
    </div>
  );
}

export function StockReturnChart({ stock }: { stock?: { ticker: string; path: string } }) {
  const c = useCopy();
  if (!stock) {
    return (
      <SpotlightStatus
        text={c("No ticker with price history is available.", "暂无可查询历史行情的股票代码。")}
      />
    );
  }
  return <StockHistory ticker={stock.ticker} path={stock.path} />;
}

function StockHistory({ ticker, path }: { ticker: string; path: string }) {
  const c = useCopy();
  const [range, setRange] = useState<ReturnRange>("6m");
  const resource = useFreeResearch<AdjustedHistory>(`/api${path}`);
  const labels = { "3m": c("3M", "3个月"), "6m": c("6M", "6个月"), "1y": c("1Y", "1年") };
  const points = resource.data ? stockReturnPoints(resource.data, range) : [];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="figure text-base font-semibold">
          {ticker} {c("stock return", "个股收益")}
        </h3>
        <SegmentedControl
          size="sm"
          label={c("Stock return period", "个股收益区间")}
          options={RETURN_RANGES.map((value) => ({ value, label: labels[value] }))}
          value={range}
          onChange={setRange}
        />
      </div>
      {resource.loading || resource.error ? (
        <SpotlightStatus
          loading={resource.loading}
          text={
            resource.loading
              ? c("Loading stock returns…", "正在加载个股收益…")
              : c("Stock returns could not be loaded.", "个股收益加载失败。")
          }
          retry={resource.refresh}
        />
      ) : points.length < 2 ? (
        <SpotlightStatus text={c("Too few prices in this period.", "该区间的行情数据不足。")} />
      ) : (
        <ReturnPlot points={points} name={ticker} />
      )}
      <p className="text-xs text-muted-foreground">
        {c(
          "Yahoo Finance adjusted daily closes. The first available close in the period is 0%.",
          "来源为 Yahoo Finance 复权日收盘价，区间内首个可用收盘价记为 0%。",
        )}
      </p>
    </div>
  );
}

export function PortfolioReturnChart({ manager }: { manager: string }) {
  const c = useCopy();
  const resource = useFreeResearch<PortfolioPerformance>(`${institutionKey(manager)}/performance`);
  const performance = resource.data;
  const points =
    performance?.status === "ready"
      ? performance.points.map((point) => ({
          date: point.date,
          value: point.value * 100,
          benchmark: point.benchmark * 100,
        }))
      : [];
  const name = c("13F model", "13F 模拟");

  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold">
        {c("Simulated 13F return vs. SPY", "13F 模拟收益对比 SPY")}
      </h3>
      {resource.loading || resource.error ? (
        <SpotlightStatus
          loading={resource.loading}
          text={
            resource.loading
              ? c("Loading simulated returns…", "正在加载模拟收益…")
              : c("Simulated returns could not be loaded.", "模拟收益加载失败。")
          }
          retry={resource.refresh}
        />
      ) : performance?.status === "pending" ? (
        <SpotlightStatus text={c("The first calculation is pending.", "正在等待首次计算。")} />
      ) : points.length < 2 ? (
        <SpotlightStatus
          text={c("Too few quarters have usable price data.", "有可用行情的季度不足。")}
        />
      ) : (
        <ReturnPlot points={points} name={name} benchmark />
      )}
      <p className="text-xs leading-5 text-muted-foreground">
        {c(
          "Retrospective model based on quarter-end holdings, which were disclosed later. Excludes options and fees and can differ from actual fund performance.",
          "按季度末披露持仓回看，申报晚于季度末。模拟不计期权和费用，结果可能与基金实际业绩不同。",
        )}
      </p>
    </div>
  );
}

function ReturnPlot({
  points,
  name,
  benchmark,
}: {
  points: ReturnPoint[];
  name: string;
  benchmark?: boolean;
}) {
  const f = useFinancialFormat();
  const first = points[0];
  const last = points[points.length - 1];
  const values = points.map((point) => ({ ...point, time: Date.parse(point.date) }));
  const tone = last.value > 0 ? "text-positive" : last.value < 0 ? "text-negative" : "";
  const color = benchmark
    ? "rgb(var(--compare-1))"
    : last.value < 0
      ? "rgb(var(--chart-down))"
      : "rgb(var(--chart-up))";
  return (
    <figure className="min-w-0 space-y-2">
      <figcaption className="space-y-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span
            className={cn("figure text-2xl font-semibold", benchmark ? "text-foreground" : tone)}
          >
            {benchmark && <span className="mr-1.5 text-sm text-muted-foreground">{name}</span>}
            {signedPercent(last.value)}
          </span>
          {benchmark && (
            <span className="figure text-sm text-muted-foreground">
              SPY {signedPercent(last.benchmark)}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {f.date(first.date)} – {f.date(last.date)}
        </p>
      </figcaption>
      <div className="h-44 min-w-0 md:h-52">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={values}
            margin={{ top: 6, right: 8, bottom: 2, left: 0 }}
            accessibilityLayer
          >
            <XAxis dataKey="time" type="number" domain={["dataMin", "dataMax"]} hide />
            <YAxis
              width={48}
              tick={{ fill: "rgb(var(--muted-foreground))", fontSize: 11 }}
              tickFormatter={(value) => signedPercent(value, 0)}
              axisLine={false}
              tickLine={false}
            />
            <ReferenceLine
              y={0}
              stroke="rgb(var(--muted-foreground) / 0.4)"
              strokeDasharray="3 4"
            />
            <Tooltip
              labelFormatter={(value) => f.date(new Date(Number(value)).toISOString())}
              formatter={(value: number) => signedPercent(value)}
              contentStyle={{
                background: "rgb(var(--background))",
                color: "rgb(var(--foreground))",
                borderColor: "rgb(var(--border))",
                borderRadius: 12,
              }}
            />
            <Line
              dataKey="value"
              name={name}
              stroke={color}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            {benchmark && (
              <Line
                dataKey="benchmark"
                name="SPY"
                stroke="rgb(var(--compare-2))"
                strokeDasharray="5 4"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
