import { NextRequest, NextResponse } from "next/server";
import {
  chartCache,
  quoteCache,
  overviewCache,
  CACHE_TTL,
  getCacheKey,
} from "@/lib/cache";

const NEXT_PUBLIC_BACKEND_API_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://127.0.0.1:8000";

// Backend API response interface
interface BackendQuote {
  symbol: string;
  name?: string;
  current_price?: number;
  change?: number;
  change_percent?: number;
  open?: number;
  day_high?: number;
  day_low?: number;
  volume?: number;
  avg_volume?: number;
  market_cap?: number;
  previous_close?: number;
  fifty_two_week_high?: number;
  fifty_two_week_low?: number;
}

// Chart data interface
interface ChartDataPoint {
  time: string;
  value: number;
  volume: number;
}

// Transform backend response to frontend format
function transformQuote(quote: BackendQuote) {
  return {
    symbol: quote.symbol,
    name: quote.name || quote.symbol,
    price: quote.current_price ?? 0,
    change: quote.change ?? 0,
    changePercent: quote.change_percent ?? 0,
    open: quote.open,
    high: quote.day_high,
    low: quote.day_low,
    volume: quote.volume,
    avgVolume: quote.avg_volume,
    marketCap: quote.market_cap,
    previousClose: quote.previous_close,
    week52High: quote.fifty_two_week_high,
    week52Low: quote.fifty_two_week_low,
  };
}

// Enable runtime edge for faster responses
export const runtime = "nodejs";

