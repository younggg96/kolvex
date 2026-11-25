import { NextRequest, NextResponse } from "next/server";
import {
  chartCache,
  quoteCache,
  overviewCache,
  CACHE_TTL,
  QUOTE_CACHE_CONTROL,
  getCacheKey,
} from "@/lib/cache";
import { loadQuote, transformQuote, type BackendQuote } from "@/lib/server/stockQuote";
import { BACKEND_API_URL } from "@/lib/config/backend";

// Chart data interface
interface ChartDataPoint {
  time: string;
  value: number;
  volume: number;
}

// Enable runtime edge for faster responses
export const runtime = "nodejs";

// Force dynamic to ensure fresh cache checks
export const dynamic = "force-dynamic";
export const maxDuration = 30;

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
            { status: 400, headers: { "Cache-Control": "no-store" } },
          );
        }

        try {
          const transformedQuote = await loadQuote(symbol);
          return NextResponse.json(transformedQuote, {
            headers: { "Cache-Control": QUOTE_CACHE_CONTROL },
          });
        } catch (error) {
          console.error("Failed to fetch quote from backend:", error);
          return NextResponse.json(
            { error: "Quote unavailable" },
            { status: 503, headers: { "Cache-Control": "no-store" } },
          );
        }

      case "multiple":
        if (!symbols) {
          return NextResponse.json(
            { error: "Symbols are required" },
            { status: 400, headers: { "Cache-Control": "no-store" } },
          );
        }
        const symbolArray = [
          ...new Set(
            symbols
              .split(",")
              .map((symbol) => symbol.trim().toUpperCase())
              .filter(Boolean),
          ),
        ];
        if (symbolArray.length === 0) {
          return NextResponse.json([], { status: 200, headers: { "Cache-Control": "no-store" } });
        }

        // 检查缓存，找出需要从后端获取的股票
        const cachedQuotes: ReturnType<typeof transformQuote>[] = [];
        const symbolsToFetch: string[] = [];

        for (const sym of symbolArray) {
          const cacheKey = getCacheKey("quote", sym);
          const cached = quoteCache.get<ReturnType<typeof transformQuote>>(cacheKey);
          if (cached && Number.isFinite(cached.price) && cached.price > 0) {
            cachedQuotes.push(cached);
          } else {
            symbolsToFetch.push(sym);
          }
        }

        // 如果所有股票都在缓存中，直接返回
        if (symbolsToFetch.length === 0) {
          return NextResponse.json(cachedQuotes, {
            headers: {
              "Cache-Control": QUOTE_CACHE_CONTROL,
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
            `${BACKEND_API_URL}/api/v1/market/quotes?${queryParams}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              // Next's Data Cache also stores POST requests in route handlers.
              cache: "no-store",
              signal: AbortSignal.timeout(20000),
            },
          );
          if (!quotesResponse.ok) {
            throw new Error(`Backend returned ${quotesResponse.status}`);
          }
          // Backend returns { "AAPL": {...}, "TSLA": {...} } - convert to array
          const quotesData: Record<string, BackendQuote> = await quotesResponse.json();
          const transformedQuotes = Object.values(quotesData)
            .filter(
              (q) =>
                q &&
                !("error" in q) &&
                symbolsToFetch.includes(q.symbol) &&
                typeof q.current_price === "number" &&
                Number.isFinite(q.current_price) &&
                q.current_price > 0,
            )
            .map((q) => {
              const transformed = transformQuote(q);
              // 存入缓存
              const cacheKey = getCacheKey("quote", q.symbol);
              quoteCache.set(cacheKey, transformed, CACHE_TTL.QUOTE);
              return transformed;
            });

          // 合并缓存的和新获取的
          const allQuotes = [...cachedQuotes, ...transformedQuotes];
          const complete = allQuotes.length === symbolArray.length;

          return NextResponse.json(allQuotes, {
            headers: {
              "Cache-Control": complete ? QUOTE_CACHE_CONTROL : "no-store",
              "X-Cache": cachedQuotes.length > 0 ? "PARTIAL" : "MISS",
            },
          });
        } catch (error) {
          console.error("Failed to fetch multiple quotes from backend:", error);
          // Preserve successful cached prices; never fabricate zero-price quotes.
          return cachedQuotes.length
            ? NextResponse.json(cachedQuotes, {
                headers: { "Cache-Control": "no-store", "X-Cache": "PARTIAL" },
              })
            : NextResponse.json(
                { error: "Quotes unavailable" },
                { status: 503, headers: { "Cache-Control": "no-store" } },
              );
        }

      case "chart":
        if (!symbol) {
          return NextResponse.json(
            { error: "Symbol is required" },
            { status: 400, headers: { "Cache-Control": "no-store" } },
          );
        }

        const interval = searchParams.get("interval") || "5m";
        const chartCacheKey = getCacheKey("chart", symbol, interval);

        // 检查内存缓存
        const cachedChart = chartCache.get<ChartDataPoint[]>(chartCacheKey);
        if (cachedChart) {
          return NextResponse.json(cachedChart, {
            headers: {
              "Cache-Control": "no-store",
              "X-Cache": "HIT",
            },
          });
        }

        try {
          const historyResponse = await fetch(
            `${BACKEND_API_URL}/api/v1/market/intraday/${encodeURIComponent(symbol)}?interval=${encodeURIComponent(interval)}&prepost=true`,
            // Next's Data Cache has no expiry here; freshness comes from chartCache.
            { cache: "no-store", signal: AbortSignal.timeout(15_000) },
          );
          if (!historyResponse.ok) {
            throw new Error(`Backend returned ${historyResponse.status}`);
          }
          const historyData = await historyResponse.json();
          // Transform to chart format
          const chartData: ChartDataPoint[] = (historyData.data || [])
            .filter((bar: { close: number }) => Number.isFinite(bar.close) && bar.close > 0)
            .map((bar: { date: string; close: number; volume: number }) => ({
              time: bar.date,
              value: bar.close,
              volume: bar.volume,
            }));

          if (!chartData.length) throw new Error("History unavailable");
          chartCache.set(chartCacheKey, chartData, 60);

          return NextResponse.json(chartData, {
            headers: {
              "Cache-Control": "no-store",
              "X-Cache": "MISS",
            },
          });
        } catch (error) {
          console.error("Failed to fetch chart data from backend:", error);
          return NextResponse.json([], { status: 503, headers: { "Cache-Control": "no-store" } });
        }

      case "sparklines": {
        const list = [
          ...new Set(
            (symbols ?? "")
              .split(",")
              .map((value) => value.trim().toUpperCase())
              .filter(Boolean),
          ),
        ];
        if (list.length === 0 || list.length > 60) {
          return NextResponse.json(
            { error: "1–60 symbols are required" },
            { status: 400, headers: { "Cache-Control": "no-store" } },
          );
        }
        const sparklineInterval = searchParams.get("interval") || "5m";
        const query = new URLSearchParams(list.map((value) => ["symbols", value]));
        query.set("interval", sparklineInterval);
        try {
          const response = await fetch(`${BACKEND_API_URL}/api/v1/market/sparklines?${query}`, {
            cache: "no-store",
            signal: AbortSignal.timeout(20_000),
          });
          if (!response.ok) {
            // 404 means the backend predates the batch route; the client falls back.
            return NextResponse.json(
              { error: "Sparklines unavailable" },
              {
                status: response.status === 404 ? 404 : 503,
                headers: { "Cache-Control": "no-store" },
              },
            );
          }
          const body: { data?: Record<string, number[]> } = await response.json();
          return NextResponse.json(body.data ?? {}, { headers: { "Cache-Control": "no-store" } });
        } catch (error) {
          console.error("Failed to fetch sparklines from backend:", error);
          return NextResponse.json(
            { error: "Sparklines unavailable" },
            { status: 503, headers: { "Cache-Control": "no-store" } },
          );
        }
      }

      case "overview":
        if (!symbol) {
          return NextResponse.json(
            { error: "Symbol is required" },
            { status: 400, headers: { "Cache-Control": "no-store" } },
          );
        }

        const overviewCacheKey = getCacheKey("overview", symbol);

        // 检查内存缓存
        const cachedOverview = overviewCache.get(overviewCacheKey);
        if (cachedOverview) {
          return NextResponse.json(cachedOverview, {
            headers: {
              "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200",
              "X-Cache": "HIT",
            },
          });
        }

        try {
          const overviewResponse = await fetch(
            `${BACKEND_API_URL}/api/v1/market/overview/${symbol}`,
            // Next's Data Cache has no expiry here; freshness comes from overviewCache.
            { cache: "no-store" },
          );

          if (!overviewResponse.ok) {
            throw new Error(`Backend returned ${overviewResponse.status}`);
          }

          const overviewData = await overviewResponse.json();

          // 存入缓存（10 分钟）
          overviewCache.set(overviewCacheKey, overviewData, CACHE_TTL.OVERVIEW);

          return NextResponse.json(overviewData, {
            headers: {
              "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200",
              "X-Cache": "MISS",
            },
          });
        } catch (error) {
          console.error("Failed to fetch stock overview from backend:", error);
          return NextResponse.json(
            { error: "Failed to fetch stock overview" },
            { status: 500, headers: { "Cache-Control": "no-store" } },
          );
        }

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400, headers: { "Cache-Control": "no-store" } },
        );
    }
  } catch (error) {
    console.error("Stock API Error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch stock data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
