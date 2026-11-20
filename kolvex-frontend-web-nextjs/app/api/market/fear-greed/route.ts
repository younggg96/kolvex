import { NextRequest, NextResponse } from "next/server";
import { BACKEND_API_V1 } from "@/lib/config/backend";

export async function GET(request: NextRequest) {
  try {
    const upstream = await fetch(`${BACKEND_API_V1}/market/fear-greed`, {
      cache: "no-store",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(15_000)]),
    });
    if (!upstream.ok) throw new Error("Fear & Greed history unavailable");
    return NextResponse.json(await upstream.json(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Fear & Greed history unavailable" }, { status: 503 });
  }
}