// Force dynamic to ensure fresh cache checks
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get("action");
  const symbol = searchParams.get("symbol");
  const symbols = searchParams.get("symbols");

  try {
    switch (action) {
      case "quote":
        if (!symbol) {
          return NextResponse.json(
            { error: "Symbol is required" },
            { status: 400 }
          );
        }

        // 检查内存缓存
        const quoteCacheKey = getCacheKey("quote", symbol);
        const cachedQuote = quoteCache.get(quoteCacheKey);
        if (cachedQuote) {
          return NextResponse.json(cachedQuote, {
            headers: {
              "Cache-Control":
                "public, s-maxage=60, stale-while-revalidate=120",
              "X-Cache": "HIT",
            },
          });
        }

        try {
          const quoteResponse = await fetch(
            `${NEXT_PUBLIC_BACKEND_API_URL}/api/v1/market/quote/${symbol}`
          );
          if (!quoteResponse.ok) {
            throw new Error(`Backend returned ${quoteResponse.status}`);
          }
          const quoteData: BackendQuote = await quoteResponse.json();
          const transformedQuote = transformQuote(quoteData);

          // 存入缓存
          quoteCache.set(quoteCacheKey, transformedQuote, CACHE_TTL.QUOTE);

          return NextResponse.json(transformedQuote, {
            headers: {
              "Cache-Control":
                "public, s-maxage=60, stale-while-revalidate=120",
              "X-Cache": "MISS",
            },
          });
        } catch (error) {
          console.error("Failed to fetch quote from backend:", error);
          // Fallback mock data
          return NextResponse.json(
            {
              symbol,
              name: `${symbol}`,
              price: 0,
              change: 0,
              changePercent: 0,
            },
            { status: 200 }
          );
        }

      case "multiple":
        if (!symbols) {
          return NextResponse.json(
            { error: "Symbols are required" },
            { status: 400 }
          );
        }
        const symbolArray = symbols.split(",").filter(Boolean);
        if (symbolArray.length === 0) {
          return NextResponse.json([], { status: 200 });
        }

        // 检查缓存，找出需要从后端获取的股票
        const cachedQuotes: ReturnType<typeof transformQuote>[] = [];
        const symbolsToFetch: string[] = [];

        for (const sym of symbolArray) {
          const cacheKey = getCacheKey("quote", sym);
          const cached =
            quoteCache.get<ReturnType<typeof transformQuote>>(cacheKey);
          if (cached) {
            cachedQuotes.push(cached);
          } else {
            symbolsToFetch.push(sym);
          }
        }

        // 如果所有股票都在缓存中，直接返回
        if (symbolsToFetch.length === 0) {
          return NextResponse.json(cachedQuotes, {
            headers: {
              "Cache-Control":
                "public, s-maxage=60, stale-while-revalidate=120",
              "X-Cache": "HIT",
            },
          });
        }

        try {
          // Build query string for symbols array
          const queryParams = symbolsToFetch
            .map((s) => `symbols=${encodeURIComponent(s)}`)
            .join("&");
          const quotesResponse = await fetch(
            `${NEXT_PUBLIC_BACKEND_API_URL}/api/v1/market/quotes?${queryParams}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
            }
          );
          if (!quotesResponse.ok) {
            throw new Error(`Backend returned ${quotesResponse.status}`);
          }
          // Backend returns { "AAPL": {...}, "TSLA": {...} } - convert to array
          const quotesData: Record<string, BackendQuote> =
            await quotesResponse.json();
          const transformedQuotes = Object.values(quotesData)
            .filter((q) => !("error" in q))
            .map((q) => {
              const transformed = transformQuote(q);
              // 存入缓存
              const cacheKey = getCacheKey("quote", q.symbol);
              quoteCache.set(cacheKey, transformed, CACHE_TTL.QUOTE);
              return transformed;
            });

          // 合并缓存的和新获取的
          const allQuotes = [...cachedQuotes, ...transformedQuotes];

          return NextResponse.json(allQuotes, {
            headers: {
              "Cache-Control":
                "public, s-maxage=60, stale-while-revalidate=120",
              "X-Cache": cachedQuotes.length > 0 ? "PARTIAL" : "MISS",
            },
          });
        } catch (error) {
          console.error("Failed to fetch multiple quotes from backend:", error);
          // Fallback: return empty data for each symbol
          const fallbackQuotes = symbolArray.map((sym) => ({
            symbol: sym,
            name: sym,
            price: 0,
            change: 0,
            changePercent: 0,
          }));
          return NextResponse.json(fallbackQuotes, { status: 200 });
        }

      case "chart":
        if (!symbol) {
          return NextResponse.json(
            { error: "Symbol is required" },
            { status: 400 }
          );
        }

        const interval = searchParams.get("interval") || "5m";
        const chartCacheKey = getCacheKey("chart", symbol, interval);

        // 检查内存缓存
        const cachedChart = chartCache.get<ChartDataPoint[]>(chartCacheKey);
        if (cachedChart) {
          return NextResponse.json(cachedChart, {
            headers: {
              "Cache-Control":
                "public, s-maxage=300, stale-while-revalidate=600",
              "X-Cache": "HIT",
            },
          });
        }

        try {
          const historyResponse = await fetch(
            `${NEXT_PUBLIC_BACKEND_API_URL}/api/v1/market/intraday/${symbol}?interval=${interval}`
          );
          if (!historyResponse.ok) {
            throw new Error(`Backend returned ${historyResponse.status}`);
          }
          const historyData = await historyResponse.json();
          // Transform to chart format
          const chartData: ChartDataPoint[] = (historyData.data || []).map(
            (d: { date: string; close: number; volume: number }) => ({
              time: d.date,
              value: d.close,
              volume: d.volume,
            })
          );

          // 存入缓存（5 分钟）
          chartCache.set(chartCacheKey, chartData, CACHE_TTL.CHART);

          return NextResponse.json(chartData, {
            headers: {
              "Cache-Control":
                "public, s-maxage=300, stale-while-revalidate=600",
              "X-Cache": "MISS",
            },
          });
        } catch (error) {
          console.error("Failed to fetch chart data from backend:", error);
          return NextResponse.json([], { status: 200 });
        }

      case "overview":
        if (!symbol) {
          return NextResponse.json(
            { error: "Symbol is required" },
            { status: 400 }
          );
        }

        const overviewCacheKey = getCacheKey("overview", symbol);

        // 检查内存缓存
        const cachedOverview = overviewCache.get(overviewCacheKey);
        if (cachedOverview) {
          return NextResponse.json(cachedOverview, {
            headers: {
              "Cache-Control":
                "public, s-maxage=600, stale-while-revalidate=1200",
              "X-Cache": "HIT",
            },
          });
        }

        try {
          const overviewResponse = await fetch(
            `${NEXT_PUBLIC_BACKEND_API_URL}/api/v1/market/overview/${symbol}`
          );

          if (!overviewResponse.ok) {
            throw new Error(`Backend returned ${overviewResponse.status}`);
          }

          const overviewData = await overviewResponse.json();

          // 存入缓存（10 分钟）
          overviewCache.set(overviewCacheKey, overviewData, CACHE_TTL.OVERVIEW);

          return NextResponse.json(overviewData, {
            headers: {
              "Cache-Control":
                "public, s-maxage=600, stale-while-revalidate=1200",
              "X-Cache": "MISS",
            },
          });
        } catch (error) {
          console.error("Failed to fetch stock overview from backend:", error);
          return NextResponse.json(
            { error: "Failed to fetch stock overview" },
            { status: 500 }
          );
        }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Stock API Error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch stock data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
