"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";

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
  const initializingRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;

    // 检查容器是否已经有 iframe（widget 已加载）
    const hasIframe = containerRef.current.querySelector("iframe");
    if (hasIframe) {
      setLoading(false);
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
        return;
      }

      const isDark = resolvedTheme === "dark";

      const options = {
        container: containerRef.current.id,
        mode: isDark ? "Dark" : "Light",
        width: width,
        height: height,
        backColor: isDark ? "0f172a" : "f8fafc",
        fontColor: isDark ? "e2e8f0" : "334155",
        widgetType: "NEWS",
      };

      try {
        new window.FJWidgets.createWidget(options);
        setLoading(false);
        initializingRef.current = false;
      } catch (error) {
        console.error("Error initializing FinancialJuice widget:", error);
        setError(true);
        setLoading(false);
        initializingRef.current = false;
      }
    };

    // 延迟初始化以确保主题已加载
    const timer = setTimeout(() => {
      initWidget();
    }, 100);

    return () => {
      clearTimeout(timer);
      clearTimeout(loadingTimeout);
      initializingRef.current = false;
    };
  }, [width, height, resolvedTheme]);

  if (error) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <div className="text-center">
          <p className="text-sm text-gray-500 dark:text-white/50">
            Failed to load news feed
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {loading && (
        <div className="absolute inset-0 bg-gray-50/50 dark:bg-white/[0.02] z-10 rounded-lg p-4 space-y-[5px] transition-opacity duration-200">
          {/* Skeleton Loading */}
          {[...Array(8)].map((_, index) => (
            <div
              key={index}
              className="animate-pulse flex items-center gap-3 h-[50px] px-3 bg-gray-100/80 dark:bg-white/5 rounded-lg"
            >
              <div className="flex-shrink-0 w-10 h-10 bg-gray-200 dark:bg-white/10 rounded"></div>
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-gray-200 dark:bg-white/10 rounded w-3/4"></div>
                <div className="h-2.5 bg-gray-200 dark:bg-white/10 rounded w-full"></div>
              </div>
            </div>
          ))}
        </div>
      )}
      <div
        id="financialjuice-news-widget-container"
        ref={containerRef}
        className="w-full h-full rounded-lg overflow-hidden [&_iframe]:rounded-lg transition-opacity duration-200"
        style={{ minHeight: height, opacity: loading ? 0 : 1 }}
      />
      <style jsx global>{`
        #financialjuice-news-widget-container {
          border-radius: 0.5rem;
        }
        #financialjuice-news-widget-container iframe {
          border-radius: 0.5rem;
          border: none !important;
        }
        #financialjuice-news-widget-container * {
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
