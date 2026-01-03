"use client";

import React, { useMemo } from "react";
import { Treemap, ResponsiveContainer, Tooltip } from "recharts";
import { cn } from "@/lib/utils";
import type { KOLPost } from "@/lib/kolPostsApi";

// ============================================================
// 1. Types / 类型定义
// ============================================================

interface TickerData {
  name: string;
  size: number;
  sentiment: number;
  bullish: number;
  bearish: number;
  neutral: number;
  totalViews: number;
}

// Recharts 传递给 Content 组件的 props 类型
interface CustomContentProps {
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  size: number; // 这里对应 dataKey="size"
  // 注意：Recharts 可能会把原始数据放在 payload 里，也可能直接展开
  // 我们在 processData 里把 sentiment 作为一个属性传进去了，但 Recharts 的 Treemap
  // 有时需要通过 index 找回原始数据，或者通过 root 传递。
  // 为了保险，我们在下面 CustomContent 中会尝试从 payload 获取，或者依靠组件传参。
  // 但最稳妥的方式是：Recharts Treemap content 接收到的 props 包含 index。
  index?: number;
  payload?: any;
  // 自定义属性
  sentiment?: number;
}

// Tooltip 的类型
interface TooltipPayload {
  payload: TickerData;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
}

interface TickerHeatmapProps {
  tweets: KOLPost[];
  title?: string;
  height?: number;
  className?: string;
  limit?: number;
}

// ============================================================
// 2. Data Processing / 数据处理逻辑
// ============================================================

function processData(tweets: KOLPost[], limit: number): TickerData[] {
  const tickerMap = new Map<
    string,
    {
      count: number;
      bullish: number;
      bearish: number;
      neutral: number;
      totalViews: number;
    }
  >();

  tweets.forEach((post) => {
    // 兼容处理：ai_tickers 可能是 ["TSLA"] 或者是 [{symbol: "TSLA"}]
    const rawTickers = post.tickers || [];
    const tickersList: string[] = rawTickers.map((t: any) =>
      typeof t === "string" ? t : t?.symbol || t
    );

    const sentimentValue = post.sentiment?.value || "neutral";
    const views = post.views_count || 0;

    tickersList.forEach((ticker) => {
      if (!ticker || typeof ticker !== "string") return;
      const cleaned = ticker.toUpperCase().replace(/^\$/, "").trim();

      // 过滤无效 Ticker
      if (!cleaned || cleaned.length > 6 || cleaned.length < 2) return;

      const existing = tickerMap.get(cleaned) || {
        count: 0,
        bullish: 0,
        bearish: 0,
        neutral: 0,
        totalViews: 0,
      };

      existing.count += 1;
      existing.totalViews += views;

      if (sentimentValue === "bullish") existing.bullish += 1;
      else if (sentimentValue === "bearish") existing.bearish += 1;
      else existing.neutral += 1;

      tickerMap.set(cleaned, existing);
    });
  });

  const result: TickerData[] = [];
  tickerMap.forEach((data, ticker) => {
    const total = data.bullish + data.bearish + data.neutral;
    // 计算加权情感分: (看涨 - 看跌) / 总数
    const sentiment = total > 0 ? (data.bullish - data.bearish) / total : 0;

    result.push({
      name: `$${ticker}`,
      size: data.count,
      sentiment,
      bullish: data.bullish,
      bearish: data.bearish,
      neutral: data.neutral,
      totalViews: data.totalViews,
    });
  });

  // 按提及热度排序
  return result.sort((a, b) => b.size - a.size).slice(0, limit);
}

function formatViews(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
  return String(value);
}

// ============================================================
// 3. Custom Content (The Tiles) / 自定义图块渲染
// ============================================================

const CustomContent = (props: CustomContentProps) => {
  const { x, y, width, height, name, size, payload } = props;

  // Recharts 有时把自定义数据藏在 payload 里
  const sentiment = payload?.sentiment ?? 0;

  // --- 🎨 核心配色策略 ---
  const getColor = (s: number) => {
    if (s > 0.5) return "#059669"; // Strong Bullish (Emerald-600)
    if (s > 0.1) return "#10b981"; // Bullish (Emerald-500)
    if (s < -0.5) return "#b91c1c"; // Strong Bearish (Red-700)
    if (s < -0.1) return "#ef4444"; // Bearish (Red-500)
    return "#334155"; // Neutral (Slate-700) - 深色背景对比度更好
  };

  const color = getColor(sentiment);

  // 显隐阈值：太小就不显示文字
  const showLabel = width > 36 && height > 24;
  const showCount = width > 50 && height > 40;

  // 动态计算字体大小
  const fontSize = Math.min(Math.max(Math.min(width, height) / 5, 10), 18);
  const countFontSize = Math.min(Math.max(Math.min(width, height) / 7, 9), 12);

  return (
    <g>
      {/* 1. 背景方块 */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={color}
        stroke="#09090b"
        strokeWidth={2}
        rx={4} // 圆角
        ry={4}
        className="transition-all duration-300 hover:brightness-110"
        style={{ cursor: "pointer" }}
      />

      {/* 2. Ticker 文本 ($TSLA) */}
      {showLabel && (
        <text
          x={x + width / 2}
          y={y + height / 2 - (showCount ? 8 : 0)}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#ffffff"
          fontSize={fontSize}
          fontWeight="800" // 加粗
          style={{
            pointerEvents: "none",
            // 关键：添加文字阴影，防止在浅色区域看不清
            textShadow: "0px 1px 3px rgba(0,0,0,0.6)",
            fontFamily: "var(--font-sans), system-ui, sans-serif",
          }}
        >
          {name}
        </text>
      )}

      {/* 3. 数量文本 (15 mentions) */}
      {showCount && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 10}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="rgba(255,255,255,0.85)" // 略微透明
          fontSize={countFontSize}
          fontWeight="500"
          style={{
            pointerEvents: "none",
            textShadow: "0px 1px 2px rgba(0,0,0,0.5)",
          }}
        >
          {size}
        </text>
      )}
    </g>
  );
};

