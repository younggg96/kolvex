"use client";

import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface TradingViewChartProps {
  symbol: string;
  theme?: "light" | "dark";
  interval?:
    | "1"
    | "3"
    | "5"
    | "15"
    | "30"
    | "60"
    | "120"
    | "240"
    | "D"
    | "W"
    | "M";
  locale?: string;
}

declare global {
  interface Window {
    TradingView?: any;
    __tvScriptLoadingPromise__?: Promise<void>;
  }
}

const TV_SCRIPT_SRC = "https://s3.tradingview.com/tv.js";

function loadTradingViewScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.TradingView) return Promise.resolve();

  if (!window.__tvScriptLoadingPromise__) {
    window.__tvScriptLoadingPromise__ = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector(
        `script[src="${TV_SCRIPT_SRC}"]`
      ) as HTMLScriptElement | null;

      if (existing) {
        if (window.TradingView) return resolve();
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () =>
          reject(new Error("TradingView script failed to load"))
        );
        return;
      }

      const script = document.createElement("script");
      script.src = TV_SCRIPT_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error("TradingView script failed to load"));
      document.head.appendChild(script);
    });
  }

  return window.__tvScriptLoadingPromise__!;
}

export default function TradingViewChart({
  symbol,
  theme = "dark",
  interval = "D",
  locale = "en",
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);

  // 脚本是否可用
  const [scriptReady, setScriptReady] = useState(false);
  // 图表是否已就绪（onChartReady 回调后）
  const [chartReady, setChartReady] = useState(false);

  // 为每个实例生成唯一容器 ID
  const idRef = useRef(`tv_widget_${Math.random().toString(36).slice(2)}`);

  // 加载脚本
  useEffect(() => {
    let mounted = true;
    loadTradingViewScript()
      .then(() => mounted && setScriptReady(true))
      .catch((err) => console.error(err));
    return () => {
      mounted = false;
    };
  }, []);

  // 初始化 / 更新 widget
  useEffect(() => {
    if (!scriptReady || !containerRef.current || !window.TradingView) return;

    // 每次重建前重置 chartReady，确保骨架在切换 symbol/theme/interval 时显示
    setChartReady(false);

    // 清理旧实例
    if (widgetRef.current) {
      try {
        widgetRef.current.remove?.();
      } catch {}
      widgetRef.current = null;
    }

    // 容器置空
    containerRef.current.innerHTML = "";

    let unmounted = false;
    let flickerGuardTimer: any;
    let safetyTimeout: any;

    try {
      widgetRef.current = new window.TradingView.widget({
        autosize: true,
        symbol,
        interval,
        timezone: "America/New_York",
        theme,
        style: "1",
        locale,
        allow_symbol_change: true,
        studies: ["Moving Average@tv-basicstudies", "Volume@tv-basicstudies"],
        container_id: idRef.current,
        hide_top_toolbar: false,
        hide_legend: false,
        save_image: false,
        withdateranges: true,
      });

      // TradingView 会在内部加载数据与子资源，等它准备好再隐藏 Skeleton
      widgetRef.current.onChartReady?.(() => {
        // 防止 onChartReady 很快触发引起骨架闪烁，延时 150ms
        flickerGuardTimer = setTimeout(() => {
          if (!unmounted) setChartReady(true);
        }, 150);
      });

      // 兜底：若 8 秒仍未 ready（网络慢/偶发），也先隐藏骨架，避免一直 loading
      safetyTimeout = setTimeout(() => {
        if (!unmounted) setChartReady(true);
      }, 8000);
    } catch (e) {
      console.error("Error creating TradingView widget:", e);
    }

    return () => {
      unmounted = true;
      clearTimeout(flickerGuardTimer);
      clearTimeout(safetyTimeout);
      try {
        widgetRef.current?.remove?.();
      } catch {}
      widgetRef.current = null;
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [symbol, theme, interval, locale, scriptReady]);

  const showSkeleton = !chartReady;

  return (
    <div className="w-full h-full min-h-[500px] relative">
      {showSkeleton && (
        <div className="absolute inset-0 flex flex-col gap-3 p-4 bg-white dark:bg-card-dark z-10">
          {/* Chart Header Skeleton */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-24" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-8 w-8 rounded" />
            </div>
          </div>

          {/* Chart Toolbar Skeleton */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-7 w-20" />
            <div className="flex-1" />
            <Skeleton className="h-7 w-24" />
          </div>

          {/* Main Chart Area Skeleton */}
          <div className="flex-1 flex flex-col gap-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-center gap-2 h-12">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-full flex-1" />
              </div>
            ))}
          </div>

          {/* Timeline Skeleton */}
          <div className="flex justify-between">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-4 w-16" />
            ))}
          </div>
        </div>
      )}

      {/* 渲染容器（唯一 ID + ref） */}
      <div id={idRef.current} ref={containerRef} className="w-full h-full" />
    </div>
  );
}
