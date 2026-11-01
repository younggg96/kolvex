import { NextResponse } from "next/server";

const BACKEND =
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8080";
const kinds = new Set([
  "income-statement",
  "balance-sheet",
  "cash-flow",
  "earnings",
  "analyst",
  "overview-metrics",
]);

export async function GET(
  request: Request,
  { params }: { params: { symbol: string; kind: string } },
) {
  const symbol = params.symbol.toUpperCase();
  if (!/^[A-Z0-9.^-]{1,12}$/.test(symbol) || !kinds.has(params.kind)) {
    return NextResponse.json(
      { error: "Invalid fundamentals request" },
      { status: 400 },
    );
  }
  const quarterly =
    new URL(request.url).searchParams.get("quarterly") === "true";
  try {
    const response = await fetch(
      `${BACKEND}/api/v1/market/${params.kind}/${encodeURIComponent(symbol)}?quarterly=${quarterly}`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!response.ok)
      return NextResponse.json(
        { error: "Fundamentals unavailable" },
        { status: response.status },
      );
    const data = await response.json();
    if (
      params.kind === "overview-metrics"
        ? data.symbol !== symbol ||
          typeof data.analyzed_at !== "string" ||
          !Array.isArray(data.unavailable_sources)
        : params.kind === "analyst"
          ? !Array.isArray(data.recommendations_summary)
          : params.kind === "earnings"
            ? !Array.isArray(data.earnings_dates) ||
              !Array.isArray(data.earnings_history)
            : !Array.isArray(data.data)
    ) {
      throw new Error("Invalid fundamentals response");
    }
    return NextResponse.json(data, {
      headers: {
        "Cache-Control":
          params.kind === "overview-metrics" && data.unavailable_sources.length
            ? "no-store"
            : "private, max-age=300",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Fundamentals unavailable" },
      { status: 502 },
    );
  }
}
