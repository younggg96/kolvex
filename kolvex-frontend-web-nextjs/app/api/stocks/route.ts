import { NextRequest, NextResponse } from "next/server";

const BACKEND_API_URL = process.env.BACKEND_API_URL || "http://127.0.0.1:8000";

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

// Revalidate data every 15 minutes (900 seconds)
export const revalidate = 900;

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
        try {
          const quoteResponse = await fetch(
            `${BACKEND_API_URL}/api/v1/market/quote/${symbol}`,
            { next: { revalidate: 900 } }
          );
          if (!quoteResponse.ok) {
            throw new Error(`Backend returned ${quoteResponse.status}`);
          }
          const quoteData: BackendQuote = await quoteResponse.json();
          return NextResponse.json(transformQuote(quoteData), {
            headers: {
              "Cache-Control":
                "public, s-maxage=900, stale-while-revalidate=1800",
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

        try {
          // Build query string for symbols array
          const queryParams = symbolArray
            .map((s) => `symbols=${encodeURIComponent(s)}`)
            .join("&");
          const quotesResponse = await fetch(
            `${BACKEND_API_URL}/api/v1/market/quotes?${queryParams}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              next: { revalidate: 900 },
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
            .map(transformQuote);
          return NextResponse.json(transformedQuotes, {
            headers: {
              "Cache-Control":
                "public, s-maxage=900, stale-while-revalidate=1800",
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
        try {
          const interval = searchParams.get("interval") || "5m";
          const historyResponse = await fetch(
            `${BACKEND_API_URL}/api/v1/market/intraday/${symbol}?interval=${interval}`,
            { next: { revalidate: 300 } }
          );
          if (!historyResponse.ok) {
            throw new Error(`Backend returned ${historyResponse.status}`);
          }
          const historyData = await historyResponse.json();
          // Transform to chart format
          const chartData = (historyData.data || []).map(
            (d: { date: string; close: number; volume: number }) => ({
              time: d.date,
              value: d.close,
              volume: d.volume,
            })
          );
          return NextResponse.json(chartData, {
            headers: {
              "Cache-Control":
                "public, s-maxage=300, stale-while-revalidate=600",
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
        try {
          const overviewResponse = await fetch(
            `${BACKEND_API_URL}/api/v1/market/overview/${symbol}`,
            { next: { revalidate: 300 } }
          );

          if (!overviewResponse.ok) {
            throw new Error(`Backend returned ${overviewResponse.status}`);
          }

          const overviewData = await overviewResponse.json();
          return NextResponse.json(overviewData, {
            headers: {
              "Cache-Control":
                "public, s-maxage=300, stale-while-revalidate=600",
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
