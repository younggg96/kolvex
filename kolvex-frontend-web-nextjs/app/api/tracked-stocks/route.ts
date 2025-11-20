import { NextRequest, NextResponse } from "next/server";
import { TrackedStock, KOLOpinion } from "@/lib/trackedStockApi";

// Mock data - 实际应用中应该从数据库获取
const mockTrackedStocks: TrackedStock[] = [
  {
    id: "1",
    symbol: "AAPL",
    companyName: "Apple Inc.",
    currentPrice: 178.25,
    change: 2.45,
    changePercent: 1.39,
    isTracking: true,
    addedAt: new Date().toISOString(),
    logo: "https://logo.clearbit.com/apple.com",
    opinions: [
      {
        id: "op1",
        kolId: "kol1",
        kolName: "Tech Analyst Pro",
        kolUsername: "@techanalyst",
        kolPlatform: "twitter",
        sentiment: "bullish",
        opinion:
          "Apple's new product lineup looks very promising. Strong buy recommendation with AI features integration.",
        confidence: 8,
        targetPrice: 200,
        timeframe: "medium-term",
        publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        sourceUrl: "https://twitter.com/techanalyst/status/123",
      },
      {
        id: "op2",
        kolId: "kol2",
        kolName: "Market Watcher",
        kolUsername: "@marketwatch",
        kolPlatform: "reddit",
        sentiment: "neutral",
        opinion:
          "AAPL showing sideways movement. Wait for clear breakout signal before entering position.",
        confidence: 6,
        timeframe: "short-term",
        publishedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      },
    ],
  },
  {
    id: "2",
    symbol: "TSLA",
    companyName: "Tesla, Inc.",
    currentPrice: 242.84,
    change: -5.32,
    changePercent: -2.14,
    isTracking: true,
    addedAt: new Date().toISOString(),
    logo: "https://logo.clearbit.com/tesla.com",
    opinions: [
      {
        id: "op3",
        kolId: "kol3",
        kolName: "EV Expert",
        kolUsername: "@evexpert",
        kolPlatform: "youtube",
        sentiment: "bearish",
        opinion:
          "Concerns about delivery numbers and increasing competition in EV market. Consider reducing exposure.",
        confidence: 7,
        targetPrice: 220,
        timeframe: "short-term",
        publishedAt: new Date(
          Date.now() - 1 * 24 * 60 * 60 * 1000
        ).toISOString(),
        sourceUrl: "https://youtube.com/watch?v=abc",
      },
      {
        id: "op4",
        kolId: "kol1",
        kolName: "Tech Analyst Pro",
        kolUsername: "@techanalyst",
        kolPlatform: "twitter",
        sentiment: "bullish",
        opinion:
          "Long-term fundamentals remain strong. FSD technology breakthrough could be a major catalyst.",
        confidence: 9,
        targetPrice: 300,
        timeframe: "long-term",
        publishedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      },
    ],
  },
  {
    id: "3",
    symbol: "NVDA",
    companyName: "NVIDIA Corporation",
    currentPrice: 495.22,
    change: 12.38,
    changePercent: 2.56,
    isTracking: true,
    addedAt: new Date().toISOString(),
    logo: "https://logo.clearbit.com/nvidia.com",
    opinions: [
      {
        id: "op5",
        kolId: "kol4",
        kolName: "AI Investor",
        kolUsername: "@aiinvestor",
        kolPlatform: "rednote",
        sentiment: "bullish",
        opinion:
          "AI chip demand continues to explode. NVDA is the biggest beneficiary. Data center business growth exceeds expectations.",
        confidence: 10,
        targetPrice: 600,
        timeframe: "medium-term",
        publishedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      },
    ],
  },
];

// GET - 获取所有追踪的股票
export async function GET(request: NextRequest) {
  try {
    // 模拟延迟
    await new Promise((resolve) => setTimeout(resolve, 300));

    // 按追踪状态和时间排序
    const sortedStocks = [...mockTrackedStocks].sort((a, b) => {
      if (a.isTracking !== b.isTracking) {
        return a.isTracking ? -1 : 1;
      }
      return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
    });

    return NextResponse.json(sortedStocks);
  } catch (error) {
    console.error("Error fetching tracked stocks:", error);
    return NextResponse.json(
      { error: "Failed to fetch tracked stocks" },
      { status: 500 }
    );
  }
}

// POST - 添加新的追踪股票
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbol, companyName, logo } = body;

    if (!symbol || !companyName) {
      return NextResponse.json(
        { error: "Symbol and company name are required" },
        { status: 400 }
      );
    }

    const newStock: TrackedStock = {
      id: Date.now().toString(),
      symbol: symbol.toUpperCase(),
      companyName,
      logo,
      isTracking: true,
      addedAt: new Date().toISOString(),
      opinions: [],
    };

    mockTrackedStocks.push(newStock);

    return NextResponse.json(newStock, { status: 201 });
  } catch (error) {
    console.error("Error creating tracked stock:", error);
    return NextResponse.json(
      { error: "Failed to create tracked stock" },
      { status: 500 }
    );
  }
}

// PATCH - 更新追踪股票
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const index = mockTrackedStocks.findIndex((stock) => stock.id === id);
    if (index === -1) {
      return NextResponse.json({ error: "Stock not found" }, { status: 404 });
    }

    mockTrackedStocks[index] = {
      ...mockTrackedStocks[index],
      ...updates,
    };

    return NextResponse.json(mockTrackedStocks[index]);
  } catch (error) {
    console.error("Error updating tracked stock:", error);
    return NextResponse.json(
      { error: "Failed to update tracked stock" },
      { status: 500 }
    );
  }
}

// DELETE - 删除追踪股票
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const index = mockTrackedStocks.findIndex((stock) => stock.id === id);
    if (index === -1) {
      return NextResponse.json({ error: "Stock not found" }, { status: 404 });
    }

    mockTrackedStocks.splice(index, 1);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting tracked stock:", error);
    return NextResponse.json(
      { error: "Failed to delete tracked stock" },
      { status: 500 }
    );
  }
}