// ============================================================
// 4. Custom Tooltip / 自定义悬浮框
// ============================================================

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  const total = data.bullish + data.bearish + data.neutral;
  const bullishPct = total > 0 ? (data.bullish / total) * 100 : 0;
  const neutralPct = total > 0 ? (data.neutral / total) * 100 : 0;

  // 根据分数决定 Tooltip 里的标签颜色
  let sentimentColor = "text-slate-400";
  let sentimentLabel = "Neutral";
  if (data.sentiment > 0.1) {
    sentimentColor = "text-emerald-400";
    sentimentLabel = "Bullish";
  } else if (data.sentiment < -0.1) {
    sentimentColor = "text-rose-400";
    sentimentLabel = "Bearish";
  }

  return (
    <div className="bg-zinc-950/90 backdrop-blur-md border border-zinc-800 text-zinc-50 px-4 py-3 rounded-lg shadow-xl min-w-[200px] z-50">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-800/50">
        <span className="text-lg font-bold tracking-wide text-white">
          {data.name}
        </span>
        <span
          className={`text-xs font-bold px-2 py-0.5 rounded bg-white/5 ${sentimentColor}`}
        >
          {sentimentLabel}
        </span>
      </div>

      {/* 数据行 */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-zinc-400">Mentions</span>
          <span className="font-mono font-semibold text-white">
            {data.size}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-zinc-400">Total Views</span>
          <span className="font-mono font-semibold text-white">
            {formatViews(data.totalViews)}
          </span>
        </div>
      </div>

      {/* 情感分布条 */}
      <div className="mt-4 pt-2">
        <div className="flex items-center justify-between mb-1.5 text-[10px] font-semibold text-zinc-500 uppercase">
          <span>Sentiment Split</span>
          <span>{total} Tweets</span>
        </div>
        <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden flex">
          {/* 绿色部分 */}
          <div
            className="h-full bg-emerald-500"
            style={{ width: `${bullishPct}%` }}
          />
          {/* 灰色部分 */}
          <div
            className="h-full bg-slate-600"
            style={{ width: `${neutralPct}%` }}
          />
          {/* 红色部分 (剩余空间) */}
          <div className="h-full bg-rose-500 flex-1" />
        </div>

        <div className="flex justify-between mt-1.5 text-[10px] font-medium">
          <span className="text-emerald-400">{data.bullish} Bull</span>
          <span className="text-rose-400">{data.bearish} Bear</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 5. Main Component / 主组件
// ============================================================

function TickerHeatmap({
  tweets,
  title = "Market Sentiment Heatmap",
  height = 400,
  className,
  limit = 30,
}: TickerHeatmapProps) {
  const data = useMemo(() => processData(tweets, limit), [tweets, limit]);

  // 空状态处理
  if (!data || data.length === 0) {
    return (
      <div
        className={cn(
          "rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 p-8 flex items-center justify-center h-[300px]",
          className
        )}
      >
        <div className="text-center space-y-2">
          <div className="text-4xl opacity-50">📊</div>
          <p className="text-zinc-500 text-sm font-medium">
            Not enough data to generate heatmap
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        // 容器样式：深色背景，轻微边框
        "rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden shadow-sm",
        className
      )}
    >
      {/* 标题栏 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
        <div>
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            {title}
          </h3>
          <p className="text-xs text-zinc-500 mt-1">
            Box size = Mention Volume
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-muted-foreground">Bullish</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-rose-500" />
            <span className="text-muted-foreground">Bearish</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-gray-500/60" />
            <span className="text-muted-foreground">Neutral</span>
          </div>
        </div>
      </div>

      {/* 图表区域 */}
      <div className="p-1 bg-zinc-50 dark:bg-zinc-950">
        <ResponsiveContainer width="100%" height={height}>
          <Treemap
            data={data}
            dataKey="size"
            aspectRatio={4 / 3}
            stroke="none"
            isAnimationActive={true}
            animationDuration={800}
            content={
              <CustomContent
                x={0}
                y={0}
                width={0}
                height={0}
                name=""
                size={0}
              />
            }
          >
            <Tooltip
              content={<CustomTooltip />}
              cursor={false}
              allowEscapeViewBox={{ x: true, y: true }}
            />
          </Treemap>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export { TickerHeatmap };
