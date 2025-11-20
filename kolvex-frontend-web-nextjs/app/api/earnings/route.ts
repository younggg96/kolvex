import { NextRequest, NextResponse } from "next/server";
import { mockEarnings } from "@/lib/mockData";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get("symbol");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  try {
    if (symbol) {
      // Fetch earnings for specific symbol
      const earnings = mockEarnings.filter((e) => e.symbol === symbol.toUpperCase());
      return NextResponse.json(earnings);
    } else {
      // Fetch earnings calendar with optional date range
      let filteredEarnings = [...mockEarnings];

      if (from) {
        filteredEarnings = filteredEarnings.filter((e) => e.date >= from);
      }

      if (to) {
        filteredEarnings = filteredEarnings.filter((e) => e.date <= to);
      }

      // Sort by date
      filteredEarnings.sort((a, b) => a.date.localeCompare(b.date));

      return NextResponse.json(filteredEarnings);
    }
  } catch (error) {
    console.error("Earnings API Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch earnings data" },
      { status: 500 }
    );
  }
}
