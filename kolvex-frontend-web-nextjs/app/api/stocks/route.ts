import { NextRequest, NextResponse } from "next/server";

// Mock stock data
const mockStockQuotes = {
  AAPL: {
    symbol: "AAPL",
    name: "Apple Inc.",
    price: 178.25,
    change: 2.45,
    changePercent: 1.39,
    open: 175.80,
    high: 179.50,
    low: 175.20,
    volume: 58234567,
    marketCap: 2834000000000,
    pe: 29.5,
    week52High: 198.23,
    week52Low: 124.17,
  },
  TSLA: {
    symbol: "TSLA",
    name: "Tesla, Inc.",
    price: 242.84,
    change: -5.32,
    changePercent: -2.14,
    open: 248.16,
    high: 250.21,
    low: 241.35,
    volume: 125678901,
    marketCap: 771000000000,
    pe: 76.2,
    week52High: 299.29,
    week52Low: 101.81,
  },
  NVDA: {
    symbol: "NVDA",
    name: "NVIDIA Corporation",
    price: 495.22,
    change: 12.38,
    changePercent: 2.56,
    open: 482.84,
    high: 498.50,
    low: 480.12,
    volume: 45123456,
    marketCap: 1223000000000,
    pe: 115.3,
    week52High: 502.66,
    week52Low: 108.13,
  },
};

const mockChartData = {
  "5min": Array.from({ length: 78 }, (_, i) => ({
    time: new Date(Date.now() - (78 - i) * 5 * 60 * 1000).toISOString(),
    open: 175 + Math.random() * 5,
    high: 176 + Math.random() * 5,
    low: 174 + Math.random() * 5,
    close: 175 + Math.random() * 5,
    volume: Math.floor(Math.random() * 1000000),
  })),
};

// Enable runtime edge for faster responses
export const runtime = "nodejs";

// Revalidate data every 60 seconds
export const revalidate = 60;

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
        const quote = mockStockQuotes[symbol as keyof typeof mockStockQuotes] || {
          symbol,
          name: `${symbol} Inc.`,
          price: 100 + Math.random() * 100,
          change: -5 + Math.random() * 10,
          changePercent: -2 + Math.random() * 4,
        };
        return NextResponse.json(quote, {
          headers: {
            "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
          },
        });

      case "multiple":
        if (!symbols) {
          return NextResponse.json(
            { error: "Symbols are required" },
            { status: 400 }
          );
        }
        const symbolArray = symbols.split(",");
        const quotes = symbolArray.map((sym) => 
          mockStockQuotes[sym as keyof typeof mockStockQuotes] || {
            symbol: sym,
            name: `${sym} Inc.`,
            price: 100 + Math.random() * 100,
            change: -5 + Math.random() * 10,
            changePercent: -2 + Math.random() * 4,
          }
        );
        return NextResponse.json(quotes, {
          headers: {
            "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
          },
        });

      case "chart":
        if (!symbol) {
          return NextResponse.json(
            { error: "Symbol is required" },
            { status: 400 }
          );
        }
        const interval = searchParams.get("interval") || "5min";
        const chartData = mockChartData[interval as keyof typeof mockChartData] || mockChartData["5min"];
        return NextResponse.json(chartData, {
          headers: {
            "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
          },
        });

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
