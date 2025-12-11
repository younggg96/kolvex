"use client";

import { useEffect, useRef, useState, useId } from "react";
import { useTheme } from "next-themes";
import { Skeleton } from "@/components/ui/skeleton";

interface FinancialJuiceNewsProps {
  width?: string;
  height?: string;
}

export default function FinancialJuiceNews({
  width = "100%",
  height = "600px",
}: FinancialJuiceNewsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [containerHeight, setContainerHeight] = useState<string>(height);
  const initializingRef = useRef(false);
  const widgetInitializedRef = useRef(false);

  // 使用 useId 生成唯一的容器ID
  const uniqueId = useId();
  const containerId = `fj-news-widget-${uniqueId.replace(/:/g, "")}`;

  // 等待客户端挂载
  useEffect(() => {
    setMounted(true);
  }, []);

  // 计算实际高度（将百分比转换为像素）
  useEffect(() => {
    if (!mounted || !containerRef.current) return;

    const updateHeight = () => {
      if (!containerRef.current) return;

      // 如果 height 是百分比，计算实际像素值
      if (height.includes("%")) {
        const parentHeight = containerRef.current.parentElement?.clientHeight;
        if (parentHeight && parentHeight > 0) {
          const percentage = parseInt(height) / 100;
          const calculatedHeight = Math.floor(parentHeight * percentage);
          setContainerHeight(`${Math.max(calculatedHeight, 400)}px`);
        } else {
          // 回退到默认高度
          setContainerHeight("600px");
        }
      } else {
        setContainerHeight(height);
      }
    };

    updateHeight();

    // 监听窗口大小变化
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, [mounted, height]);

  useEffect(() => {
    // 等待挂载和主题解析
    if (!mounted || !resolvedTheme || !containerRef.current) return;

    // 如果已经初始化过，不再重复
    if (widgetInitializedRef.current) return;

    // 检查容器是否已经有 iframe（widget 已加载）
    const hasIframe = containerRef.current.querySelector("iframe");
    if (hasIframe) {
      setLoading(false);
      widgetInitializedRef.current = true;
      return;
    }

    // 防止同时进行多次初始化
    if (initializingRef.current) return;
    initializingRef.current = true;

    // 超时保护，8秒后强制结束 loading
    const loadingTimeout = setTimeout(() => {
      console.warn("Widget loading timeout");
      setLoading(false);
      initializingRef.current = false;
    }, 8000);

    const initWidget = () => {
      // 检查是否已经加载了脚本
      const existingScript = document.getElementById("FJ-Widgets");

      if (window.FJWidgets) {
        // FJWidgets 已可用，直接初始化
        clearTimeout(loadingTimeout);
        initializeWidget();
        return;
      }

      if (existingScript) {
        // 脚本标签存在但 FJWidgets 未就绪，等待加载完成
        let attempts = 0;
        const maxAttempts = 40; // 最多等待 4 秒
        const checkInterval = setInterval(() => {
          attempts++;
          if (window.FJWidgets) {
            clearInterval(checkInterval);
            clearTimeout(loadingTimeout);
            initializeWidget();
          } else if (attempts >= maxAttempts) {
            clearInterval(checkInterval);
            clearTimeout(loadingTimeout);
            console.warn("Widget script loading timeout");
            setLoading(false);
            initializingRef.current = false;
          }
        }, 100);
        return;
      }

      // 创建新脚本
      const script = document.createElement("script");
      script.type = "text/javascript";
      script.id = "FJ-Widgets";
      const r = Math.floor(Math.random() * (9999 - 0 + 1) + 0);
      script.src = `https://feed.financialjuice.com/widgets/widgets.js?r=${r}`;

      script.onload = () => {
        clearTimeout(loadingTimeout);
        initializeWidget();
      };

      script.onerror = () => {
        console.error("Failed to load FinancialJuice widget script");
        clearTimeout(loadingTimeout);
        setError(true);
        setLoading(false);
        initializingRef.current = false;
      };

      document.head.appendChild(script);
    };

    const initializeWidget = () => {
      if (!window.FJWidgets || !containerRef.current) {
        console.warn("FJWidgets or container not available");
        setLoading(false);
        initializingRef.current = false;
        return;
      }

      // 再次检查是否已有内容
      if (containerRef.current.querySelector("iframe")) {
        setLoading(false);
        initializingRef.current = false;
        widgetInitializedRef.current = true;
        return;
      }

      const isDark = resolvedTheme === "dark";

      // 使用计算后的高度
      const actualHeight = containerHeight.includes("%")
        ? "600px"
        : containerHeight;

      const options = {
        container: containerId,
        mode: isDark ? "Dark" : "Light",
        width: width,
        height: actualHeight,
        backColor: isDark ? "0f172a" : "f8fafc",
        fontColor: isDark ? "e2e8f0" : "334155",
        widgetType: "NEWS",
      };

      try {
        new window.FJWidgets.createWidget(options);
        setLoading(false);
        initializingRef.current = false;
        widgetInitializedRef.current = true;
      } catch (error) {
        console.error("Error initializing FinancialJuice widget:", error);
        setError(true);
        setLoading(false);
        initializingRef.current = false;
      }
    };

    // 延迟初始化以确保DOM完全准备好
    const timer = setTimeout(() => {
      initWidget();
    }, 200);

    return () => {
      clearTimeout(timer);
      clearTimeout(loadingTimeout);
      initializingRef.current = false;
    };
  }, [mounted, resolvedTheme, width, containerHeight, containerId]);

  // 在挂载前显示骨架屏
  if (!mounted) {
    return (
      <div
        className="relative w-full h-full"
        style={{ minHeight: height === "100%" ? "600px" : height }}
      >
        <div className="absolute inset-0 bg-white dark:bg-[#242d38] z-10 rounded-lg p-4 overflow-hidden">
          <div className="space-y-4">
            {[...Array(10)].map((_, index) => (
              <div
                key={index}
                className="flex items-start gap-3 pb-3 border-b border-gray-100 dark:border-gray-800 last:border-0 last:pb-0"
              >
                <Skeleton className="flex-shrink-0 w-8 h-8 rounded mt-1" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-full rounded" />
                  <div className="flex gap-2">
                    <Skeleton className="h-3 w-16 rounded opacity-60" />
                    <Skeleton className="h-3 w-24 rounded opacity-60" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex items-center justify-center w-full h-full"
        style={{ minHeight: containerHeight }}
      >
        <div className="text-center">
          <p className="text-sm text-gray-500 dark:text-white/50">
            Failed to load news feed
          </p>
          <button
            onClick={() => {
              setError(false);
              setLoading(true);
              widgetInitializedRef.current = false;
              initializingRef.current = false;
            }}
            className="mt-2 text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative w-full h-full"
      style={{ minHeight: containerHeight }}
    >
      {loading && (
        <div className="absolute inset-0 bg-white dark:bg-[#242d38] z-10 rounded-lg p-4 overflow-hidden transition-opacity duration-200">
          {/* Skeleton Loading */}
          <div className="space-y-4">
            {[...Array(10)].map((_, index) => (
              <div
                key={index}
                className="flex items-start gap-3 pb-3 border-b border-gray-100 dark:border-gray-800 last:border-0 last:pb-0"
              >
                <Skeleton className="flex-shrink-0 w-8 h-8 rounded mt-1" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-full rounded" />
                  <div className="flex gap-2">
                    <Skeleton className="h-3 w-16 rounded opacity-60" />
                    <Skeleton className="h-3 w-24 rounded opacity-60" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div
        id={containerId}
        ref={containerRef}
        className="w-full h-full rounded-lg overflow-hidden [&_iframe]:rounded-lg transition-opacity duration-200"
        style={{ minHeight: containerHeight, opacity: loading ? 0 : 1 }}
      />
      <style jsx global>{`
        [id^="fj-news-widget-"] {
          border-radius: 0.5rem;
        }
        [id^="fj-news-widget-"] iframe {
          border-radius: 0.5rem;
          border: none !important;
        }
        [id^="fj-news-widget-"] * {
          font-family: inherit !important;
        }
      `}</style>
    </div>
  );
}

// 扩展 Window 接口以支持 FJWidgets
declare global {
  interface Window {
    FJWidgets?: {
      createWidget: new (options: {
        container: string;
        mode: string;
        width: string;
        height: string;
        backColor: string;
        fontColor: string;
        widgetType: string;
      }) => void;
    };
  }
}
