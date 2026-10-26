import { NextRequest, NextResponse } from "next/server";
import { FRED_MARKET_SERIES, parseMarketObservations } from "@/lib/marketObservations";

export const maxDuration = 30;

/** A fixed allowlist, independent of Yahoo quote and intraday-history semantics. */
export async function GET(request: NextRequest, { params }: { params: { series: string } }) {
  const series = params.series;
  if (!FRED_MARKET_SERIES.some(id => id === series)) {
    return NextResponse.json({ error: "Unknown observation series" }, { status: 400 });
  }
  try {
    const end = new Date().toISOString().slice(0, 10);
    const start = new Date();
    start.setUTCFullYear(start.getUTCFullYear() - 2);
    const response = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${series}&cosd=${start.toISOString().slice(0, 10)}&coed=${end}`, {
      next: { revalidate: 21600 },
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(20000)]),
    });
    if (!response.ok) throw new Error("FRED unavailable");
    const csv = await response.text();
    if (csv.length > 2_000_000) throw new Error("FRED export too large");
    const history = parseMarketObservations(csv, series);
    if (!history.length) throw new Error("No observations");
    return NextResponse.json({ series, history, source: "FRED", sourceUrl: `https://fred.stlouisfed.org/series/${series}` }, {
      headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=3600" },
    });
  } catch {
    return NextResponse.json({ error: "Daily observations unavailable" }, { status: 503 });
  }
}
